export type RpsChoice = 'ROCK' | 'PAPER' | 'SCISSORS';

export type RpsGameStatus = 'OPEN' | 'READY' | 'RESOLVED' | 'ERROR';

export type RpsWinner = 'NONE' | 'PLAYER1' | 'PLAYER2' | 'DRAW';

export interface RpsGameSummary {
    gameId: string;
    status: RpsGameStatus;
    player1: string;
    player2?: string;
    player1Choice: RpsChoice;
    player2Choice?: RpsChoice;
    winner: RpsWinner;
    winnerAddress?: string;
    createdAtTs: number;
    joinedAtTs?: number;
    resolvedAtTs?: number;
    isCreator: boolean;
    isJoiner: boolean;
    isParticipant: boolean;
    canJoin: boolean;
    canResolve: boolean;
}

export interface RpsGameDetails extends RpsGameSummary {}

export interface RpsActionResult {
    ok: boolean;
    gameId?: string;
    txid?: string;
    winner?: RpsWinner;
    error?: string;
}
