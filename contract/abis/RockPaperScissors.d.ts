import { Address, AddressMap, ExtendedAddressMap, SchnorrSignature } from '@btc-vision/transaction';
import { CallResult, OPNetEvent, IOP_NETContract } from 'opnet';

// ------------------------------------------------------------------
// Event Definitions
// ------------------------------------------------------------------
export type GameCreatedEvent = {
    readonly gameId: bigint;
    readonly creator: Address;
    readonly choice: number;
    readonly blockNum: bigint;
};
export type GameJoinedEvent = {
    readonly gameId: bigint;
    readonly joiner: Address;
    readonly choice: number;
    readonly blockNum: bigint;
};
export type GameResolvedEvent = {
    readonly gameId: bigint;
    readonly winner: number;
    readonly blockNum: bigint;
};

// ------------------------------------------------------------------
// Call Results
// ------------------------------------------------------------------

/**
 * @description Represents the result of the createGame function call.
 */
export type CreateGame = CallResult<
    {
        gameId: bigint;
    },
    OPNetEvent<GameCreatedEvent>[]
>;

/**
 * @description Represents the result of the joinGame function call.
 */
export type JoinGame = CallResult<{}, OPNetEvent<GameJoinedEvent>[]>;

/**
 * @description Represents the result of the resolveGame function call.
 */
export type ResolveGame = CallResult<
    {
        winner: number;
    },
    OPNetEvent<GameResolvedEvent>[]
>;

/**
 * @description Represents the result of the getGame function call.
 */
export type GetGame = CallResult<
    {
        exists: boolean;
        player1: Address;
        player2: Address;
        choice1: number;
        choice2: number;
        status: number;
        winner: number;
        createdAtBlock: bigint;
        joinedAtBlock: bigint;
        resolvedAtBlock: bigint;
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getGameIdsByPlayer function call.
 */
export type GetGameIdsByPlayer = CallResult<
    {
        gameIds: bigint[];
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getOpenGameIds function call.
 */
export type GetOpenGameIds = CallResult<
    {
        gameIds: bigint[];
    },
    OPNetEvent<never>[]
>;

/**
 * @description Represents the result of the getLatestGameId function call.
 */
export type GetLatestGameId = CallResult<
    {
        latestGameId: bigint;
    },
    OPNetEvent<never>[]
>;

// ------------------------------------------------------------------
// IRockPaperScissors
// ------------------------------------------------------------------
export interface IRockPaperScissors extends IOP_NETContract {
    createGame(choice: number): Promise<CreateGame>;
    joinGame(gameId: bigint, choice: number): Promise<JoinGame>;
    resolveGame(gameId: bigint): Promise<ResolveGame>;
    getGame(gameId: bigint): Promise<GetGame>;
    getGameIdsByPlayer(player: Address): Promise<GetGameIdsByPlayer>;
    getOpenGameIds(): Promise<GetOpenGameIds>;
    getLatestGameId(): Promise<GetLatestGameId>;
}
