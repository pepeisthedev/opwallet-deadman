import { useCallback, useEffect, useState } from 'react';

import { LegacyVaultSummary } from '@/shared/types/LegacyVault';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useSetSelectedLegacyVaultId } from '@/ui/state/legacyVault/hooks';
import { useWallet } from '@/ui/utils';
import { RouteTypes, useNavigate } from '@/ui/pages/routeTypes';

import {
    formatSats,
    formatTimestamp,
    lvColors,
    normalizeLegacyVaultAddress,
    pageContainerStyle,
    panelStyle,
    primaryButtonStyle,
    secondaryButtonStyle,
    statusColor,
    withDisabledButtonStyle
} from './common';

export default function LegacyVaultHomeScreen() {
    const wallet = useWallet();
    const tools = useTools();
    const navigate = useNavigate();
    const setSelectedVaultId = useSetSelectedLegacyVaultId();

    const [vaults, setVaults] = useState<LegacyVaultSummary[]>([]);
    const [vaultRoleMap, setVaultRoleMap] = useState<Record<string, { isOwner: boolean; isHeir: boolean }>>({});
    const [loading, setLoading] = useState(true);
    const [busyVaultId, setBusyVaultId] = useState<string | null>(null);

    const loadVaults = useCallback(async () => {
        setLoading(true);
        try {
            const list = await wallet.legacyVault_listVaults();
            setVaults(list);
            const signerAddress = await wallet.legacyVault_getSignerAddress().catch(() => null);
            const currentAddress = normalizeLegacyVaultAddress(signerAddress || '');
            if (!currentAddress || list.length === 0) {
                setVaultRoleMap({});
                return;
            }

            const detailsList = await Promise.all(list.map((vault) => wallet.legacyVault_getVault(vault.vaultId).catch(() => null)));
            const nextRoleMap: Record<string, { isOwner: boolean; isHeir: boolean }> = {};
            detailsList.forEach((details, index) => {
                if (!details) {
                    return;
                }

                nextRoleMap[list[index].vaultId] = {
                    isOwner: normalizeLegacyVaultAddress(details.ownerAddress) === currentAddress,
                    isHeir: details.heirs.some((heir) => normalizeLegacyVaultAddress(heir.address) === currentAddress)
                };
            });
            setVaultRoleMap(nextRoleMap);
        } catch (error) {
            console.error(error);
            setVaultRoleMap({});
        } finally {
            setLoading(false);
        }
    }, [wallet]);

    useEffect(() => {
        void loadVaults();
    }, [loadVaults]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void loadVaults();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [loadVaults]);

    const runAction = async (vaultId: string, action: 'checkIn' | 'trigger' | 'claim') => {
        setBusyVaultId(vaultId);
        try {
            const result =
                action === 'checkIn'
                    ? await wallet.legacyVault_checkIn(vaultId)
                    : action === 'trigger'
                      ? await wallet.legacyVault_trigger(vaultId)
                      : await wallet.legacyVault_claim(vaultId);

            if (!result.ok) {
                tools.toastError(result.error || 'Action failed');
                return;
            }

            if (result.txid) {
                tools.toastSuccess(
                    `${action === 'checkIn' ? 'Check-in' : action === 'trigger' ? 'Trigger' : 'Claim'} transaction broadcasted. Waiting for confirmation...`
                );
                setSelectedVaultId(vaultId);
                navigate(RouteTypes.LegacyVaultStatusScreen, {
                    vaultId,
                    pendingAction: action,
                    pendingTxid: result.txid
                });
                return;
            }

            tools.toastSuccess(action === 'checkIn' ? 'Check-in recorded' : action === 'trigger' ? 'Vault triggered' : 'Claim completed');
            await loadVaults();
        } catch (error) {
            console.error(error);
            tools.toastError('Legacy Vault action failed');
        } finally {
            setBusyVaultId(null);
        }
    };

    return (
        <Layout>
            <Header onBack={() => window.history.go(-1)} title="Legacy Vault" />
            <div style={pageContainerStyle}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <button style={primaryButtonStyle} onClick={() => navigate(RouteTypes.LegacyVaultCreateScreen)}>
                        Create Vault
                    </button>
                    <button style={secondaryButtonStyle} onClick={() => void loadVaults()}>
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div style={{ ...panelStyle, color: lvColors.textMuted, fontSize: '12px' }}>Loading vaults...</div>
                ) : vaults.length === 0 ? (
                    <div style={{ ...panelStyle, color: lvColors.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
                        No Legacy Vaults yet. Create one with a short interval (for example 1 minute + 1 minute grace) if
                        you want to test the full check-in -&gt; trigger -&gt; claim flow quickly.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {vaults.map((vault) => {
                            const isBusy = busyVaultId === vault.vaultId;
                            const role = vaultRoleMap[vault.vaultId];
                            const showCheckIn = Boolean(role?.isOwner);
                            const showHeirActions = Boolean(role?.isHeir);
                            const canTrigger =
                                vault.status === 'OVERDUE' ||
                                (vault.status === 'ACTIVE' && vault.nextDeadlineTs > 0 && Date.now() >= vault.nextDeadlineTs);
                            return (
                                <div key={vault.vaultId} style={panelStyle}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    color: lvColors.text,
                                                    fontSize: '13px',
                                                    fontWeight: 700,
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis'
                                                }}>
                                                {vault.label}
                                            </div>
                                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginTop: '3px' }}>
                                                {vault.vaultId}
                                            </div>
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

                                    <div
                                        style={{
                                            marginTop: '10px',
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: '6px 10px',
                                            fontSize: '11px'
                                        }}>
                                        <div style={{ color: lvColors.textMuted }}>Amount</div>
                                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatSats(vault.amountSats)}</div>
                                        <div style={{ color: lvColors.textMuted }}>Heirs</div>
                                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{vault.heirsCount}</div>
                                        <div style={{ color: lvColors.textMuted }}>Next Deadline</div>
                                        <div style={{ color: lvColors.text, textAlign: 'right' }}>
                                            {formatTimestamp(vault.nextDeadlineTs)}
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                                        <button
                                            style={secondaryButtonStyle}
                                            onClick={() => {
                                                setSelectedVaultId(vault.vaultId);
                                                navigate(RouteTypes.LegacyVaultStatusScreen, { vaultId: vault.vaultId });
                                            }}>
                                            View
                                        </button>
                                        {showCheckIn && (
                                            <button
                                                style={withDisabledButtonStyle(secondaryButtonStyle, isBusy || vault.status === 'CLAIMED')}
                                                disabled={isBusy || vault.status === 'CLAIMED'}
                                                onClick={() => void runAction(vault.vaultId, 'checkIn')}>
                                                Check in
                                            </button>
                                        )}
                                        {showHeirActions && (
                                            <button
                                                style={withDisabledButtonStyle(secondaryButtonStyle, isBusy || !canTrigger)}
                                                disabled={isBusy || !canTrigger}
                                                onClick={() => void runAction(vault.vaultId, 'trigger')}>
                                                Trigger
                                            </button>
                                        )}
                                        {showHeirActions && (
                                            <button
                                                style={withDisabledButtonStyle(secondaryButtonStyle, isBusy || vault.status !== 'CLAIMABLE')}
                                                disabled={isBusy || vault.status !== 'CLAIMABLE'}
                                                onClick={() => {
                                                    setSelectedVaultId(vault.vaultId);
                                                    navigate(RouteTypes.LegacyVaultClaimScreen, { vaultId: vault.vaultId });
                                                }}>
                                                Claim
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}
