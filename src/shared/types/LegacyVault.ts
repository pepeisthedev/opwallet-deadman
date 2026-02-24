export type LegacyVaultMode = 'opnet-managed';

export type LegacyVaultTimeUnit = 'minutes' | 'hours' | 'days';

export type LegacyVaultStatus = 'ACTIVE' | 'OVERDUE' | 'TRIGGERED' | 'CLAIMABLE' | 'CLAIMED' | 'ERROR';

export interface LegacyVaultHeirInput {
    label?: string;
    address: string;
    shareBps: number;
}

export interface LegacyVaultCreateInput {
    label: string;
    amountSats: number;
    heirs: LegacyVaultHeirInput[];
    interval: {
        value: number;
        unit: LegacyVaultTimeUnit;
    };
    grace: {
        value: number;
        unit: LegacyVaultTimeUnit;
    };
    mode: LegacyVaultMode;
}

export interface LegacyVaultTxRefs {
    createdTxId?: string;
    lastCheckInTxId?: string;
    triggerTxId?: string;
    claimTxId?: string;
    lastReceiptId?: string;
}

export interface LegacyVaultSummary {
    vaultId: string;
    label: string;
    mode: LegacyVaultMode;
    status: LegacyVaultStatus;
    nextDeadlineTs: number;
    lastCheckInTs: number;
    amountSats: number;
    heirsCount: number;
}

export interface LegacyVaultDetails extends LegacyVaultSummary {
    createdAtTs: number;
    triggeredAtTs?: number;
    claimedAtTs?: number;
    intervalSec: number;
    graceSec: number;
    ownerAddress?: string;
    heirs: LegacyVaultHeirInput[];
    txRefs: LegacyVaultTxRefs;
    notes?: string;
}

export interface LegacyVaultDraftResult {
    ok: boolean;
    normalized?: LegacyVaultCreateInput;
    errors?: string[];
}

export interface LegacyVaultActionResult {
    ok: boolean;
    vaultId?: string;
    txid?: string;
    receiptId?: string;
    statusAfter?: LegacyVaultStatus;
    error?: string;
}

export interface LegacyVaultCreateResult extends LegacyVaultActionResult {
    vault?: LegacyVaultDetails;
}
