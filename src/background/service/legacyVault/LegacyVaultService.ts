import { storage } from '@/background/webapi';
import {
    LegacyVaultActionResult,
    LegacyVaultCreateInput,
    LegacyVaultCreateResult,
    LegacyVaultDetails,
    LegacyVaultDraftResult,
    LegacyVaultStatus,
    LegacyVaultSummary,
    LegacyVaultTimeUnit
} from '@/shared/types/LegacyVault';

interface LegacyVaultRecord {
    vaultId: string;
    label: string;
    mode: 'opnet-managed';
    amountSats: number;
    heirs: LegacyVaultCreateInput['heirs'];
    intervalSec: number;
    graceSec: number;
    createdAtTs: number;
    lastCheckInTs: number;
    triggeredAtTs?: number;
    claimedAtTs?: number;
    ownerAddress?: string;
    metadataHashHex?: string;
    txRefs: LegacyVaultDetails['txRefs'];
    notes?: string;
    updatedAtTs: number;
}

interface LegacyVaultStore {
    version: number;
    vaults: Record<string, LegacyVaultRecord>;
    order: string[];
}

const STORAGE_KEY = 'legacyVaultStore';
const STORE_VERSION = 1;
const BPS_TOTAL = 10000;

const DEFAULT_STORE: LegacyVaultStore = {
    version: STORE_VERSION,
    vaults: {},
    order: []
};

const UNIT_TO_SECONDS: Record<LegacyVaultTimeUnit, number> = {
    minutes: 60,
    hours: 60 * 60,
    days: 60 * 60 * 24
};

class LegacyVaultService {
    private store: LegacyVaultStore | null = null;

    private async ensureLoaded(): Promise<void> {
        if (this.store) {
            return;
        }

        const saved = await storage.get<LegacyVaultStore>(STORAGE_KEY);
        if (!saved || typeof saved !== 'object' || !saved.vaults || !Array.isArray(saved.order)) {
            this.store = { version: STORE_VERSION, vaults: {}, order: [] };
            await this.persist();
            return;
        }

        this.store = {
            version: typeof saved.version === 'number' ? saved.version : STORE_VERSION,
            vaults: saved.vaults,
            order: saved.order
        };
    }

    private async persist(): Promise<void> {
        if (!this.store) {
            return;
        }
        await storage.set(STORAGE_KEY, this.store);
    }

    private now(): number {
        return Date.now();
    }

    private makeId(prefix: string): string {
        const suffix = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
        return `${prefix}_${suffix}`;
    }

    private validateAndNormalize(input: LegacyVaultCreateInput): LegacyVaultDraftResult {
        const errors: string[] = [];

        const normalizedLabel = (input.label || '').trim();
        const normalizedHeirs = (input.heirs || [])
            .map((heir) => ({
                label: heir.label?.trim() || '',
                address: heir.address.trim(),
                shareBps: Math.trunc(heir.shareBps)
            }))
            .filter((heir) => heir.address !== '');

        if (!normalizedLabel) {
            errors.push('Vault label is required.');
        }

        if (!Number.isFinite(input.amountSats) || input.amountSats <= 0) {
            errors.push('Amount must be a positive number of sats.');
        }

        if (normalizedHeirs.length < 1 || normalizedHeirs.length > 10) {
            errors.push('Add between 1 and 10 heirs.');
        }

        const duplicateAddresses = new Set<string>();
        const seenAddresses = new Set<string>();
        for (const heir of normalizedHeirs) {
            if (heir.address.length < 8) {
                errors.push(`Invalid heir address: ${heir.address || '(empty)'}`);
            }
            if (!Number.isInteger(heir.shareBps) || heir.shareBps <= 0) {
                errors.push(`Invalid share for heir ${heir.label || heir.address}.`);
            }
            const key = heir.address.toLowerCase();
            if (seenAddresses.has(key)) {
                duplicateAddresses.add(heir.address);
            }
            seenAddresses.add(key);
        }

        if (duplicateAddresses.size > 0) {
            errors.push('Duplicate heir addresses are not allowed.');
        }

        const totalBps = normalizedHeirs.reduce((sum, heir) => sum + heir.shareBps, 0);
        if (totalBps !== BPS_TOTAL) {
            errors.push(`Heir percentages must sum to 100.00% (${BPS_TOTAL} bps).`);
        }

        const intervalValue = Math.trunc(input.interval?.value ?? 0);
        const graceValue = Math.trunc(input.grace?.value ?? 0);
        const intervalUnit = input.interval?.unit;
        const graceUnit = input.grace?.unit;

        if (!intervalUnit || !(intervalUnit in UNIT_TO_SECONDS) || intervalValue <= 0) {
            errors.push('Check-in interval must be a positive duration.');
        }
        if (!graceUnit || !(graceUnit in UNIT_TO_SECONDS) || graceValue < 0) {
            errors.push('Grace period must be zero or a positive duration.');
        }

        if (input.mode !== 'opnet-managed') {
            errors.push('Only OP_NET-managed mode is supported in this MVP.');
        }

        if (errors.length > 0) {
            return { ok: false, errors };
        }

        return {
            ok: true,
            normalized: {
                label: normalizedLabel,
                amountSats: Math.trunc(input.amountSats),
                heirs: normalizedHeirs,
                interval: {
                    value: intervalValue,
                    unit: intervalUnit
                },
                grace: {
                    value: graceValue,
                    unit: graceUnit
                },
                mode: 'opnet-managed'
            }
        };
    }

    private deriveStatus(record: LegacyVaultRecord, nowTs: number = this.now()): LegacyVaultStatus {
        if (record.claimedAtTs) {
            return 'CLAIMED';
        }
        if (record.triggeredAtTs) {
            return 'CLAIMABLE';
        }

        const deadline = record.lastCheckInTs + (record.intervalSec + record.graceSec) * 1000;
        if (nowTs > deadline) {
            return 'OVERDUE';
        }

        return 'ACTIVE';
    }

    private toSummary(record: LegacyVaultRecord): LegacyVaultSummary {
        return {
            vaultId: record.vaultId,
            label: record.label,
            mode: record.mode,
            status: this.deriveStatus(record),
            nextDeadlineTs: record.lastCheckInTs + (record.intervalSec + record.graceSec) * 1000,
            lastCheckInTs: record.lastCheckInTs,
            amountSats: record.amountSats,
            heirsCount: record.heirs.length
        };
    }

    private toDetails(record: LegacyVaultRecord): LegacyVaultDetails {
        const summary = this.toSummary(record);
        return {
            ...summary,
            createdAtTs: record.createdAtTs,
            triggeredAtTs: record.triggeredAtTs,
            claimedAtTs: record.claimedAtTs,
            intervalSec: record.intervalSec,
            graceSec: record.graceSec,
            ownerAddress: record.ownerAddress,
            heirs: [...record.heirs],
            txRefs: { ...record.txRefs },
            notes: record.notes
        };
    }

    public createDraft(input: LegacyVaultCreateInput): LegacyVaultDraftResult {
        return this.validateAndNormalize(input);
    }

    public async listVaults(): Promise<LegacyVaultSummary[]> {
        await this.ensureLoaded();
        const store = this.store || DEFAULT_STORE;
        const orderedRecords = store.order
            .map((vaultId) => store.vaults[vaultId])
            .filter((record): record is LegacyVaultRecord => !!record);

        return orderedRecords.map((record) => this.toSummary(record));
    }

    public async getVault(vaultId: string): Promise<LegacyVaultDetails | null> {
        await this.ensureLoaded();
        const record = this.store?.vaults[vaultId];
        return record ? this.toDetails(record) : null;
    }

    public async finalizeAndCreateVault(
        input: LegacyVaultCreateInput,
        ownerAddress?: string
    ): Promise<LegacyVaultCreateResult> {
        await this.ensureLoaded();

        const validation = this.validateAndNormalize(input);
        if (!validation.ok || !validation.normalized) {
            return {
                ok: false,
                error: validation.errors?.join(' ') || 'Invalid vault parameters.'
            };
        }

        const nowTs = this.now();
        const vaultId = this.makeId('lv');
        const txid = this.makeId('tx');
        const receiptId = this.makeId('rcpt');

        const intervalSec = validation.normalized.interval.value * UNIT_TO_SECONDS[validation.normalized.interval.unit];
        const graceSec = validation.normalized.grace.value * UNIT_TO_SECONDS[validation.normalized.grace.unit];

        const record: LegacyVaultRecord = {
            vaultId,
            label: validation.normalized.label,
            mode: 'opnet-managed',
            amountSats: validation.normalized.amountSats,
            heirs: validation.normalized.heirs,
            intervalSec,
            graceSec,
            createdAtTs: nowTs,
            lastCheckInTs: nowTs,
            ownerAddress,
            txRefs: {
                createdTxId: txid,
                lastReceiptId: receiptId
            },
            notes: 'Demo MVP vault (local state, OP_NET integration seam ready).',
            updatedAtTs: nowTs
        };

        this.store!.vaults[vaultId] = record;
        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();

        const details = this.toDetails(record);
        return {
            ok: true,
            vaultId,
            txid,
            receiptId,
            statusAfter: details.status,
            vault: details
        };
    }

    /**
     * Cache metadata for an OP_NET-backed vault created on-chain.
     * The contract is the source of truth for lifecycle state; this local record stores
     * UI metadata (label/amount/heir labels) and tx references only.
     */
    public async cacheContractVaultCreate(
        vaultId: string,
        input: LegacyVaultCreateInput,
        ownerAddress?: string,
        txid?: string,
        receiptId?: string,
        metadataHashHex?: string
    ): Promise<LegacyVaultDetails | null> {
        await this.ensureLoaded();

        const validation = this.validateAndNormalize(input);
        if (!validation.ok || !validation.normalized) {
            return null;
        }

        const nowTs = this.now();
        const intervalSec = validation.normalized.interval.value * UNIT_TO_SECONDS[validation.normalized.interval.unit];
        const graceSec = validation.normalized.grace.value * UNIT_TO_SECONDS[validation.normalized.grace.unit];

        const existing = this.store!.vaults[vaultId];
        const record: LegacyVaultRecord = {
            vaultId,
            label: validation.normalized.label,
            mode: 'opnet-managed',
            amountSats: validation.normalized.amountSats,
            heirs: validation.normalized.heirs,
            intervalSec,
            graceSec,
            createdAtTs: existing?.createdAtTs ?? nowTs,
            lastCheckInTs: existing?.lastCheckInTs ?? nowTs,
            triggeredAtTs: existing?.triggeredAtTs,
            claimedAtTs: existing?.claimedAtTs,
            ownerAddress: ownerAddress ?? existing?.ownerAddress,
            metadataHashHex: metadataHashHex ?? existing?.metadataHashHex,
            txRefs: {
                ...existing?.txRefs,
                ...(txid ? { createdTxId: txid } : {}),
                ...(receiptId ? { lastReceiptId: receiptId } : {})
            },
            notes: 'OP_NET contract-backed vault (local metadata mirror for UI labels/amount).',
            updatedAtTs: nowTs
        };

        this.store!.vaults[vaultId] = record;
        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();

        return this.toDetails(record);
    }

    /**
     * Ensure a local metadata mirror exists for a contract-backed vault discovered on-chain.
     * This is important on heir wallets where the vault was created from another device/profile.
     */
    public async ensureContractVaultMirror(details: LegacyVaultDetails): Promise<void> {
        await this.ensureLoaded();

        if (this.store?.vaults[details.vaultId]) {
            return;
        }

        const nowTs = this.now();
        const record: LegacyVaultRecord = {
            vaultId: details.vaultId,
            label: details.label || `Vault #${details.vaultId}`,
            mode: 'opnet-managed',
            amountSats: details.amountSats || 0,
            heirs: (details.heirs || []).map((heir) => ({
                label: heir.label?.trim() || '',
                address: heir.address,
                shareBps: Math.trunc(heir.shareBps)
            })),
            intervalSec: details.intervalSec || 0,
            graceSec: details.graceSec || 0,
            createdAtTs: details.createdAtTs || nowTs,
            lastCheckInTs: details.lastCheckInTs || nowTs,
            triggeredAtTs: details.triggeredAtTs,
            claimedAtTs: details.claimedAtTs,
            ownerAddress: details.ownerAddress,
            txRefs: { ...(details.txRefs || {}) },
            notes:
                details.notes ||
                'OP_NET contract-backed vault (local metadata mirror for UI labels/amount).',
            updatedAtTs: nowTs
        };

        this.store!.vaults[details.vaultId] = record;
        this.store!.order = [details.vaultId, ...this.store!.order.filter((id) => id !== details.vaultId)];
        await this.persist();
    }

    /**
     * Update locally cached tx references for a contract-backed vault.
     * No-op if the vault metadata is not cached on this device.
     */
    public async updateVaultTxRefs(
        vaultId: string,
        txRefsPatch: Partial<LegacyVaultDetails['txRefs']>,
        timestampPatch?: Partial<Pick<LegacyVaultRecord, 'lastCheckInTs' | 'triggeredAtTs' | 'claimedAtTs'>>
    ): Promise<void> {
        await this.ensureLoaded();

        const record = this.store?.vaults[vaultId];
        if (!record) {
            return;
        }

        const nowTs = this.now();
        record.txRefs = {
            ...record.txRefs,
            ...txRefsPatch
        };

        if (timestampPatch && Object.prototype.hasOwnProperty.call(timestampPatch, 'lastCheckInTs')) {
            if (typeof timestampPatch.lastCheckInTs === 'number') {
                record.lastCheckInTs = timestampPatch.lastCheckInTs;
            }
        }
        if (timestampPatch && Object.prototype.hasOwnProperty.call(timestampPatch, 'triggeredAtTs')) {
            record.triggeredAtTs = timestampPatch.triggeredAtTs;
        }
        if (timestampPatch && Object.prototype.hasOwnProperty.call(timestampPatch, 'claimedAtTs')) {
            record.claimedAtTs = timestampPatch.claimedAtTs;
        }

        record.updatedAtTs = nowTs;
        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();
    }

    public async checkIn(vaultId: string): Promise<LegacyVaultActionResult> {
        await this.ensureLoaded();
        const record = this.store?.vaults[vaultId];
        if (!record) {
            return { ok: false, error: 'Vault not found.' };
        }

        if (record.claimedAtTs) {
            return { ok: false, error: 'Vault is already claimed.' };
        }

        const nowTs = this.now();
        const txid = this.makeId('tx');
        const receiptId = this.makeId('rcpt');

        record.lastCheckInTs = nowTs;
        record.triggeredAtTs = undefined;
        record.updatedAtTs = nowTs;
        record.txRefs = {
            ...record.txRefs,
            lastCheckInTxId: txid,
            lastReceiptId: receiptId
        };

        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();

        return {
            ok: true,
            vaultId,
            txid,
            receiptId,
            statusAfter: this.deriveStatus(record)
        };
    }

    public async trigger(vaultId: string): Promise<LegacyVaultActionResult> {
        await this.ensureLoaded();
        const record = this.store?.vaults[vaultId];
        if (!record) {
            return { ok: false, error: 'Vault not found.' };
        }

        if (record.claimedAtTs) {
            return { ok: false, error: 'Vault is already claimed.' };
        }

        if (record.triggeredAtTs) {
            return {
                ok: true,
                vaultId,
                statusAfter: this.deriveStatus(record)
            };
        }

        if (this.deriveStatus(record) !== 'OVERDUE') {
            return { ok: false, error: 'Vault is not overdue yet.' };
        }

        const nowTs = this.now();
        const txid = this.makeId('tx');
        const receiptId = this.makeId('rcpt');

        record.triggeredAtTs = nowTs;
        record.updatedAtTs = nowTs;
        record.txRefs = {
            ...record.txRefs,
            triggerTxId: txid,
            lastReceiptId: receiptId
        };

        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();

        return {
            ok: true,
            vaultId,
            txid,
            receiptId,
            statusAfter: this.deriveStatus(record)
        };
    }

    public async claim(vaultId: string): Promise<LegacyVaultActionResult> {
        await this.ensureLoaded();
        const record = this.store?.vaults[vaultId];
        if (!record) {
            return { ok: false, error: 'Vault not found.' };
        }

        if (record.claimedAtTs) {
            return { ok: false, error: 'Vault is already claimed.' };
        }

        const status = this.deriveStatus(record);
        if (status !== 'CLAIMABLE' && status !== 'TRIGGERED') {
            return { ok: false, error: 'Vault must be triggered before claiming.' };
        }

        const nowTs = this.now();
        const txid = this.makeId('tx');
        const receiptId = this.makeId('rcpt');

        record.claimedAtTs = nowTs;
        record.updatedAtTs = nowTs;
        record.txRefs = {
            ...record.txRefs,
            claimTxId: txid,
            lastReceiptId: receiptId
        };

        this.store!.order = [vaultId, ...this.store!.order.filter((id) => id !== vaultId)];
        await this.persist();

        return {
            ok: true,
            vaultId,
            txid,
            receiptId,
            statusAfter: this.deriveStatus(record)
        };
    }

    public async refreshVault(vaultId: string): Promise<LegacyVaultDetails | null> {
        return this.getVault(vaultId);
    }
}

export default new LegacyVaultService();
