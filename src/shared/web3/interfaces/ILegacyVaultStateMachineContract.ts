import { Address } from '@btc-vision/transaction';
import { CallResult, IOP_NETContract, OPNetEvent } from 'opnet';

export type VaultCreatedEvent = {
    readonly vaultId: bigint;
    readonly owner: Address;
    readonly createdAtBlock: bigint;
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

export type LegacyVaultStatusCode = 0 | 1 | 2 | 3;

export type CreateVaultResult = CallResult<
    {
        vaultId: bigint;
    },
    OPNetEvent<VaultCreatedEvent>[]
>;

export type GetVaultResult = CallResult<
    {
        exists: boolean;
        owner: Address;
        status: LegacyVaultStatusCode;
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

export type GetVaultIdsByOwnerResult = CallResult<
    {
        vaultIds: bigint[];
    },
    OPNetEvent<never>[]
>;

export type CheckInVaultResult = CallResult<Record<string, never>, OPNetEvent<CheckedInEvent>[]>;
export type TriggerVaultResult = CallResult<Record<string, never>, OPNetEvent<TriggeredEvent>[]>;
export type FinalizeClaimResult = CallResult<Record<string, never>, OPNetEvent<ClaimFinalizedEvent>[]>;

/**
 * Legacy Vault policy/state-machine contract (OP_NET-managed mode).
 * This is orchestration state only; it is not Bitcoin L1 custody enforcement.
 */
export interface ILegacyVaultStateMachineContract extends IOP_NETContract {
    createVault(
        heirs: Address[],
        sharesBps: number[],
        intervalSec: bigint,
        graceSec: bigint,
        metadataHash: Uint8Array
    ): Promise<CreateVaultResult>;

    getVault(vaultId: bigint): Promise<GetVaultResult>;

    getVaultIdsByOwner(owner: Address): Promise<GetVaultIdsByOwnerResult>;

    checkIn(vaultId: bigint): Promise<CheckInVaultResult>;

    trigger(vaultId: bigint): Promise<TriggerVaultResult>;

    finalizeClaim(vaultId: bigint, payoutRef: Uint8Array): Promise<FinalizeClaimResult>;
}
