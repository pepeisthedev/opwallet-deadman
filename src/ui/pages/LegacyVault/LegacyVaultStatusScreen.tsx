import { useCallback, useEffect, useMemo, useState } from 'react';

import { LegacyVaultDetails } from '@/shared/types/LegacyVault';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useSelectedLegacyVaultId, useSetSelectedLegacyVaultId } from '@/ui/state/legacyVault/hooks';
import { useLocationState, useWallet } from '@/ui/utils';
import { RouteTypes, useNavigate } from '@/ui/pages/routeTypes';

import {
    formatDurationSec,
    formatPercentFromBps,
    formatSats,
    formatTimestamp,
    legacyVaultPendingActionLabel,
    legacyVaultTxExplorerUrl,
    lvColors,
    pageContainerStyle,
    panelStyle,
    primaryButtonStyle,
    secondaryButtonStyle,
    statusColor,
    type LegacyVaultPendingAction,
    withDisabledButtonStyle
} from './common';

interface StatusLocationState {
    vaultId?: string;
    pendingAction?: LegacyVaultPendingAction;
    pendingTxid?: string;
}

interface LegacyVaultPendingNotice {
    action: LegacyVaultPendingAction;
    txid?: string;
    atTs: number;
}

export default function LegacyVaultStatusScreen() {
    const wallet = useWallet();
    const tools = useTools();
    const navigate = useNavigate();
    const routeState = useLocationState<StatusLocationState | undefined>();
    const selectedVaultId = useSelectedLegacyVaultId();
    const setSelectedVaultId = useSetSelectedLegacyVaultId();

    const vaultId = routeState?.vaultId || selectedVaultId || '';

    const [vault, setVault] = useState<LegacyVaultDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [pendingNotice, setPendingNotice] = useState<LegacyVaultPendingNotice | null>(() =>
        routeState?.pendingAction
            ? {
                  action: routeState.pendingAction,
                  txid: routeState.pendingTxid,
                  atTs: Date.now()
              }
            : null
    );

    const loadVault = useCallback(async () => {
        if (!vaultId) {
            setLoading(false);
            setVault(null);
            return;
        }

        setLoading(true);
        try {
            const details = await wallet.legacyVault_getVault(vaultId);
            setVault(details);
            if (details) {
                setSelectedVaultId(details.vaultId);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [setSelectedVaultId, vaultId, wallet]);

    useEffect(() => {
        void loadVault();
    }, [loadVault]);

    useEffect(() => {
        if (!routeState?.pendingAction) {
            return;
        }

        setPendingNotice({
            action: routeState.pendingAction,
            txid: routeState.pendingTxid,
            atTs: Date.now()
        });
    }, [routeState?.pendingAction, routeState?.pendingTxid]);

    const runAction = async (action: 'checkIn' | 'trigger') => {
        if (!vault) return;
        setActionBusy(action);
        try {
            const result = action === 'checkIn'
                ? await wallet.legacyVault_checkIn(vault.vaultId)
                : await wallet.legacyVault_trigger(vault.vaultId);
            if (!result.ok) {
                tools.toastError(result.error || 'Action failed');
                return;
            }
            if (result.txid) {
                setPendingNotice({
                    action,
                    txid: result.txid,
                    atTs: Date.now()
                });
                tools.toastSuccess(
                    `${action === 'checkIn' ? 'Check-in' : 'Trigger'} transaction broadcasted. Waiting for confirmation...`
                );
            } else {
                tools.toastSuccess(action === 'checkIn' ? 'Check-in recorded' : 'Vault triggered');
            }
            await loadVault();
        } catch (error) {
            console.error(error);
            tools.toastError('Legacy Vault action failed');
        } finally {
            setActionBusy(null);
        }
    };

    const canCheckIn = useMemo(() => vault && vault.status !== 'CLAIMED', [vault]);
    const canTrigger = useMemo(() => vault?.status === 'OVERDUE', [vault]);
    const canClaim = useMemo(() => vault?.status === 'CLAIMABLE', [vault]);
    const pendingTxUrl = useMemo(() => legacyVaultTxExplorerUrl(pendingNotice?.txid), [pendingNotice?.txid]);

    const renderTxRef = (txid?: string) => {
        if (!txid) {
            return '—';
        }

        const txUrl = legacyVaultTxExplorerUrl(txid);
        if (!txUrl) {
            return txid;
        }

        return (
            <a
                href={txUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: lvColors.info, textDecoration: 'none', wordBreak: 'break-all' }}>
                {txid}
            </a>
        );
    };

    const pendingNoticePanel = pendingNotice ? (
        <div
            style={{
                ...panelStyle,
                marginBottom: '12px',
                border: `1px solid ${lvColors.info}44`,
                background: 'rgba(96, 165, 250, 0.08)'
            }}>
            <div style={{ color: lvColors.info, fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                {legacyVaultPendingActionLabel(pendingNotice.action)} Transaction Broadcasted
            </div>
            <div style={{ color: lvColors.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                The transaction was sent to the network. Contract state in the wallet may take a moment to update after
                confirmation/indexing.
            </div>
            {pendingNotice.txid && (
                <div style={{ marginTop: '8px', fontSize: '10px', color: lvColors.text }}>
                    <div style={{ color: lvColors.textMuted, marginBottom: '4px' }}>Tx ID</div>
                    <div style={{ wordBreak: 'break-all' }}>{pendingNotice.txid}</div>
                    {pendingTxUrl && (
                        <a
                            href={pendingTxUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                display: 'inline-block',
                                marginTop: '6px',
                                color: lvColors.info,
                                textDecoration: 'none',
                                fontWeight: 600
                            }}>
                            View on OP_SCAN
                        </a>
                    )}
                </div>
            )}
        </div>
    ) : null;

    if (loading) {
        return (
            <Layout>
                <Header onBack={() => window.history.go(-1)} title="Legacy Vault Status" />
                <div style={pageContainerStyle}>
                    <div style={panelStyle}>Loading vault...</div>
                </div>
            </Layout>
        );
    }

    if (!vault) {
        return (
            <Layout>
                <Header onBack={() => window.history.go(-1)} title="Legacy Vault Status" />
                <div style={pageContainerStyle}>
                    {pendingNoticePanel}
                    <div style={{ ...panelStyle, marginBottom: '12px' }}>
                        <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                            Vault Not Found
                        </div>
                        <div style={{ color: lvColors.textMuted, fontSize: '11px', marginBottom: '10px' }}>
                            Select a vault from the Legacy Vault home screen.
                        </div>
                        <button style={primaryButtonStyle} onClick={() => navigate(RouteTypes.LegacyVaultHomeScreen)}>
                            Go to Legacy Vault Home
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header onBack={() => window.history.go(-1)} title="Legacy Vault Status" />
            <div style={pageContainerStyle}>
                {pendingNoticePanel}
                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '14px' }}>{vault.label}</div>
                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginTop: '3px' }}>{vault.vaultId}</div>
                        </div>
                        <span
                            style={{
                                color: statusColor(vault.status),
                                border: `1px solid ${statusColor(vault.status)}55`,
                                background: `${statusColor(vault.status)}11`,
                                borderRadius: '999px',
                                padding: '4px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                height: 'fit-content'
                            }}>
                            {vault.status}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: '11px' }}>
                        <div style={{ color: lvColors.textMuted }}>Amount</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatSats(vault.amountSats)}</div>
                        <div style={{ color: lvColors.textMuted }}>Created</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatTimestamp(vault.createdAtTs)}</div>
                        <div style={{ color: lvColors.textMuted }}>Last Check-in</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatTimestamp(vault.lastCheckInTs)}</div>
                        <div style={{ color: lvColors.textMuted }}>Next Deadline</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatTimestamp(vault.nextDeadlineTs)}</div>
                        <div style={{ color: lvColors.textMuted }}>Interval / Grace</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>
                            {formatDurationSec(vault.intervalSec)} + {formatDurationSec(vault.graceSec)}
                        </div>
                        <div style={{ color: lvColors.textMuted }}>Mode</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>OP_NET-managed</div>
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Heirs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {vault.heirs.map((heir, index) => (
                            <div
                                key={`${heir.address}-${index}`}
                                style={{ border: `1px solid ${lvColors.border}`, borderRadius: '8px', padding: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ color: lvColors.text, fontSize: '11px', fontWeight: 600 }}>
                                        {heir.label || `Heir ${index + 1}`}
                                    </div>
                                    <div style={{ color: lvColors.main, fontSize: '11px', fontWeight: 700 }}>
                                        {formatPercentFromBps(heir.shareBps)}
                                    </div>
                                </div>
                                <div style={{ color: lvColors.textMuted, fontSize: '10px', marginTop: '4px', wordBreak: 'break-all' }}>
                                    {heir.address}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                        Demo Transaction References
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: '10px' }}>
                        <div style={{ color: lvColors.textMuted }}>Create Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(vault.txRefs.createdTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Last Check-in Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(vault.txRefs.lastCheckInTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Trigger Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(vault.txRefs.triggerTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Claim Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(vault.txRefs.claimTxId)}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button style={secondaryButtonStyle} onClick={() => void loadVault()}>
                        Refresh
                    </button>
                    <button
                        style={withDisabledButtonStyle(secondaryButtonStyle, !canCheckIn || actionBusy !== null)}
                        disabled={!canCheckIn || actionBusy !== null}
                        onClick={() => void runAction('checkIn')}>
                        {actionBusy === 'checkIn' ? 'Checking in...' : 'Check in'}
                    </button>
                    <button
                        style={withDisabledButtonStyle(secondaryButtonStyle, !canTrigger || actionBusy !== null)}
                        disabled={!canTrigger || actionBusy !== null}
                        onClick={() => void runAction('trigger')}>
                        {actionBusy === 'trigger' ? 'Triggering...' : 'Trigger'}
                    </button>
                    <button
                        style={withDisabledButtonStyle(primaryButtonStyle, !canClaim)}
                        disabled={!canClaim}
                        onClick={() => navigate(RouteTypes.LegacyVaultClaimScreen, { vaultId: vault.vaultId })}>
                        Claim
                    </button>
                </div>
            </div>
        </Layout>
    );
}
