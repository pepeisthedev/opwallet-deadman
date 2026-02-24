import { CSSProperties } from 'react';

import { LegacyVaultStatus } from '@/shared/types/LegacyVault';

export const lvColors = {
    main: '#f37413',
    background: '#212121',
    text: '#dbdbdb',
    textMuted: 'rgba(219, 219, 219, 0.7)',
    panel: '#2a2a2a',
    panelAlt: '#303030',
    border: '#3a3a3a',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#ef4444',
    info: '#60a5fa'
} as const;

export const pageContainerStyle: CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '12px',
    paddingBottom: '24px',
    background: lvColors.background
};

export const panelStyle: CSSProperties = {
    background: lvColors.panel,
    border: `1px solid ${lvColors.border}`,
    borderRadius: '12px',
    padding: '12px'
};

export const inputStyle: CSSProperties = {
    width: '100%',
    background: '#1f1f1f',
    color: lvColors.text,
    border: `1px solid ${lvColors.border}`,
    borderRadius: '8px',
    padding: '8px 10px',
    fontSize: '12px',
    outline: 'none'
};

export const primaryButtonStyle: CSSProperties = {
    background: lvColors.main,
    color: '#111',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
};

export const secondaryButtonStyle: CSSProperties = {
    background: lvColors.panelAlt,
    color: lvColors.text,
    border: `1px solid ${lvColors.border}`,
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer'
};

export const dangerButtonStyle: CSSProperties = {
    ...secondaryButtonStyle,
    border: `1px solid ${lvColors.danger}55`,
    color: lvColors.danger
};

export function statusColor(status: LegacyVaultStatus): string {
    switch (status) {
        case 'ACTIVE':
            return lvColors.success;
        case 'OVERDUE':
            return lvColors.warning;
        case 'TRIGGERED':
        case 'CLAIMABLE':
            return lvColors.info;
        case 'CLAIMED':
            return lvColors.textMuted;
        case 'ERROR':
        default:
            return lvColors.danger;
    }
}

export function formatTimestamp(ts?: number): string {
    if (!ts) return '—';
    try {
        return new Date(ts).toLocaleString();
    } catch {
        return String(ts);
    }
}

export function formatSats(amountSats: number): string {
    return `${amountSats.toLocaleString('en-US')} sats`;
}

export function formatPercentFromBps(bps: number): string {
    return `${(bps / 100).toFixed(2)}%`;
}

export function formatDurationSec(sec: number): string {
    if (sec % 86400 === 0) return `${sec / 86400}d`;
    if (sec % 3600 === 0) return `${sec / 3600}h`;
    if (sec % 60 === 0) return `${sec / 60}m`;
    return `${sec}s`;
}
