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
    normalizeLegacyVaultAddress,
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

const LEGACY_VAULT_PENDING_NOTICE_STORAGE_PREFIX = 'legacyVaultPendingNotice:';

function legacyVaultPendingNoticeStorageKey(vaultId: string): string {
    return `${LEGACY_VAULT_PENDING_NOTICE_STORAGE_PREFIX}${vaultId}`;
}

function readLegacyVaultPendingNotice(vaultId: string): LegacyVaultPendingNotice | null {
    if (!vaultId || typeof window === 'undefined') {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(legacyVaultPendingNoticeStorageKey(vaultId));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as Partial<LegacyVaultPendingNotice> | null;
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }

        const action = parsed.action;
        if (action !== 'create' && action !== 'checkIn' && action !== 'trigger' && action !== 'claim') {
            return null;
        }

        return {
            action,
            txid: typeof parsed.txid === 'string' && parsed.txid.trim() ? parsed.txid : undefined,
            atTs: typeof parsed.atTs === 'number' && Number.isFinite(parsed.atTs) ? parsed.atTs : Date.now()
        };
    } catch {
        return null;
    }
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
    const [pendingNotice, setPendingNotice] = useState<LegacyVaultPendingNotice | null>(null);
    const [viewerAddress, setViewerAddress] = useState('');

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
        if (!vaultId) {
            return;
        }

        const timer = window.setInterval(() => {
            void loadVault();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [loadVault, vaultId]);

    useEffect(() => {
        if (!vaultId) {
            setPendingNotice(null);
            return;
        }

        if (routeState?.pendingAction) {
            setPendingNotice({
                action: routeState.pendingAction,
                txid: routeState.pendingTxid,
                atTs: Date.now()
            });
            return;
        }

        setPendingNotice(readLegacyVaultPendingNotice(vaultId));
    }, [routeState?.pendingAction, routeState?.pendingTxid, vaultId]);

    useEffect(() => {
        if (!vaultId || typeof window === 'undefined') {
            return;
        }

        try {
            if (!pendingNotice) {
                window.localStorage.removeItem(legacyVaultPendingNoticeStorageKey(vaultId));
                return;
            }

            window.localStorage.setItem(legacyVaultPendingNoticeStorageKey(vaultId), JSON.stringify(pendingNotice));
        } catch {
            // Ignore localStorage failures in restricted extension contexts.
        }
    }, [pendingNotice, vaultId]);

    useEffect(() => {
        let cancelled = false;

        const loadViewerAddress = async () => {
            try {
                const signerAddress = await wallet.legacyVault_getSignerAddress();
                if (!cancelled) {
                    setViewerAddress(normalizeLegacyVaultAddress(signerAddress || ''));
                }
            } catch {
                if (!cancelled) {
                    setViewerAddress('');
                }
            }
        };

        void loadViewerAddress();

        return () => {
            cancelled = true;
        };
    }, [wallet]);

    const viewerIsOwner = useMemo(() => {
        if (!vault || !viewerAddress) {
            return false;
        }
        return normalizeLegacyVaultAddress(vault.ownerAddress) === viewerAddress;
    }, [vault, viewerAddress]);
    const viewerIsHeir = useMemo(() => {
        if (!vault || !viewerAddress) {
            return false;
        }
        return vault.heirs.some((heir) => normalizeLegacyVaultAddress(heir.address) === viewerAddress);
    }, [vault, viewerAddress]);
    const viewerRoleLabel = useMemo(() => {
        if (viewerIsOwner && viewerIsHeir) {
            return 'Owner / Heir';
        }
        if (viewerIsOwner) {
            return 'Owner';
        }
        if (viewerIsHeir) {
            return 'Heir';
        }
        return 'Viewer';
    }, [viewerIsHeir, viewerIsOwner]);

    const runAction = async (action: 'checkIn' | 'trigger') => {
        if (!vault) return;
        if (action === 'checkIn' && !viewerIsOwner) {
            tools.toastError('Check-in is only available from the owner wallet.');
            return;
        }
        if (action === 'trigger' && !viewerIsHeir) {
            tools.toastError('Trigger is only available from a registered heir wallet.');
            return;
        }
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

    const canCheckIn = useMemo(() => Boolean(vault && vault.status !== 'CLAIMED'), [vault]);
    const canTrigger = useMemo(() => {
        if (!vault) {
            return false;
        }

        if (vault.status === 'OVERDUE') {
            return true;
        }

        return vault.status === 'ACTIVE' && vault.nextDeadlineTs > 0 && Date.now() >= vault.nextDeadlineTs;
    }, [vault]);
    const hasPendingClaim = useMemo(() => {
        if (!vault) {
            return false;
        }
        if (pendingNotice?.action === 'claim') {
            return true;
        }
        return vault.status !== 'CLAIMED' && Boolean(vault.txRefs.claimTxId);
    }, [pendingNotice?.action, vault]);
    const canClaim = useMemo(() => vault?.status === 'CLAIMABLE' && !hasPendingClaim, [hasPendingClaim, vault]);
    const showCheckIn = viewerIsOwner;
    const showHeirActions = viewerIsHeir;
    const pendingTxUrl = useMemo(() => legacyVaultTxExplorerUrl(pendingNotice?.txid), [pendingNotice?.txid]);
    const txRefs = useMemo(() => {
        const fallbackTxid = pendingNotice?.txid?.trim() || undefined;
        const fallbackAction = pendingNotice?.action;
        const source = vault?.txRefs || {};

        return {
            createdTxId: source.createdTxId || (fallbackAction === 'create' ? fallbackTxid : undefined),
            lastCheckInTxId: source.lastCheckInTxId || (fallbackAction === 'checkIn' ? fallbackTxid : undefined),
            triggerTxId: source.triggerTxId || (fallbackAction === 'trigger' ? fallbackTxid : undefined),
            claimTxId: source.claimTxId || (fallbackAction === 'claim' ? fallbackTxid : undefined)
        };
    }, [pendingNotice?.action, pendingNotice?.txid, vault?.txRefs]);

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
                        <div style={{ color: lvColors.textMuted }}>Viewing As</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{viewerRoleLabel}</div>
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
                        Transaction References
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: '10px' }}>
                        <div style={{ color: lvColors.textMuted }}>Create Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(txRefs.createdTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Last Check-in Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(txRefs.lastCheckInTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Trigger Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(txRefs.triggerTxId)}</div>
                        <div style={{ color: lvColors.textMuted }}>Claim Tx</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{renderTxRef(txRefs.claimTxId)}</div>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button style={secondaryButtonStyle} onClick={() => void loadVault()}>
                        Refresh
                    </button>
                    {showCheckIn && (
                        <button
                            style={withDisabledButtonStyle(secondaryButtonStyle, !canCheckIn || actionBusy !== null)}
                            disabled={!canCheckIn || actionBusy !== null}
                            onClick={() => void runAction('checkIn')}>
                            {actionBusy === 'checkIn' ? 'Checking in...' : 'Check in'}
                        </button>
                    )}
                    {showHeirActions && (
                        <button
                            style={withDisabledButtonStyle(secondaryButtonStyle, !canTrigger || actionBusy !== null)}
                            disabled={!canTrigger || actionBusy !== null}
                            onClick={() => void runAction('trigger')}>
                            {actionBusy === 'trigger' ? 'Triggering...' : 'Trigger'}
                        </button>
                    )}
                    {showHeirActions && (
                        <button
                            style={withDisabledButtonStyle(primaryButtonStyle, !canClaim)}
                            disabled={!canClaim}
                            onClick={() => navigate(RouteTypes.LegacyVaultClaimScreen, { vaultId: vault.vaultId })}>
                            Claim
                        </button>
                    )}
                </div>
                {!viewerIsOwner && !viewerIsHeir && (
                    <div style={{ ...panelStyle, marginTop: '12px', border: `1px solid ${lvColors.info}44` }}>
                        <div style={{ color: lvColors.info, fontSize: '11px', lineHeight: 1.4 }}>
                            This wallet is not the vault owner or a registered heir. You can view status, but lifecycle actions are hidden.
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
