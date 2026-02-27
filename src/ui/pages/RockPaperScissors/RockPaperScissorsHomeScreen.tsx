import { useCallback, useEffect, useMemo, useState } from 'react';

import { RpsChoice, RpsGameSummary } from '@/shared/types/RockPaperScissors';
import { Header, Layout } from '@/ui/components';
import { useTools } from '@/ui/components/ActionComponent';
import { useWallet } from '@/ui/utils';

const colors = {
    main: '#f37413',
    background: '#212121',
    text: '#dbdbdb',
    textMuted: 'rgba(219, 219, 219, 0.72)',
    panel: '#2a2a2a',
    border: '#3a3a3a',
    panelAlt: '#303030',
    info: '#60a5fa',
    success: '#4ade80',
    warning: '#fbbf24',
    danger: '#ef4444'
} as const;

const CHOICES: RpsChoice[] = ['ROCK', 'PAPER', 'SCISSORS'];
const HIDDEN_MOVE_TEXT = 'Hidden until execute';

function formatChoice(choice?: RpsChoice): string {
    if (!choice) {
        return '—';
    }

    return choice.charAt(0) + choice.slice(1).toLowerCase();
}

function txExplorerUrl(txid?: string): string | null {
    const value = txid?.trim();
    if (!value) {
        return null;
    }

    return `https://opscan.org/transactions/${encodeURIComponent(value)}?network=op_testnet`;
}

function statusColor(status: RpsGameSummary['status']): string {
    switch (status) {
        case 'OPEN':
            return colors.info;
        case 'READY':
            return colors.warning;
        case 'RESOLVED':
            return colors.success;
        default:
            return colors.danger;
    }
}

function formatTimestamp(ts?: number): string {
    if (!ts) {
        return '—';
    }

    try {
        return new Date(ts).toLocaleString();
    } catch {
        return String(ts);
    }
}

export default function RockPaperScissorsHomeScreen() {
    const wallet = useWallet();
    const tools = useTools();

    const [games, setGames] = useState<RpsGameSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [createChoice, setCreateChoice] = useState<RpsChoice>('ROCK');
    const [lastTxid, setLastTxid] = useState<string | undefined>();

    const loadGames = useCallback(async () => {
        setLoading(true);
        try {
            const list = await wallet.rps_listGames();
            setGames(list);
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to load games');
        } finally {
            setLoading(false);
        }
    }, [tools, wallet]);

    useEffect(() => {
        void loadGames();
    }, [loadGames]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            void loadGames();
        }, 15000);

        return () => window.clearInterval(timer);
    }, [loadGames]);

    const runCreateGame = async () => {
        setBusyAction('create');
        try {
            const result = await wallet.rps_createGame(createChoice);
            if (!result.ok) {
                tools.toastError(result.error || 'Failed to create game');
                return;
            }

            setLastTxid(result.txid);
            tools.toastSuccess(`Game #${result.gameId || ''} created. Your move is locked in.`);
            await loadGames();
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to create game');
        } finally {
            setBusyAction(null);
        }
    };

    const runJoinGame = async (gameId: string, choice: RpsChoice) => {
        const actionKey = `join-${gameId}-${choice}`;
        setBusyAction(actionKey);
        try {
            const result = await wallet.rps_joinGame(gameId, choice);
            if (!result.ok) {
                tools.toastError(result.error || 'Failed to join game');
                return;
            }

            setLastTxid(result.txid);
            tools.toastSuccess(`Joined game #${gameId} with ${choice}.`);
            await loadGames();
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to join game');
        } finally {
            setBusyAction(null);
        }
    };

    const runResolveGame = async (gameId: string) => {
        const actionKey = `resolve-${gameId}`;
        setBusyAction(actionKey);
        try {
            const result = await wallet.rps_resolveGame(gameId);
            if (!result.ok) {
                tools.toastError(result.error || 'Failed to resolve game');
                return;
            }

            setLastTxid(result.txid);
            const winnerLabel =
                result.winner === 'DRAW'
                    ? 'Draw'
                    : result.winner === 'PLAYER1'
                      ? 'Player 1'
                      : result.winner === 'PLAYER2'
                        ? 'Player 2'
                        : 'Unknown';
            tools.toastSuccess(`Game #${gameId} resolved: ${winnerLabel}.`);
            await loadGames();
        } catch (error) {
            console.error(error);
            tools.toastError('Failed to resolve game');
        } finally {
            setBusyAction(null);
        }
    };

    const lastTxUrl = useMemo(() => txExplorerUrl(lastTxid), [lastTxid]);

    return (
        <Layout>
            <Header onBack={() => window.history.go(-1)} title="Rock Paper Scissors" />
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '12px',
                    background: colors.background
                }}>
                <div
                    style={{
                        background: colors.panel,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '12px',
                        marginBottom: '12px'
                    }}>
                    <div style={{ color: colors.text, fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>
                        Create New Game
                    </div>
                    <div style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '8px' }}>
                        Pick one move. After creation, your choice is locked.
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {CHOICES.map((choice) => {
                            const selected = createChoice === choice;
                            return (
                                <button
                                    key={choice}
                                    onClick={() => setCreateChoice(choice)}
                                    style={{
                                        background: selected ? `${colors.main}22` : colors.panelAlt,
                                        color: selected ? colors.main : colors.text,
                                        border: `1px solid ${selected ? colors.main : colors.border}`,
                                        borderRadius: '8px',
                                        padding: '7px 10px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        fontWeight: 700
                                    }}>
                                    {choice}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => void runCreateGame()}
                            disabled={busyAction === 'create'}
                            style={{
                                marginLeft: 'auto',
                                background: colors.main,
                                color: '#111',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '7px 12px',
                                cursor: busyAction === 'create' ? 'not-allowed' : 'pointer',
                                opacity: busyAction === 'create' ? 0.6 : 1,
                                fontSize: '11px',
                                fontWeight: 700
                            }}>
                            {busyAction === 'create' ? 'Creating...' : 'Create'}
                        </button>
                    </div>
                    {lastTxid && (
                        <div style={{ marginTop: '10px', color: colors.textMuted, fontSize: '10px' }}>
                            Last tx: {lastTxid}
                            {lastTxUrl && (
                                <a
                                    href={lastTxUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: colors.info, marginLeft: '8px', textDecoration: 'none' }}>
                                    View on OP_SCAN
                                </a>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div style={{ color: colors.textMuted, fontSize: '12px' }}>Loading games...</div>
                ) : games.length === 0 ? (
                    <div
                        style={{
                            background: colors.panel,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '12px',
                            padding: '12px',
                            color: colors.textMuted,
                            fontSize: '12px'
                        }}>
                        No games yet. Create one and share the game with another wallet so they can join.
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {games.map((game) => {
                            const player1MoveDisplay =
                                game.status === 'RESOLVED'
                                    ? formatChoice(game.player1Choice)
                                    : game.isCreator
                                      ? formatChoice(game.player1Choice)
                                      : HIDDEN_MOVE_TEXT;

                            const player2MoveDisplay = !game.player2
                                ? 'Waiting for join'
                                : game.status === 'RESOLVED'
                                  ? formatChoice(game.player2Choice)
                                  : game.isJoiner
                                    ? formatChoice(game.player2Choice)
                                    : HIDDEN_MOVE_TEXT;

                            const winnerSummary =
                                game.status !== 'RESOLVED'
                                    ? ''
                                    : game.winner === 'DRAW'
                                      ? `Draw: both players chose ${formatChoice(game.player1Choice)}.`
                                      : game.winner === 'PLAYER1'
                                        ? `Player 1 won with ${formatChoice(game.player1Choice)} vs ${formatChoice(game.player2Choice)}.`
                                        : game.winner === 'PLAYER2'
                                          ? `Player 2 won with ${formatChoice(game.player2Choice)} vs ${formatChoice(game.player1Choice)}.`
                                          : 'Winner pending.';

                            return (
                                <div
                                    key={game.gameId}
                                    style={{
                                        background: colors.panel,
                                        border: `1px solid ${colors.border}`,
                                        borderRadius: '12px',
                                        padding: '12px'
                                    }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                                    <div style={{ color: colors.text, fontWeight: 700, fontSize: '13px' }}>
                                        Game #{game.gameId}
                                    </div>
                                    <span
                                        style={{
                                            color: statusColor(game.status),
                                            border: `1px solid ${statusColor(game.status)}55`,
                                            background: `${statusColor(game.status)}11`,
                                            borderRadius: '999px',
                                            padding: '4px 8px',
                                            fontSize: '10px',
                                            fontWeight: 700
                                        }}>
                                        {game.status}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        marginTop: '8px',
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '6px 10px',
                                        fontSize: '11px'
                                    }}>
                                    <div style={{ color: colors.textMuted }}>Player 1</div>
                                    <div style={{ color: colors.text, textAlign: 'right', wordBreak: 'break-all' }}>{game.player1}</div>
                                    <div style={{ color: colors.textMuted }}>Player 1 Move</div>
                                    <div style={{ color: colors.text, textAlign: 'right' }}>{player1MoveDisplay}</div>
                                    <div style={{ color: colors.textMuted }}>Player 2</div>
                                    <div style={{ color: colors.text, textAlign: 'right', wordBreak: 'break-all' }}>
                                        {game.player2 || 'Waiting for join'}
                                    </div>
                                    <div style={{ color: colors.textMuted }}>Player 2 Move</div>
                                    <div style={{ color: colors.text, textAlign: 'right' }}>{player2MoveDisplay}</div>
                                    <div style={{ color: colors.textMuted }}>Created</div>
                                    <div style={{ color: colors.text, textAlign: 'right' }}>{formatTimestamp(game.createdAtTs)}</div>
                                    <div style={{ color: colors.textMuted }}>Resolved</div>
                                    <div style={{ color: colors.text, textAlign: 'right' }}>{formatTimestamp(game.resolvedAtTs)}</div>
                                </div>

                                {game.status === 'RESOLVED' && (
                                    <div style={{ marginTop: '8px', color: colors.success, fontSize: '11px', fontWeight: 700 }}>
                                        {winnerSummary}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
                                    {game.canJoin &&
                                        CHOICES.map((choice) => {
                                            const actionKey = `join-${game.gameId}-${choice}`;
                                            const isBusy = busyAction === actionKey;
                                            return (
                                                <button
                                                    key={`${game.gameId}-${choice}`}
                                                    onClick={() => void runJoinGame(game.gameId, choice)}
                                                    disabled={!!busyAction}
                                                    style={{
                                                        background: colors.panelAlt,
                                                        color: colors.text,
                                                        border: `1px solid ${colors.border}`,
                                                        borderRadius: '8px',
                                                        padding: '7px 10px',
                                                        cursor: busyAction ? 'not-allowed' : 'pointer',
                                                        opacity: busyAction ? 0.5 : 1,
                                                        fontSize: '11px',
                                                        fontWeight: 700
                                                    }}>
                                                    {isBusy ? 'Joining...' : `Join ${choice}`}
                                                </button>
                                            );
                                        })}

                                    {game.canResolve && (
                                        <button
                                            onClick={() => void runResolveGame(game.gameId)}
                                            disabled={!!busyAction}
                                            style={{
                                                background: colors.main,
                                                color: '#111',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '7px 12px',
                                                cursor: busyAction ? 'not-allowed' : 'pointer',
                                                opacity: busyAction ? 0.6 : 1,
                                                fontSize: '11px',
                                                fontWeight: 700
                                            }}>
                                            {busyAction === `resolve-${game.gameId}` ? 'Executing...' : 'Execute & Reveal'}
                                        </button>
                                    )}
                                </div>
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}
