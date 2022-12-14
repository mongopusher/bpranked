import {TGameConfirmationCache} from "@webserver/bot/cache/game-confirmation.type";
import {TNewGameCache} from "@webserver/bot/cache/new-game-cache.type";
import {TNewCupCache} from "@webserver/bot/cache/new-cup-cache.type";
import {ChatError} from "@webserver/bot/error/chat-error";
import {ChatErrorMessage} from "@webserver/bot/error/chat-error-message.constant";

export class CacheService {
    private confirmingGame: Map<number, TGameConfirmationCache>;
    private newCup: Map<number, TNewCupCache>;
    private newGame: Map<number, TNewGameCache>;
    private simple: Map<number, any>;

    public constructor() {
        this.confirmingGame = new Map();
        this.newCup = new Map();
        this.newGame = new Map();
        this.simple = new Map();
    }

    public set(userId: number, cache: any): void {
        console.debug(`Set standard cache [${cache}] for user [${userId}].`)
        this.simple.set(userId, cache);
    }

    public setConfirmingGame(userId: number, cache: TGameConfirmationCache): void {
        console.debug(`Set confirmingGame cache [${cache}] for user [${userId}].`)
        this.confirmingGame.set(userId, cache);
    }

    public setNewCup(userId: number, cache: TNewCupCache): void {
        console.debug(`Set creatingNewCup cache [${cache}] for user [${userId}].`)
        this.newCup.set(userId, cache);
    }

    public setNewGame(userId: number, cache: TNewGameCache): void {
        console.debug(`Set creatingNewGame cache [${cache}] for user [${userId}].`)
        this.newGame.set(userId, cache);
    }

    public addConfirmingGame(userId: number, cache: Partial<TGameConfirmationCache>): void {
        if (this.confirmingGame.has(userId) === false) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        const oldCache = this.confirmingGame.get(userId);
        console.debug(`Set confirmingGame cache [${cache}] for user [${userId}].`)
        this.confirmingGame.set(userId, { ...oldCache, ...cache });
    }

    public addNewCup(userId: number, cache: Partial<TNewCupCache>): void {
        if (this.newGame.has(userId) === false) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        const oldCache = this.newCup.get(userId);
        console.debug(`Set creatingNewCup cache [${cache}] for user [${userId}].`)
        this.newCup.set(userId, { ...oldCache, ...cache });
    }

    public addNewGame(userId: number, cache: Partial<TNewGameCache>): void {
        if (this.newGame.has(userId) === false) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        const oldCache = this.newGame.get(userId);
        console.debug(`Set creatingNewGame cache [${cache}] for user [${userId}].`)
        this.newGame.set(userId, { ...oldCache, ...cache });
    }

    public get<T = any>(userId): T {
        return this.simple.get(userId);
    }

    public getConfirmingGame(userId: number): TGameConfirmationCache {
        const cache = this.confirmingGame.get(userId);
        if (cache === undefined) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        return cache;
    }

    public getNewCup(userId: number): TNewCupCache {
        const cache = this.newCup.get(userId);

        if (cache === undefined) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        return cache;
    }

    public getNewGame(userId: number): TNewGameCache {
        const cache = this.newGame.get(userId);
        if (cache === undefined) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }
        return cache;
    }

    public deleteAll(userId: number): void {
        console.debug(`Clear all cache for user [${userId}].`)
        this.deleteConfirmingGame(userId);
        this.deleteNewCup(userId);
        this.deleteNewGame(userId);
        this.delete(userId);
    }

    public delete(userId: number): boolean {
        const didDelete = this.simple.delete(userId);
        if (didDelete === true) {
            console.debug(`Delete standard cache for user [${userId}].`)
        }
        return didDelete;
    }

    public deleteConfirmingGame(userId: number): boolean {
        const didDelete = this.confirmingGame.delete(userId);
        if (didDelete === true) {
            console.debug(`Delete confirmingGame cache for user [${userId}].`)
        }
        return didDelete;
    }

    public deleteNewCup(userId: number): boolean {
        const didDelete = this.newCup.delete(userId);
        if (didDelete === true) {
            console.debug(`Delete creatingNewCup cache for user [${userId}].`)
        }
        return didDelete;
    }

    public deleteNewGame(userId: number): boolean {
        const didDelete = this.newGame.delete(userId);
        if (didDelete === true) {
            console.debug(`Delete creatingNewGame cache for user [${userId}].`)
        }
        return didDelete;
    }
}