import { ABIDataTypes } from '@btc-vision/transaction';
import { BitcoinAbiTypes, BitcoinInterfaceAbi } from 'opnet';

export const RockPaperScissorsEvents: BitcoinInterfaceAbi = [
    {
        name: 'GameCreated',
        values: [
            { name: 'gameId', type: ABIDataTypes.UINT256 },
            { name: 'creator', type: ABIDataTypes.ADDRESS },
            { name: 'choice', type: ABIDataTypes.UINT8 },
            { name: 'blockNum', type: ABIDataTypes.UINT64 }
        ],
        type: BitcoinAbiTypes.Event
    },
    {
        name: 'GameJoined',
        values: [
            { name: 'gameId', type: ABIDataTypes.UINT256 },
            { name: 'joiner', type: ABIDataTypes.ADDRESS },
            { name: 'choice', type: ABIDataTypes.UINT8 },
            { name: 'blockNum', type: ABIDataTypes.UINT64 }
        ],
        type: BitcoinAbiTypes.Event
    },
    {
        name: 'GameResolved',
        values: [
            { name: 'gameId', type: ABIDataTypes.UINT256 },
            { name: 'winner', type: ABIDataTypes.UINT8 },
            { name: 'blockNum', type: ABIDataTypes.UINT64 }
        ],
        type: BitcoinAbiTypes.Event
    }
];

export const ROCK_PAPER_SCISSORS_ABI: BitcoinInterfaceAbi = [
    {
        name: 'createGame',
        inputs: [{ name: 'choice', type: ABIDataTypes.UINT8 }],
        outputs: [{ name: 'gameId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'joinGame',
        inputs: [
            { name: 'gameId', type: ABIDataTypes.UINT256 },
            { name: 'choice', type: ABIDataTypes.UINT8 }
        ],
        outputs: [],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'resolveGame',
        inputs: [{ name: 'gameId', type: ABIDataTypes.UINT256 }],
        outputs: [{ name: 'winner', type: ABIDataTypes.UINT8 }],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'getGame',
        constant: true,
        inputs: [{ name: 'gameId', type: ABIDataTypes.UINT256 }],
        outputs: [
            { name: 'exists', type: ABIDataTypes.BOOL },
            { name: 'player1', type: ABIDataTypes.ADDRESS },
            { name: 'player2', type: ABIDataTypes.ADDRESS },
            { name: 'choice1', type: ABIDataTypes.UINT8 },
            { name: 'choice2', type: ABIDataTypes.UINT8 },
            { name: 'status', type: ABIDataTypes.UINT8 },
            { name: 'winner', type: ABIDataTypes.UINT8 },
            { name: 'createdAtBlock', type: ABIDataTypes.UINT64 },
            { name: 'joinedAtBlock', type: ABIDataTypes.UINT64 },
            { name: 'resolvedAtBlock', type: ABIDataTypes.UINT64 }
        ],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'getGameIdsByPlayer',
        constant: true,
        inputs: [{ name: 'player', type: ABIDataTypes.ADDRESS }],
        outputs: [{ name: 'gameIds', type: ABIDataTypes.ARRAY_OF_UINT256 }],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'getOpenGameIds',
        constant: true,
        inputs: [],
        outputs: [{ name: 'gameIds', type: ABIDataTypes.ARRAY_OF_UINT256 }],
        type: BitcoinAbiTypes.Function
    },
    {
        name: 'getLatestGameId',
        constant: true,
        inputs: [],
        outputs: [{ name: 'latestGameId', type: ABIDataTypes.UINT256 }],
        type: BitcoinAbiTypes.Function
    },
    ...RockPaperScissorsEvents
];
