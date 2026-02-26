import { useMemo, useState } from 'react';

import { LegacyVaultCreateInput } from '@/shared/types/LegacyVault';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useLegacyVaultState, useSetLegacyVaultDraft, useSetSelectedLegacyVaultId } from '@/ui/state/legacyVault/hooks';
import { useLocationState, useWallet } from '@/ui/utils';
import { RouteTypes, useNavigate } from '@/ui/pages/routeTypes';

import {
    formatPercentFromBps,
    formatSats,
    lvColors,
    pageContainerStyle,
    panelStyle,
    primaryButtonStyle,
    secondaryButtonStyle
} from './common';

interface ReviewLocationState {
    draft?: LegacyVaultCreateInput;
}

export default function LegacyVaultReviewScreen() {
    const wallet = useWallet();
    const tools = useTools();
    const navigate = useNavigate();
    const locationState = useLocationState<ReviewLocationState | undefined>();
    const { draft: storedDraft } = useLegacyVaultState();
    const setDraft = useSetLegacyVaultDraft();
    const setSelectedVaultId = useSetSelectedLegacyVaultId();

    const [creating, setCreating] = useState(false);

    const draft = locationState?.draft || storedDraft || null;

    const totalBps = useMemo(() => draft?.heirs.reduce((sum, heir) => sum + heir.shareBps, 0) || 0, [draft]);

    const handleCreate = async () => {
        if (!draft) {
            tools.toastError('No vault draft found');
            return;
        }

        setCreating(true);
        try {
            const result = await wallet.legacyVault_finalizeAndCreate(draft);
            if (!result.ok || !result.vaultId) {
                tools.toastError(result.error || 'Failed to create vault');
                return;
            }

            setDraft(null);
            setSelectedVaultId(result.vaultId);
            tools.toastSuccess('Create transaction broadcasted. Waiting for confirmation...');
            navigate(RouteTypes.LegacyVaultStatusScreen, {
                vaultId: result.vaultId,
                pendingAction: 'create',
                pendingTxid: result.txid
            });
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to create legacy vault');
        } finally {
            setCreating(false);
        }
    };

    if (!draft) {
        return (
            <Layout>
                <Header onBack={() => window.history.go(-1)} title="Review Legacy Vault" />
                <div style={pageContainerStyle}>
                    <div style={panelStyle}>
                        <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                            Missing Draft
                        </div>
                        <div style={{ color: lvColors.textMuted, fontSize: '11px', lineHeight: 1.4, marginBottom: '10px' }}>
                            The create form state is missing. Start again from Create Vault.
                        </div>
                        <button style={primaryButtonStyle} onClick={() => navigate(RouteTypes.LegacyVaultCreateScreen)}>
                            Back to Create
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Header onBack={() => window.history.go(-1)} title="Review Legacy Vault" />
            <div style={pageContainerStyle}>
                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: '11px' }}>
                        <div style={{ color: lvColors.textMuted }}>Label</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{draft.label}</div>
                        <div style={{ color: lvColors.textMuted }}>Mode</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>OP_NET-managed</div>
                        <div style={{ color: lvColors.textMuted }}>Amount</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>{formatSats(draft.amountSats)}</div>
                        <div style={{ color: lvColors.textMuted }}>Check-in Interval</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>
                            {draft.interval.value} {draft.interval.unit}
                        </div>
                        <div style={{ color: lvColors.textMuted }}>Grace</div>
                        <div style={{ color: lvColors.text, textAlign: 'right' }}>
                            {draft.grace.value} {draft.grace.unit}
                        </div>
                        <div style={{ color: lvColors.textMuted }}>Heir Total</div>
                        <div style={{ color: totalBps === 10000 ? lvColors.success : lvColors.warning, textAlign: 'right' }}>
                            {(totalBps / 100).toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Heirs</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {draft.heirs.map((heir, index) => (
                            <div
                                key={`${heir.address}-${index}`}
                                style={{
                                    border: `1px solid ${lvColors.border}`,
                                    borderRadius: '8px',
                                    padding: '8px',
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto',
                                    gap: '4px 8px'
                                }}>
                                <div style={{ color: lvColors.text, fontSize: '11px', fontWeight: 600 }}>{heir.label || `Heir ${index + 1}`}</div>
                                <div style={{ color: lvColors.main, fontSize: '11px', fontWeight: 700 }}>
                                    {formatPercentFromBps(heir.shareBps)}
                                </div>
                                <div
                                    style={{
                                        color: lvColors.textMuted,
                                        fontSize: '10px',
                                        gridColumn: '1 / span 2',
                                        wordBreak: 'break-all'
                                    }}>
                                    {heir.address}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        ...panelStyle,
                        marginBottom: '12px',
                        border: `1px solid ${lvColors.warning}44`,
                        background: 'rgba(251, 191, 36, 0.06)'
                    }}>
                    <div style={{ color: lvColors.warning, fontWeight: 700, fontSize: '12px', marginBottom: '6px' }}>
                        OP_NET / P2OP Trust Model Warning
                    </div>
                    <div style={{ color: lvColors.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                        This MVP is a demo-first OP_NET-managed Legacy Vault path. Bitcoin L1 consensus does not enforce this
                        vault policy in the current implementation. A user-triggered transaction/action is still required.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={primaryButtonStyle} onClick={() => void handleCreate()} disabled={creating}>
                        {creating ? 'Creating...' : 'Create Vault'}
                    </button>
                    <button style={secondaryButtonStyle} onClick={() => window.history.go(-1)} disabled={creating}>
                        Back
                    </button>
                </div>
            </div>
        </Layout>
    );
}
