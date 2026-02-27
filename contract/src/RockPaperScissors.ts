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

const CHOICE_NONE: u8 = 0;
const CHOICE_ROCK: u8 = 1;
const CHOICE_PAPER: u8 = 2;
const CHOICE_SCISSORS: u8 = 3;

const STATUS_NONE: u8 = 0;
const STATUS_OPEN: u8 = 1;
const STATUS_READY: u8 = 2;
const STATUS_RESOLVED: u8 = 3;

const WINNER_NONE: u8 = 0;
const WINNER_PLAYER1: u8 = 1;
const WINNER_PLAYER2: u8 = 2;
const WINNER_DRAW: u8 = 3;

const RECORD_VERSION: u8 = 1;
const MAX_RECORD_BYTES: i32 = 512;
const MAX_PLAYER_INDEX_BYTES: i32 = 4096;
const MAX_OPEN_INDEX_BYTES: i32 = 4096;
const EMPTY_BYTES: Uint8Array = new Uint8Array(0);

const NEXT_GAME_ID_POINTER: u16 = Blockchain.nextPointer;
const GAME_RECORD_POINTER: u16 = Blockchain.nextPointer;
const PLAYER_GAME_INDEX_POINTER: u16 = Blockchain.nextPointer;
const OPEN_GAME_INDEX_POINTER: u16 = Blockchain.nextPointer;

class GameRecord {
    public player1: Address = Address.zero();
    public player2: Address = Address.zero();
    public choice1: u8 = CHOICE_NONE;
    public choice2: u8 = CHOICE_NONE;
    public status: u8 = STATUS_NONE;
    public winner: u8 = WINNER_NONE;
    public createdAtBlock: u64 = 0;
    public joinedAtBlock: u64 = 0;
    public resolvedAtBlock: u64 = 0;
}

@final
class GameCreatedEvent extends NetEvent {
    public constructor(gameId: u256, creator: Address, choice: u8, blockNum: u64) {
        const data = new BytesWriter(32 + 32 + 1 + 8);
        data.writeU256(gameId);
        data.writeAddress(creator);
        data.writeU8(choice);
        data.writeU64(blockNum);
        super('GameCreated', data);
    }
}

@final
class GameJoinedEvent extends NetEvent {
    public constructor(gameId: u256, joiner: Address, choice: u8, blockNum: u64) {
        const data = new BytesWriter(32 + 32 + 1 + 8);
        data.writeU256(gameId);
        data.writeAddress(joiner);
        data.writeU8(choice);
        data.writeU64(blockNum);
        super('GameJoined', data);
    }
}

@final
class GameResolvedEvent extends NetEvent {
    public constructor(gameId: u256, winner: u8, blockNum: u64) {
        const data = new BytesWriter(32 + 1 + 8);
        data.writeU256(gameId);
        data.writeU8(winner);
        data.writeU64(blockNum);
        super('GameResolved', data);
    }
}

@final
export class RockPaperScissors extends OP_NET {
    private _nextGameId: StoredU256 = new StoredU256(0, EMPTY_POINTER);

    public constructor() {
        super();
        this._nextGameId = new StoredU256(NEXT_GAME_ID_POINTER, EMPTY_POINTER);
    }

    public override onDeployment(_: Calldata): void {
        // No deployment init required.
    }

    @method({ name: 'choice', type: ABIDataTypes.UINT8 })
    @returns({ name: 'gameId', type: ABIDataTypes.UINT256 })
    @emit('GameCreated')
    public createGame(calldata: Calldata): BytesWriter {
        const choice = calldata.readU8();
        this.requireValidChoice(choice);

        const gameId = this.nextGameId();
        const nowBlock = Blockchain.block.number;
        const sender = Blockchain.tx.sender;

        const game = new GameRecord();
        game.player1 = sender;
        game.choice1 = choice;
        game.status = STATUS_OPEN;
        game.winner = WINNER_NONE;
        game.createdAtBlock = nowBlock;

        this.saveGame(gameId, game);
        this.appendPlayerGameId(sender, gameId);
        this.appendOpenGameId(gameId);
        this.emitEvent(new GameCreatedEvent(gameId, sender, choice, nowBlock));

        const writer = new BytesWriter(32);
        writer.writeU256(gameId);
        return writer;
    }

    @method(
        { name: 'gameId', type: ABIDataTypes.UINT256 },
        { name: 'choice', type: ABIDataTypes.UINT8 }
    )
    @emit('GameJoined')
    public joinGame(calldata: Calldata): BytesWriter {
        const gameId = calldata.readU256();
        const choice = calldata.readU8();
        this.requireValidChoice(choice);

        const game = this.requireGame(gameId);
        if (game.status != STATUS_OPEN) {
            throw new Revert('Game is not open for joining');
        }

        const sender = Blockchain.tx.sender;
        if (game.player1.equals(sender)) {
            throw new Revert('Creator cannot join as second player');
        }

        if (!game.player2.isZero()) {
            throw new Revert('Game already has second player');
        }

        const nowBlock = Blockchain.block.number;
        game.player2 = sender;
        game.choice2 = choice;
        game.status = STATUS_READY;
        game.joinedAtBlock = nowBlock;

        this.saveGame(gameId, game);
        this.appendPlayerGameId(sender, gameId);
        this.removeOpenGameId(gameId);
        this.emitEvent(new GameJoinedEvent(gameId, sender, choice, nowBlock));

        return new BytesWriter(0);
    }

    @method({ name: 'gameId', type: ABIDataTypes.UINT256 })
    @returns({ name: 'winner', type: ABIDataTypes.UINT8 })
    @emit('GameResolved')
    public resolveGame(calldata: Calldata): BytesWriter {
        const gameId = calldata.readU256();
        const game = this.requireGame(gameId);

        if (game.status == STATUS_RESOLVED) {
            const already = new BytesWriter(1);
            already.writeU8(game.winner);
            return already;
        }

        if (game.status != STATUS_READY || game.player2.isZero()) {
            throw new Revert('Game is not ready to resolve');
        }

        const winner = this.resolveWinner(game.choice1, game.choice2);
        game.winner = winner;
        game.status = STATUS_RESOLVED;
        game.resolvedAtBlock = Blockchain.block.number;

        this.saveGame(gameId, game);
        this.emitEvent(new GameResolvedEvent(gameId, winner, game.resolvedAtBlock));

        const writer = new BytesWriter(1);
        writer.writeU8(winner);
        return writer;
    }

    @method({ name: 'gameId', type: ABIDataTypes.UINT256 })
    @returns(
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
    )
    public getGame(calldata: Calldata): BytesWriter {
        const gameId = calldata.readU256();
        const game = this.loadGame(gameId);

        const writer = new BytesWriter(128);
        if (game == null) {
            writer.writeBoolean(false);
            writer.writeAddress(Address.zero());
            writer.writeAddress(Address.zero());
            writer.writeU8(CHOICE_NONE);
            writer.writeU8(CHOICE_NONE);
            writer.writeU8(STATUS_NONE);
            writer.writeU8(WINNER_NONE);
            writer.writeU64(0);
            writer.writeU64(0);
            writer.writeU64(0);
            return writer;
        }

        writer.writeBoolean(true);
        writer.writeAddress(game.player1);
        writer.writeAddress(game.player2);
        writer.writeU8(game.choice1);
        writer.writeU8(game.choice2);
        writer.writeU8(game.status);
        writer.writeU8(game.winner);
        writer.writeU64(game.createdAtBlock);
        writer.writeU64(game.joinedAtBlock);
        writer.writeU64(game.resolvedAtBlock);
        return writer;
    }

    @method({ name: 'player', type: ABIDataTypes.ADDRESS })
    @returns({ name: 'gameIds', type: ABIDataTypes.ARRAY_OF_UINT256 })
    public getGameIdsByPlayer(calldata: Calldata): BytesWriter {
        const player = calldata.readAddress();
        const gameIds = this.loadPlayerGameIds(player);
        const writer = new BytesWriter(2 + gameIds.length * 32);
        writer.writeU256Array(gameIds);
        return writer;
    }

    @method()
    @returns({ name: 'gameIds', type: ABIDataTypes.ARRAY_OF_UINT256 })
    public getOpenGameIds(_: Calldata): BytesWriter {
        const gameIds = this.loadOpenGameIds();
        const writer = new BytesWriter(2 + gameIds.length * 32);
        writer.writeU256Array(gameIds);
        return writer;
    }

    @method()
    @returns({ name: 'latestGameId', type: ABIDataTypes.UINT256 })
    public getLatestGameId(_: Calldata): BytesWriter {
        const writer = new BytesWriter(32);
        writer.writeU256(this._nextGameId.value);
        return writer;
    }

    private requireValidChoice(choice: u8): void {
        if (choice != CHOICE_ROCK && choice != CHOICE_PAPER && choice != CHOICE_SCISSORS) {
            throw new Revert('Invalid choice');
        }
    }

    private resolveWinner(choice1: u8, choice2: u8): u8 {
        if (choice1 == choice2) {
            return WINNER_DRAW;
        }

        if (
            (choice1 == CHOICE_ROCK && choice2 == CHOICE_SCISSORS) ||
            (choice1 == CHOICE_PAPER && choice2 == CHOICE_ROCK) ||
            (choice1 == CHOICE_SCISSORS && choice2 == CHOICE_PAPER)
        ) {
            return WINNER_PLAYER1;
        }

        return WINNER_PLAYER2;
    }

    private requireGame(gameId: u256): GameRecord {
        const game = this.loadGame(gameId);
        if (game == null) {
            throw new Revert('Game not found');
        }

        return game;
    }

    private nextGameId(): u256 {
        const next = this._nextGameId.value + u256.from(1);
        this._nextGameId.value = next;
        return next;
    }

    private saveGame(gameId: u256, game: GameRecord): void {
        const writer = new BytesWriter(MAX_RECORD_BYTES);
        writer.writeU8(RECORD_VERSION);
        writer.writeAddress(game.player1);
        writer.writeAddress(game.player2);
        writer.writeU8(game.choice1);
        writer.writeU8(game.choice2);
        writer.writeU8(game.status);
        writer.writeU8(game.winner);
        writer.writeU64(game.createdAtBlock);
        writer.writeU64(game.joinedAtBlock);
        writer.writeU64(game.resolvedAtBlock);

        const usedLength = writer.getOffset();
        const buffer = writer.getBuffer();
        const trimmed = new Uint8Array(usedLength);
        for (let i: u32 = 0; i < usedLength; i++) {
            trimmed[i] = buffer[i];
        }

        this.saveChunkedBytes(this.gameStorageKey(gameId), trimmed, MAX_RECORD_BYTES);
    }

    private loadGame(gameId: u256): GameRecord | null {
        const raw = this.loadChunkedBytes(this.gameStorageKey(gameId), MAX_RECORD_BYTES);
        if (raw.length == 0) {
            return null;
        }

        const reader = new BytesReader(raw);
        const version = reader.readU8();
        if (version != RECORD_VERSION) {
            throw new Revert('Unsupported game record version');
        }

        const game = new GameRecord();
        game.player1 = reader.readAddress();
        game.player2 = reader.readAddress();
        game.choice1 = reader.readU8();
        game.choice2 = reader.readU8();
        game.status = reader.readU8();
        game.winner = reader.readU8();
        game.createdAtBlock = reader.readU64();
        game.joinedAtBlock = reader.readU64();
        game.resolvedAtBlock = reader.readU64();
        return game;
    }

    private appendPlayerGameId(player: Address, gameId: u256): void {
        const gameIds = this.loadPlayerGameIds(player);
        gameIds.push(gameId);
        this.savePlayerGameIds(player, gameIds);
    }

    private savePlayerGameIds(player: Address, gameIds: u256[]): void {
        const writer = new BytesWriter(2 + gameIds.length * 32);
        writer.writeU256Array(gameIds);
        this.saveChunkedBytes(this.playerGameIndexStorageKey(player), writer.getBuffer(), MAX_PLAYER_INDEX_BYTES);
    }

    private loadPlayerGameIds(player: Address): u256[] {
        const raw = this.loadChunkedBytes(this.playerGameIndexStorageKey(player), MAX_PLAYER_INDEX_BYTES);
        if (raw.length == 0) {
            return new Array<u256>();
        }

        const reader = new BytesReader(raw);
        return reader.readU256Array();
    }

    private appendOpenGameId(gameId: u256): void {
        const gameIds = this.loadOpenGameIds();
        gameIds.push(gameId);
        this.saveOpenGameIds(gameIds);
    }

    private removeOpenGameId(gameId: u256): void {
        const gameIds = this.loadOpenGameIds();
        let index: i32 = -1;
        for (let i = 0; i < gameIds.length; i++) {
            if (u256.eq(gameIds[i], gameId)) {
                index = i;
                break;
            }
        }

        if (index < 0) {
            return;
        }

        const lastIndex = gameIds.length - 1;
        if (index != lastIndex) {
            gameIds[index] = gameIds[lastIndex];
        }
        gameIds.pop();
        this.saveOpenGameIds(gameIds);
    }

    private saveOpenGameIds(gameIds: u256[]): void {
        const writer = new BytesWriter(2 + gameIds.length * 32);
        writer.writeU256Array(gameIds);
        this.saveChunkedBytes(this.openGameIndexStorageKey(), writer.getBuffer(), MAX_OPEN_INDEX_BYTES);
    }

    private loadOpenGameIds(): u256[] {
        const raw = this.loadChunkedBytes(this.openGameIndexStorageKey(), MAX_OPEN_INDEX_BYTES);
        if (raw.length == 0) {
            return new Array<u256>();
        }

        const reader = new BytesReader(raw);
        return reader.readU256Array();
    }

    private gameStorageKey(gameId: u256): Uint8Array {
        return encodePointerUnknownLength(GAME_RECORD_POINTER, gameId.toUint8Array(true));
    }

    private playerGameIndexStorageKey(player: Address): Uint8Array {
        return encodePointerUnknownLength(PLAYER_GAME_INDEX_POINTER, player);
    }

    private openGameIndexStorageKey(): Uint8Array {
        return encodePointerUnknownLength(OPEN_GAME_INDEX_POINTER, EMPTY_BYTES);
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
