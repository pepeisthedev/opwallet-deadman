import { ChangeEvent, useMemo, useState } from 'react';

import { LegacyVaultCreateInput, LegacyVaultTimeUnit } from '@/shared/types/LegacyVault';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useSetLegacyVaultDraft } from '@/ui/state/legacyVault/hooks';
import { useWallet } from '@/ui/utils';
import { RouteTypes, useNavigate } from '@/ui/pages/routeTypes';

import { inputStyle, lvColors, pageContainerStyle, panelStyle, primaryButtonStyle, secondaryButtonStyle } from './common';

interface HeirDraftRow {
    label: string;
    address: string;
    sharePercent: string;
}

const UNIT_OPTIONS: LegacyVaultTimeUnit[] = ['minutes', 'hours', 'days'];

export default function LegacyVaultCreateScreen() {
    const wallet = useWallet();
    const tools = useTools();
    const navigate = useNavigate();
    const setDraft = useSetLegacyVaultDraft();

    const [label, setLabel] = useState('Family Inheritance Demo');
    const [amountSats, setAmountSats] = useState('100000');
    const [intervalValue, setIntervalValue] = useState('1');
    const [intervalUnit, setIntervalUnit] = useState<LegacyVaultTimeUnit>('minutes');
    const [graceValue, setGraceValue] = useState('1');
    const [graceUnit, setGraceUnit] = useState<LegacyVaultTimeUnit>('minutes');
    const [heirs, setHeirs] = useState<HeirDraftRow[]>([
        { label: 'Heir A', address: 'tb1qheirdemo0001xyz', sharePercent: '60' },
        { label: 'Heir B', address: 'tb1qheirdemo0002xyz', sharePercent: '40' }
    ]);
    const [submitting, setSubmitting] = useState(false);

    const totalPercent = useMemo(() => {
        return heirs.reduce((sum, heir) => sum + (Number(heir.sharePercent) || 0), 0);
    }, [heirs]);

    const updateHeir = (index: number, patch: Partial<HeirDraftRow>) => {
        setHeirs((prev) => prev.map((heir, i) => (i === index ? { ...heir, ...patch } : heir)));
    };

    const addHeir = () => {
        setHeirs((prev) => [...prev, { label: `Heir ${String.fromCharCode(65 + prev.length)}`, address: '', sharePercent: '0' }]);
    };

    const removeHeir = (index: number) => {
        setHeirs((prev) => prev.filter((_, i) => i !== index));
    };

    const buildInput = (): LegacyVaultCreateInput => ({
        label,
        amountSats: Number(amountSats),
        heirs: heirs.map((heir) => ({
            label: heir.label,
            address: heir.address,
            shareBps: Math.round((Number(heir.sharePercent) || 0) * 100)
        })),
        interval: {
            value: Number(intervalValue),
            unit: intervalUnit
        },
        grace: {
            value: Number(graceValue),
            unit: graceUnit
        },
        mode: 'opnet-managed'
    });

    const handleContinue = async () => {
        setSubmitting(true);
        try {
            const draft = buildInput();
            const validation = await wallet.legacyVault_createDraft(draft);
            if (!validation.ok || !validation.normalized) {
                tools.toastError(validation.errors?.[0] || 'Invalid vault draft');
                return;
            }

            setDraft(validation.normalized);
            navigate(RouteTypes.LegacyVaultReviewScreen, { draft: validation.normalized });
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to validate vault draft');
        } finally {
            setSubmitting(false);
        }
    };

    const renderNumberInput = (
        value: string,
        onChange: (e: ChangeEvent<HTMLInputElement>) => void,
        placeholder: string,
        min?: number
    ) => (
        <input type="number" min={min} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} />
    );

    return (
        <Layout>
            <Header onBack={() => window.history.go(-1)} title="Create Legacy Vault" />
            <div style={pageContainerStyle}>
                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>Vault Basics</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div>
                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginBottom: '4px' }}>Label</div>
                            <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
                        </div>
                        <div>
                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginBottom: '4px' }}>Amount (sats)</div>
                            {renderNumberInput(amountSats, (e) => setAmountSats(e.target.value), 'Amount in sats', 1)}
                        </div>
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                        Heirs & Percentages
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {heirs.map((heir, index) => (
                            <div key={`${index}-${heir.label}`} style={{ border: `1px solid ${lvColors.border}`, borderRadius: '10px', padding: '8px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                    <input
                                        value={heir.label}
                                        onChange={(e) => updateHeir(index, { label: e.target.value })}
                                        placeholder="Heir label"
                                        style={inputStyle}
                                    />
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        value={heir.sharePercent}
                                        onChange={(e) => updateHeir(index, { sharePercent: e.target.value })}
                                        placeholder="Share %"
                                        style={inputStyle}
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        value={heir.address}
                                        onChange={(e) => updateHeir(index, { address: e.target.value })}
                                        placeholder="Heir address (testnet/demo)"
                                        style={{ ...inputStyle, flex: 1 }}
                                    />
                                    <button
                                        style={secondaryButtonStyle}
                                        disabled={heirs.length <= 1}
                                        onClick={() => removeHeir(index)}>
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <button style={secondaryButtonStyle} onClick={addHeir} disabled={heirs.length >= 10}>
                            Add Heir
                        </button>
                        <div
                            style={{
                                color: Math.abs(totalPercent - 100) < 0.001 ? lvColors.success : lvColors.warning,
                                fontSize: '11px',
                                fontWeight: 700
                            }}>
                            Total: {totalPercent.toFixed(2)}%
                        </div>
                    </div>
                </div>

                <div style={{ ...panelStyle, marginBottom: '12px' }}>
                    <div style={{ color: lvColors.text, fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                        Check-in Policy (Demo Fast Mode Friendly)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginBottom: '4px' }}>Interval</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {renderNumberInput(intervalValue, (e) => setIntervalValue(e.target.value), 'Value', 1)}
                                <select
                                    value={intervalUnit}
                                    onChange={(e) => setIntervalUnit(e.target.value as LegacyVaultTimeUnit)}
                                    style={{ ...inputStyle, width: '45%' }}>
                                    {UNIT_OPTIONS.map((unit) => (
                                        <option key={unit} value={unit}>
                                            {unit}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <div style={{ color: lvColors.textMuted, fontSize: '10px', marginBottom: '4px' }}>Grace</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {renderNumberInput(graceValue, (e) => setGraceValue(e.target.value), 'Value', 0)}
                                <select
                                    value={graceUnit}
                                    onChange={(e) => setGraceUnit(e.target.value as LegacyVaultTimeUnit)}
                                    style={{ ...inputStyle, width: '45%' }}>
                                    {UNIT_OPTIONS.map((unit) => (
                                        <option key={unit} value={unit}>
                                            {unit}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div style={{ color: lvColors.textMuted, fontSize: '10px', marginTop: '8px', lineHeight: 1.4 }}>
                        Tip: use 1 minute interval + 1 minute grace for live demos. Then wait or miss a check-in to trigger and claim.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                    <button style={primaryButtonStyle} onClick={() => void handleContinue()} disabled={submitting}>
                        {submitting ? 'Validating...' : 'Continue to Review'}
                    </button>
                    <button style={secondaryButtonStyle} onClick={() => navigate(RouteTypes.LegacyVaultHomeScreen)}>
                        Cancel
                    </button>
                </div>
            </div>
        </Layout>
    );
}
