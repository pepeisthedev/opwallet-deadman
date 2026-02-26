import { useCallback, useEffect, useMemo, useState } from 'react';

import { LegacyVaultDetails } from '@/shared/types/LegacyVault';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useSelectedLegacyVaultId, useSetSelectedLegacyVaultId } from '@/ui/state/legacyVault/hooks';
import { useLocationState, useWallet } from '@/ui/utils';
import { RouteTypes, useNavigate } from '@/ui/pages/routeTypes';

import {
    formatPercentFromBps,
    formatSats,
    lvColors,
    pageContainerStyle,
    panelStyle,
    primaryButtonStyle,
    secondaryButtonStyle,
    statusColor,
    withDisabledButtonStyle
} from './common';

interface ClaimLocationState {
    vaultId?: string;
}

export default function LegacyVaultClaimScreen() {
    const wallet = useWallet();
    const tools = useTools();
    const navigate = useNavigate();
    const routeState = useLocationState<ClaimLocationState | undefined>();
    const selectedVaultId = useSelectedLegacyVaultId();
    const setSelectedVaultId = useSetSelectedLegacyVaultId();

    const vaultId = routeState?.vaultId || selectedVaultId || '';

    const [vault, setVault] = useState<LegacyVaultDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);

    const loadVault = useCallback(async () => {
        if (!vaultId) {
            setLoading(false);
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

    const claimDisabledReason = useMemo(() => {
        if (!vault) return 'Vault not found';
        if (vault.status !== 'CLAIMABLE') return `Vault is ${vault.status}. Trigger it after overdue before claiming.`;
        return null;
    }, [vault]);

    const handleClaim = async () => {
        if (!vault) return;
        setClaiming(true);
        try {
            const result = await wallet.legacyVault_claim(vault.vaultId);
            if (!result.ok) {
                tools.toastError(result.error || 'Claim failed');
                return;
            }
            tools.toastSuccess('Claim transaction broadcasted. Waiting for confirmation...');
            navigate(RouteTypes.LegacyVaultStatusScreen, {
                vaultId: vault.vaultId,
                pendingAction: 'claim',
                pendingTxid: result.txid
            });
        } catch (error) {
            console.error(error);
            tools.toastError('Claim failed');
        } finally {
            setClaiming(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <Header onBack={() => window.history.go(-1)} title="Claim Legacy Vault" />
                <div style={pageContainerStyle}>
                    <div style={panelStyle}>Loading claim view...</div>
                </div>
            </Layout>
        );
    }

    if (!vault) {
        return (
            <Layout>
                <Header onBack={() => window.history.go(-1)} title="Claim Legacy Vault" />
                <div style={pageContainerStyle}>
                    <div style={panelStyle}>
                        <div style={{ color: lvColors.text, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                            No vault selected
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
            <Header onBack={() => window.history.go(-1)} title="Claim Legacy Vault" />
            <div style={pageContainerStyle}>
                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                        <div>
                            <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px' }}>{vault.label}</div>
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
                    <div style={{ color: lvColors.textMuted, fontSize: '11px' }}>
                        Amount: <span style={{ color: lvColors.text }}>{formatSats(vault.amountSats)}</span>
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Distribution</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {vault.heirs.map((heir, index) => (
                            <div key={`${heir.address}-${index}`} style={{ border: `1px solid ${lvColors.border}`, borderRadius: '8px', padding: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ color: lvColors.text, fontSize: '11px', fontWeight: 600 }}>
                                        {heir.label || `Heir ${index + 1}`}
                                    </div>
                                    <div style={{ color: lvColors.main, fontSize: '11px', fontWeight: 700 }}>
                                        {formatPercentFromBps(heir.shareBps)}
                                    </div>
                                </div>
                                <div style={{ color: lvColors.textMuted, fontSize: '10px', marginTop: '3px', wordBreak: 'break-all' }}>
                                    {heir.address}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {claimDisabledReason && (
                    <div style={{ ...panelStyle, marginBottom: '12px', border: `1px solid ${lvColors.warning}44` }}>
                        <div style={{ color: lvColors.warning, fontSize: '11px', lineHeight: 1.4 }}>{claimDisabledReason}</div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        style={withDisabledButtonStyle(primaryButtonStyle, Boolean(claimDisabledReason) || claiming)}
                        onClick={() => void handleClaim()}
                        disabled={Boolean(claimDisabledReason) || claiming}>
                        {claiming ? 'Claiming...' : 'Execute Claim'}
                    </button>
                    <button
                        style={withDisabledButtonStyle(secondaryButtonStyle, claiming)}
                        onClick={() => navigate(RouteTypes.LegacyVaultStatusScreen, { vaultId: vault.vaultId })}
                        disabled={claiming}>
                        Back to Status
                    </button>
                </div>
            </div>
        </Layout>
    );
}
