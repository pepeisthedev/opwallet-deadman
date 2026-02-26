import { u256 } from '@btc-vision/as-bignum/assembly';
import {
    Address,
    Blockchain,
    BytesReader,
    BytesWriter,
    Calldata,
    EMPTY_POINTER,
    NetEvent,
    OP_NET,
    Revert,
    StoredU256,
    bigEndianAdd,
    encodePointerUnknownLength
} from '@btc-vision/btc-runtime/runtime';

// NOTE:
// - Decorators (@method, @returns, @emit, @final) and ABIDataTypes are compile-time globals.
// - This contract is a policy/state-machine layer for the Legacy Vault MVP.
// - It does NOT enforce Bitcoin L1 custody.
// - Time-based logic uses block heights (Blockchain.block.number), not medianTimestamp.
//   The wallet should convert UX time units (days/weeks) into block counts before calling createVault().

const STATUS_ACTIVE: u8 = 1;
const STATUS_TRIGGERED: u8 = 2;
const STATUS_CLAIMED: u8 = 3;

const RECORD_VERSION: u8 = 1;
const MAX_HEIRS: i32 = 10;
const TOTAL_BPS: u32 = 10000;
const MAX_METADATA_BYTES: i32 = 512;
const MAX_PAYOUT_REF_BYTES: i32 = 200;
const MAX_RECORD_BYTES: i32 = 4096;
const MAX_OWNER_INDEX_BYTES: i32 = 4096;
const EMPTY_BYTES: Uint8Array = new Uint8Array(0);
const EMPTY_BYTES32: Uint8Array = new Uint8Array(32);

// Storage pointer IDs must be module-level constants so they remain stable across executions.
const NEXT_VAULT_ID_POINTER: u16 = Blockchain.nextPointer;
const VAULT_RECORD_POINTER: u16 = Blockchain.nextPointer;
const OWNER_VAULT_INDEX_POINTER: u16 = Blockchain.nextPointer;

class VaultRecord {
    public owner: Address = Address.zero();
    public status: u8 = STATUS_ACTIVE;
    public createdAtBlock: u64 = 0;
    public lastCheckInBlock: u64 = 0;
    public triggeredAtBlock: u64 = 0;
    public claimedAtBlock: u64 = 0;
    public intervalBlocks: u64 = 0;
    public graceBlocks: u64 = 0;
    public heirs: Address[] = [];
    public sharesBps: u16[] = [];
    public metadataHash: Uint8Array = EMPTY_BYTES32;
    public payoutRef: Uint8Array = EMPTY_BYTES;
}

@final
class VaultCreatedEvent extends NetEvent {
    public constructor(vaultId: u256, owner: Address, blockNum: u64) {
        const data = new BytesWriter(32 + 32 + 8);
        data.writeU256(vaultId);
        data.writeAddress(owner);
        data.writeU64(blockNum);
        super('VaultCreated', data);
    }
}

@final
class CheckedInEvent extends NetEvent {
    public constructor(vaultId: u256, owner: Address, blockNum: u64) {
        const data = new BytesWriter(32 + 32 + 8);
        data.writeU256(vaultId);
        data.writeAddress(owner);
        data.writeU64(blockNum);
        super('CheckedIn', data);
    }
}

@final
class TriggeredEvent extends NetEvent {
    public constructor(vaultId: u256, triggeredBy: Address, blockNum: u64) {
        const data = new BytesWriter(32 + 32 + 8);
        data.writeU256(vaultId);
        data.writeAddress(triggeredBy);
        data.writeU64(blockNum);
        super('Triggered', data);
    }
}

@final
class ClaimFinalizedEvent extends NetEvent {
    public constructor(vaultId: u256, finalizedBy: Address, blockNum: u64, payoutRef: Uint8Array) {
        const data = new BytesWriter(32 + 32 + 8 + 4 + payoutRef.length);
        data.writeU256(vaultId);
        data.writeAddress(finalizedBy);
        data.writeU64(blockNum);
        data.writeBytesWithLength(payoutRef);
        super('ClaimFinalized', data);
    }
}

@final
export class LegacyVaultStateMachine extends OP_NET {
    private _nextVaultId: StoredU256 = new StoredU256(0, EMPTY_POINTER);

    public constructor() {
        super();
        this._nextVaultId = new StoredU256(NEXT_VAULT_ID_POINTER, EMPTY_POINTER);
    }

    public override onDeployment(_: Calldata): void {
        // No initialization required. Stored values default to zero.
    }

    @method(
        { name: 'heirs', type: ABIDataTypes.ARRAY_OF_ADDRESSES },
        { name: 'sharesBps', type: ABIDataTypes.ARRAY_OF_UINT16 },
        { name: 'intervalSec', type: ABIDataTypes.UINT64 },
        { name: 'graceSec', type: ABIDataTypes.UINT64 },
        { name: 'metadataHash', type: ABIDataTypes.BYTES32 }
    )
    @returns({ name: 'vaultId', type: ABIDataTypes.UINT256 })
    @emit('VaultCreated')
    public createVault(calldata: Calldata): BytesWriter {
        const heirs = calldata.readAddressArray();
        const shares = calldata.readU16Array();
        const intervalBlocks = calldata.readU64();
        const graceBlocks = calldata.readU64();
        const metadataHash = calldata.readBytes(32);

        this.validateCreateInputs(heirs, shares, intervalBlocks, graceBlocks, metadataHash);

        const vaultId = this.nextVaultId();
        const nowBlock = Blockchain.block.number;
        const sender = Blockchain.tx.sender;

        const record = new VaultRecord();
        record.owner = sender;
        record.status = STATUS_ACTIVE;
        record.createdAtBlock = nowBlock;
        record.lastCheckInBlock = nowBlock;
        record.intervalBlocks = intervalBlocks;
        record.graceBlocks = graceBlocks;
        record.heirs = heirs;
        record.sharesBps = shares;
        record.metadataHash = metadataHash;
        record.payoutRef = EMPTY_BYTES;

        this.saveVault(vaultId, record);
        this.appendOwnerVaultId(sender, vaultId);
        this.emitEvent(new VaultCreatedEvent(vaultId, sender, nowBlock));

        const writer = new BytesWriter(32);
        writer.writeU256(vaultId);
        return writer;
    }

    @method({ name: 'vaultId', type: ABIDataTypes.UINT256 })
    @returns(
        { name: 'exists', type: ABIDataTypes.BOOL },
        { name: 'owner', type: ABIDataTypes.ADDRESS },
        { name: 'status', type: ABIDataTypes.UINT8 },
        { name: 'createdAtBlock', type: ABIDataTypes.UINT64 },
        { name: 'lastCheckInBlock', type: ABIDataTypes.UINT64 },
        { name: 'triggeredAtBlock', type: ABIDataTypes.UINT64 },
        { name: 'claimedAtBlock', type: ABIDataTypes.UINT64 },
        { name: 'intervalBlocks', type: ABIDataTypes.UINT64 },
        { name: 'graceBlocks', type: ABIDataTypes.UINT64 },
        { name: 'heirs', type: ABIDataTypes.ARRAY_OF_ADDRESSES },
        { name: 'sharesBps', type: ABIDataTypes.ARRAY_OF_UINT16 },
        { name: 'metadataHash', type: ABIDataTypes.BYTES32 },
        { name: 'payoutRef', type: ABIDataTypes.BYTES }
    )
    public getVault(calldata: Calldata): BytesWriter {
        const vaultId = calldata.readU256();
        const record = this.loadVault(vaultId);

        const writer = new BytesWriter(2048);
        if (record == null) {
            const emptyHeirs = new Array<Address>();
            const emptyShares = new Array<u16>();
            writer.writeBoolean(false);
            writer.writeAddress(Address.zero());
            writer.writeU8(0);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeAddressArray(emptyHeirs);
            writer.writeU16Array(emptyShares);
            writer.writeBytes(EMPTY_BYTES32);
            writer.writeBytesWithLength(EMPTY_BYTES);
            return writer;
        }

        writer.writeBoolean(true);
        writer.writeAddress(record.owner);
        writer.writeU8(record.status);
        writer.writeU64(record.createdAtBlock);
        writer.writeU64(record.lastCheckInBlock);
        writer.writeU64(record.triggeredAtBlock);
        writer.writeU64(record.claimedAtBlock);
        writer.writeU64(record.intervalBlocks);
        writer.writeU64(record.graceBlocks);
        writer.writeAddressArray(record.heirs);
        writer.writeU16Array(record.sharesBps);
        writer.writeBytes(record.metadataHash);
        writer.writeBytesWithLength(record.payoutRef);
        return writer;
    }

    @method({ name: 'owner', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'vaultIds', type: ABIDataTypes.ARRAY_OF_UINT256 })
    public getVaultIdsByOwner(calldata: Calldata): BytesWriter {
        const owner = calldata.readAddress();
        const vaultIds = this.loadOwnerVaultIds(owner);

        const writer = new BytesWriter(2 + vaultIds.length * 32);
        writer.writeU256Array(vaultIds);
        return writer;
    }

    @method({ name: 'vaultId', type: ABIDataTypes.UINT256 })
    @emit('CheckedIn')
    public checkIn(calldata: Calldata): BytesWriter {
        const vaultId = calldata.readU256();
        const record = this.requireVault(vaultId);
        this.requireNotClaimed(record);
        this.requireOwner(record);

        const nowBlock = Blockchain.block.number;
        record.lastCheckInBlock = nowBlock;
        record.triggeredAtBlock = 0;
        record.status = STATUS_ACTIVE;

        this.saveVault(vaultId, record);
        this.emitEvent(new CheckedInEvent(vaultId, Blockchain.tx.sender, nowBlock));

        return new BytesWriter(0);
    }

    @method({ name: 'vaultId', type: ABIDataTypes.UINT256 })
    @emit('Triggered')
    public trigger(calldata: Calldata): BytesWriter {
        const vaultId = calldata.readU256();
        const record = this.requireVault(vaultId);
        this.requireNotClaimed(record);

        if (record.status == STATUS_TRIGGERED) {
            // Idempotent no-op for watchtower compatibility.
            return new BytesWriter(0);
        }

        const nowBlock = Blockchain.block.number;
        if (!this.isOverdue(record, nowBlock)) {
            throw new Revert('Vault is not overdue yet');
        }

        record.status = STATUS_TRIGGERED;
        if (record.triggeredAtBlock == 0) {
            record.triggeredAtBlock = nowBlock;
        }

        this.saveVault(vaultId, record);
        this.emitEvent(new TriggeredEvent(vaultId, Blockchain.tx.sender, nowBlock));

        return new BytesWriter(0);
    }

    @method({ name: 'vaultId', type: ABIDataTypes.UINT256 }, { name: 'payoutRef', type: ABIDataTypes.BYTES })
    @emit('ClaimFinalized')
    public finalizeClaim(calldata: Calldata): BytesWriter {
        const vaultId = calldata.readU256();
        const payoutRef = calldata.readBytesWithLength();

        if (payoutRef.length > MAX_PAYOUT_REF_BYTES) {
            throw new Revert('payoutRef too large');
        }

        const record = this.requireVault(vaultId);
        this.requireNotClaimed(record);

        if (record.status != STATUS_TRIGGERED) {
            throw new Revert('Vault must be triggered before claim');
        }

        const nowBlock = Blockchain.block.number;
        record.status = STATUS_CLAIMED;
        record.claimedAtBlock = nowBlock;
        record.payoutRef = payoutRef;

        this.saveVault(vaultId, record);
        this.emitEvent(new ClaimFinalizedEvent(vaultId, Blockchain.tx.sender, nowBlock, payoutRef));

        return new BytesWriter(0);
    }

    private nextVaultId(): u256 {
        const next = this._nextVaultId.value + u256.from(1);
        this._nextVaultId.value = next;
        return next;
    }

    private validateCreateInputs(
        heirs: Address[],
        shares: u16[],
        intervalBlocks: u64,
        _graceBlocks: u64,
        metadataHash: Uint8Array
    ): void {
        if (heirs.length < 1) {
            throw new Revert('At least one heir required');
        }
        if (heirs.length > MAX_HEIRS) {
            throw new Revert('Too many heirs');
        }
        if (heirs.length != shares.length) {
            throw new Revert('Heirs/shares length mismatch');
        }
        if (intervalBlocks == 0) {
            throw new Revert('Interval must be > 0');
        }
        if (metadataHash.length != 32) {
            throw new Revert('metadataHash must be 32 bytes');
        }

        let total: u32 = 0;
        for (let i = 0; i < shares.length; i++) {
            const share = shares[i];
            if (share == 0) {
                throw new Revert('Each share must be > 0');
            }
            total += share;
        }

        if (total != TOTAL_BPS) {
            throw new Revert('Shares must sum to 10000 bps');
        }

        for (let i = 0; i < heirs.length; i++) {
            if (heirs[i].isZero()) {
                throw new Revert('Heir cannot be zero address');
            }
            for (let j = i + 1; j < heirs.length; j++) {
                if (heirs[i].equals(heirs[j])) {
                    throw new Revert('Duplicate heir address');
                }
            }
        }
    }

    private requireOwner(record: VaultRecord): void {
        if (!record.owner.equals(Blockchain.tx.sender)) {
            throw new Revert('Only owner can check in');
        }
    }

    private requireNotClaimed(record: VaultRecord): void {
        if (record.status == STATUS_CLAIMED || record.claimedAtBlock != 0) {
            throw new Revert('Vault already claimed');
        }
    }

    private isOverdue(record: VaultRecord, nowBlock: u64): bool {
        const deadline = record.lastCheckInBlock + record.intervalBlocks + record.graceBlocks;
        return nowBlock > deadline;
    }

    private requireVault(vaultId: u256): VaultRecord {
        const record = this.loadVault(vaultId);
        if (record == null) {
            throw new Revert('Vault not found');
        }
        return record;
    }

    private saveVault(vaultId: u256, record: VaultRecord): void {
        const writer = new BytesWriter(MAX_RECORD_BYTES);
        writer.writeU8(RECORD_VERSION);
        writer.writeU8(record.status);
        writer.writeAddress(record.owner);
        writer.writeU64(record.createdAtBlock);
        writer.writeU64(record.lastCheckInBlock);
        writer.writeU64(record.triggeredAtBlock);
        writer.writeU64(record.claimedAtBlock);
        writer.writeU64(record.intervalBlocks);
        writer.writeU64(record.graceBlocks);
        writer.writeAddressArray(record.heirs);
        writer.writeU16Array(record.sharesBps);
        writer.writeBytesWithLength(record.metadataHash);
        writer.writeBytesWithLength(record.payoutRef);
        const usedLength = writer.getOffset();
        const fullBuffer = writer.getBuffer();
        const trimmed = new Uint8Array(usedLength);
        for (let i: u32 = 0; i < usedLength; i++) {
            trimmed[i] = fullBuffer[i];
        }

        this.saveChunkedBytes(this.vaultStorageKey(vaultId), trimmed, MAX_RECORD_BYTES);
    }

    private appendOwnerVaultId(owner: Address, vaultId: u256): void {
        const vaultIds = this.loadOwnerVaultIds(owner);
        vaultIds.push(vaultId);
        this.saveOwnerVaultIds(owner, vaultIds);
    }

    private loadVault(vaultId: u256): VaultRecord | null {
        const raw = this.loadChunkedBytes(this.vaultStorageKey(vaultId), MAX_RECORD_BYTES);
        if (raw.length == 0) {
            return null;
        }

        const reader = new BytesReader(raw);
        const version = reader.readU8();
        if (version != RECORD_VERSION) {
            throw new Revert('Unsupported vault record version');
        }

        const record = new VaultRecord();
        record.status = reader.readU8();
        record.owner = reader.readAddress();
        record.createdAtBlock = reader.readU64();
        record.lastCheckInBlock = reader.readU64();
        record.triggeredAtBlock = reader.readU64();
        record.claimedAtBlock = reader.readU64();
        record.intervalBlocks = reader.readU64();
        record.graceBlocks = reader.readU64();
        record.heirs = reader.readAddressArray();
        record.sharesBps = reader.readU16Array();
        record.metadataHash = reader.readBytesWithLength();
        record.payoutRef = reader.readBytesWithLength();
        return record;
    }

    private saveOwnerVaultIds(owner: Address, vaultIds: u256[]): void {
        const writer = new BytesWriter(2 + vaultIds.length * 32);
        writer.writeU256Array(vaultIds);
        this.saveChunkedBytes(this.ownerVaultIndexStorageKey(owner), writer.getBuffer(), MAX_OWNER_INDEX_BYTES);
    }

    private loadOwnerVaultIds(owner: Address): u256[] {
        const raw = this.loadChunkedBytes(this.ownerVaultIndexStorageKey(owner), MAX_OWNER_INDEX_BYTES);
        if (raw.length == 0) {
            return new Array<u256>();
        }

        const reader = new BytesReader(raw);
        return reader.readU256Array();
    }

    private vaultStorageKey(vaultId: u256): Uint8Array {
        // Hash-derived pointer prevents slot overlap when a vault record spans multiple chunks.
        // (Sequential numeric vaultIds + bigEndianAdd(chunk) can otherwise collide across vaults.)
        return encodePointerUnknownLength(VAULT_RECORD_POINTER, vaultId.toUint8Array(true));
    }

    private ownerVaultIndexStorageKey(owner: Address): Uint8Array {
        return encodePointerUnknownLength(OWNER_VAULT_INDEX_POINTER, owner);
    }

    private chunkedStoragePointer(basePointer: Uint8Array, chunkIndex: u64): Uint8Array {
        return bigEndianAdd(basePointer, chunkIndex);
    }

    private saveChunkedBytes(basePointer: Uint8Array, value: Uint8Array, maxLength: i32): void {
        const length = <u32>value.length;
        if (length > <u32>maxLength) {
            throw new Revert('Stored blob too large');
        }

        const header = new Uint8Array(32);
        header[0] = <u8>((length >> 24) & 0xff);
        header[1] = <u8>((length >> 16) & 0xff);
        header[2] = <u8>((length >> 8) & 0xff);
        header[3] = <u8>(length & 0xff);

        let remaining: u32 = length;
        let offset: u32 = 0;
        const firstChunkSize: u32 = remaining < 28 ? remaining : 28;
        for (let i: u32 = 0; i < firstChunkSize; i++) {
            header[4 + i] = value[i];
        }

        Blockchain.setStorageAt(this.chunkedStoragePointer(basePointer, 0), header);

        remaining -= firstChunkSize;
        offset += firstChunkSize;

        let chunkIndex: u64 = 1;
        while (remaining > 0) {
            const slot = new Uint8Array(32);
            const chunkSize: u32 = remaining < 32 ? remaining : 32;
            for (let i: u32 = 0; i < chunkSize; i++) {
                slot[i] = value[offset + i];
            }

            Blockchain.setStorageAt(this.chunkedStoragePointer(basePointer, chunkIndex), slot);
            remaining -= chunkSize;
            offset += chunkSize;
            chunkIndex++;
        }
    }

    private loadChunkedBytes(basePointer: Uint8Array, maxLength: i32): Uint8Array {
        const header = Blockchain.getStorageAt(this.chunkedStoragePointer(basePointer, 0));
        const length =
            (<u32>header[0] << 24) | (<u32>header[1] << 16) | (<u32>header[2] << 8) | <u32>header[3];

        if (length == 0) {
            return new Uint8Array(0);
        }

        if (length > <u32>maxLength) {
            throw new Revert('Stored blob length invalid');
        }

        const out = new Uint8Array(length);
        let remaining: u32 = length;
        let offset: u32 = 0;

        const firstChunkSize: u32 = remaining < 28 ? remaining : 28;
        for (let i: u32 = 0; i < firstChunkSize; i++) {
            out[i] = header[4 + i];
        }
        remaining -= firstChunkSize;
        offset += firstChunkSize;

        let chunkIndex: u64 = 1;
        while (remaining > 0) {
            const slot = Blockchain.getStorageAt(this.chunkedStoragePointer(basePointer, chunkIndex));
            const chunkSize: u32 = remaining < 32 ? remaining : 32;
            for (let i: u32 = 0; i < chunkSize; i++) {
                out[offset + i] = slot[i];
            }

            remaining -= chunkSize;
            offset += chunkSize;
            chunkIndex++;
        }

        return out;
    }
}
