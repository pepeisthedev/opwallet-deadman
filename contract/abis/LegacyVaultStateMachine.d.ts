import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type VaultCreatedEvent = {
    readonly vaultId: bigint;
    readonly owner: Address;
    readonly blockNum: bigint;
};
export type CheckedInEvent = {
    readonly vaultId: bigint;
    readonly owner: Address;
    readonly blockNum: bigint;
};
export type TriggeredEvent = {
    readonly vaultId: bigint;
    readonly triggeredBy: Address;
    readonly blockNum: bigint;
};
export type ClaimFinalizedEvent = {
    readonly vaultId: bigint;
    readonly finalizedBy: Address;
    readonly blockNum: bigint;
    readonly payoutRef: Uint8Array;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the createVault function call.
 */
export type CreateVault = CallResult<
    {
        vaultId: bigint;
    },
    OPNetEvent<VaultCreatedEvent>[]
>;

/**
 * @description Represents the result of the getVault function call.
 */
export type GetVault = CallResult<
    {
        exists: boolean;
        owner: Address;
        status: number;
        createdAtBlock: bigint;
        lastCheckInBlock: bigint;
        triggeredAtBlock: bigint;
        claimedAtBlock: bigint;
        intervalBlocks: bigint;
        graceBlocks: bigint;
        heirs: Address[];
        sharesBps: number[];
        metadataHash: Uint8Array;
        payoutRef: Uint8Array;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getVaultIdsByOwner function call.
 */
export type GetVaultIdsByOwner = CallResult<
    {
        vaultIds: bigint[];
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the checkIn function call.
 */
export type CheckIn = CallResult<{}, OPNetEvent<CheckedInEvent>[]>;

/**
 * @description Represents the result of the trigger function call.
 */
export type Trigger = CallResult<{}, OPNetEvent<TriggeredEvent>[]>;

/**
 * @description Represents the result of the finalizeClaim function call.
 */
export type FinalizeClaim = CallResult<{}, OPNetEvent<ClaimFinalizedEvent>[]>;

// ------------------------------------------------------------------
// ILegacyVaultStateMachine
// ------------------------------------------------------------------
export interface ILegacyVaultStateMachine extends IOP_NETContract {
    createVault(
        heirs: Address[],
        sharesBps: number[],
        intervalSec: bigint,
        graceSec: bigint,
        metadataHash: Uint8Array,
    ): Promise<CreateVault>;
    getVault(vaultId: bigint): Promise<GetVault>;
    getVaultIdsByOwner(owner: Address): Promise<GetVaultIdsByOwner>;
    checkIn(vaultId: bigint): Promise<CheckIn>;
    trigger(vaultId: bigint): Promise<Trigger>;
    finalizeClaim(vaultId: bigint, payoutRef: Uint8Array): Promise<FinalizeClaim>;
}
