import { Address } from '@btc-vision/transaction';
import { CallResult, IOP_NETContract, OPNetEvent } from 'opnet';

export type RpsStatusCode = 0 | 1 | 2 | 3;
export type RpsWinnerCode = 0 | 1 | 2 | 3;

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
    readonly winner: RpsWinnerCode;
    readonly blockNum: bigint;
};

export type CreateGameResult = CallResult<
    {
        gameId: bigint;
    },
    OPNetEvent<GameCreatedEvent>[]
>;

export type JoinGameResult = CallResult<Record<string, never>, OPNetEvent<GameJoinedEvent>[]>;

export type ResolveGameResult = CallResult<
    {
        winner: RpsWinnerCode;
    },
    OPNetEvent<GameResolvedEvent>[]
>;

export type GetGameResult = CallResult<
    {
        exists: boolean;
        player1: Address;
        player2: Address;
        choice1: number;
        choice2: number;
        status: RpsStatusCode;
        winner: RpsWinnerCode;
        createdAtBlock: bigint;
        joinedAtBlock: bigint;
        resolvedAtBlock: bigint;
    },
    OPNetEvent<never>[]
>;

export type GetGameIdsResult = CallResult<
    {
        gameIds: bigint[];
    },
    OPNetEvent<never>[]
>;

export type GetLatestGameIdResult = CallResult<
    {
        latestGameId: bigint;
    },
    OPNetEvent<never>[]
>;

export interface IRockPaperScissorsContract extends IOP_NETContract {
    createGame(choice: number): Promise<CreateGameResult>;

    joinGame(gameId: bigint, choice: number): Promise<JoinGameResult>;

    resolveGame(gameId: bigint): Promise<ResolveGameResult>;

    getGame(gameId: bigint): Promise<GetGameResult>;

    getGameIdsByPlayer(player: Address): Promise<GetGameIdsResult>;

    getOpenGameIds(): Promise<GetGameIdsResult>;

    getLatestGameId(): Promise<GetLatestGameIdResult>;
}
