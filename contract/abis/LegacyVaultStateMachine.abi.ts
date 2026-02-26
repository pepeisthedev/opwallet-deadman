import { ABIDataTypes, BitcoinAbiTypes, OP_NET_ABI } from 'opnet';

export const LegacyVaultStateMachineEvents = [
    {
        name: 'VaultCreated',
        values: [
            { name: 'vaultId', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'blockNum', type: ABIDataTypes.UINT64 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'CheckedIn',
        values: [
            { name: 'vaultId', type: ABIDataTypes.UINT256 },
            { name: 'owner', type: ABIDataTypes.ADDRESS },
            { name: 'blockNum', type: ABIDataTypes.UINT64 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'Triggered',
        values: [
            { name: 'vaultId', type: ABIDataTypes.UINT256 },
            { name: 'triggeredBy', type: ABIDataTypes.ADDRESS },
            { name: 'blockNum', type: ABIDataTypes.UINT64 },
        ],
        type: BitcoinAbiTypes.Event,
    },
    {
        name: 'ClaimFinalized',
        values: [
            { name: 'vaultId', type: ABIDataTypes.UINT256 },
            { name: 'finalizedBy', type: ABIDataTypes.ADDRESS },
            { name: 'blockNum', type: ABIDataTypes.UINT64 },
            { name: 'payoutRef', type: ABIDataTypes.BYTES },
        ],
        type: BitcoinAbiTypes.Event,
    },
];

export const LegacyVaultStateMachineAbi = [
    {
        name: 'createVault',
        inputs: [
            { name: 'heirs', type: ABIDataTypes.ARRAY_OF_ADDRESSES },
            { name: 'sharesBps', type: ABIDataTypes.ARRAY_OF_UINT16 },
            { name: 'intervalSec', type: ABIDataTypes.UINT64 },
            { name: 'graceSec', type: ABIDataTypes.UINT64 },
            { name: 'metadataHash', type: ABIDataTypes.BYTES32 },
        ],
        outputs: [{ name: 'vaultId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getVault',
        inputs: [{ name: 'vaultId', type: ABIDataTypes.UINT256 }],
        outputs: [
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
            { name: 'payoutRef', type: ABIDataTypes.BYTES },
        ],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'getVaultIdsByOwner',
        inputs: [{ name: 'owner', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'vaultIds', type: ABIDataTypes.ARRAY_OF_UINT256 }],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'checkIn',
        inputs: [{ name: 'vaultId', type: ABIDataTypes.UINT256 }],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'trigger',
        inputs: [{ name: 'vaultId', type: ABIDataTypes.UINT256 }],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    {
        name: 'finalizeClaim',
        inputs: [
            { name: 'vaultId', type: ABIDataTypes.UINT256 },
            { name: 'payoutRef', type: ABIDataTypes.BYTES },
        ],
        outputs: [],
        type: BitcoinAbiTypes.Function,
    },
    ...LegacyVaultStateMachineEvents,
    ...OP_NET_ABI,
];

export default LegacyVaultStateMachineAbi;
