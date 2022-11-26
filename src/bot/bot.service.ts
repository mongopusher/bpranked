import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {Message, SendMessageOptions} from "node-telegram-bot-api";
import {Command} from "@webserver/bot/commands/commands.constant";
import {acceptTextBotStates, BotState} from "@webserver/bot/bot-state.constant";
import {getFarewell, getGreeting, getInitialGreeting} from "@webserver/bot/utils/message.utils";
import {UserService} from "@webserver/user/user.service";
import {CreateUserDto} from "@webserver/user/dto/createUser.dto";
import {UserEntity} from "@webserver/user/user.entity";
import {CupService} from "@webserver/cup/cup.service";
import {CreateCupDto} from "@webserver/cup/dto/createCup.dto";
import {REGEX} from "@webserver/bot/regex.constant";
import {ChatErrorMessage} from "@webserver/bot/error/chat-error-message.constant";
import {ChatError} from "@webserver/bot/error/chat-error";
import moment from "moment";
import {ChatUtils, DATE_FORMAT_DE, DATE_FORMAT_EXTENDED_DE} from "@webserver/bot/utils/chat.utils";
import {TUser} from "@webserver/user/types/user.type";
import {helpMessage} from "@webserver/bot/commands/help-message.constant";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {GameService} from "@webserver/game/game.service";

const DELETE_CONFIRM_STRING = 'lösch dich';

enum CacheRoute {
    empty = '',
    newcup = 'newcup',
    joincup = 'joincup',
    delcup = 'delcup',
    newgame = 'newgame',
}

type TNewGameCache = {
    name: string;
    winners: Array<string>,
    losers: Array<string>,
}

type TUserInputCache = {
    route: CacheRoute;
    data: any;
}

@Injectable()
export class BotService {
    private bot: TelegramBot;
    private cachedUserInput: Map<number, TUserInputCache>;

    public constructor(@Inject(UserService) private readonly userService: UserService,
                       @Inject(CupService) private readonly cupService: CupService,
                       @Inject(GameService) private readonly gameService: GameService) {
        this.cachedUserInput = new Map<number, TUserInputCache>();
    }

    public async initialize(): Promise<void> {
        const token = process.env.BOT_TOKEN;

        this.bot = new TelegramBot(token, { polling: true });

        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                if (error instanceof ChatError) {
                    return this.handleChatError(msg, error);
                }

                console.log(error);
                return this.bot.sendMessage(msg.chat.id,
                    `Ein unbekannter Fehler ist aufgetreten, bitte informiere den Administrator.\n${error}`);
            }
        });
    }

    private async handleMessage(msg: Message): Promise<Message> {
        const userInput = msg.text.toString();

        if (userInput.slice(0, 1) === '/') {
            return await this.handleCommand(msg, userInput.slice(1))
        }

        return await this.handleText(msg, userInput);
    }

    private async handleCommand(msg: Message, command: Command | string | undefined): Promise<Message> {
        if (command === Command.START) {
            return this.startBot(msg);
        }

        const user: TUser = await this.userService.getByTelegramId(msg.from.id)

        if (!user) {
            return;
        }

        if (user.botState === BotState.OFF) {
            return;
        }

        console.log(`processing command [${command}] for user [${user.username}]`)

        switch (command) {
            case Command.STOP:
                return this.stopBot(user, msg);
            case Command.METADATA:
                return this.bot.sendMessage(msg.chat.id, JSON.stringify(msg));
            case Command.NEW_CUP:
                return this.startNewCup(msg);
            case Command.CANCEL:
                return this.cancelBot(msg);
            case Command.JOIN_CUP:
                return this.startJoinCup(msg, user);
            case Command.DELETE_CUP:
                return this.startDeleteCup(msg, user);
            case Command.GET_ALL_CUPS:
                return this.getAllCups(msg);
            case Command.GET_JOINED_CUPS:
                return this.getJoinedCups(msg, user);
            case Command.GET_MY_GAMES:
                return this.getMyGames(msg, user);
            case Command.GET_ALL_GAMES:
                return this.getAllGames(msg);
            case Command.NEW_GAME:
                return this.startNewGame(msg, user);
            case Command.HELP:
            default:
                return this.sendHelp(msg.chat.id);
        }
    }

    private async handleText(msg: Message, userInput: string): Promise<Message> {
        const user = await this.userService.getByTelegramId(msg.from.id);

        if (!user) {
            return;
        }

        if (this.shouldAcceptTextFromUser(user) === false) {
            return;
        }

        console.log(`User [${user.username}] is in [${user.botState}] and sent plain text: [${userInput}]`);
        switch (user.botState) {
            case BotState.START_NEW_CUP:
                return this.setCupName(msg, userInput);
            case BotState.NEW_CUP_NAME_SET:
                return this.createCup(msg, userInput, user);
            case BotState.JOIN_CUP:
                return this.joinCup(msg, userInput, user);
            case BotState.DEL_CUP:
                return this.confirmDeleteCup(msg, userInput, user);
            case BotState.DEL_CUP_CONFIRM:
                return this.deleteCup(msg, userInput);
            case BotState.START_NEW_GAME:
                return this.startNewGame(msg, user);
            case BotState.NEW_GAME_CUP_SET:
                return this.addWinner(msg, userInput);
            case BotState.NEW_GAME_WINNERS_SET:
                return this.addLoser(msg, userInput);
            default:
                throw new Error('THIS SHOULD NEVER HAPPEN');
        }
    }

    private async handleChatError(msg: Message, error: ChatError): Promise<Message> {
        if (!(error instanceof ChatError)) {
            return
        }
        console.log(error);

        switch (error.message) {
            case ChatErrorMessage.TOO_MANY_CHARACTERS:
                return this.sendMessage(msg, `Bitte wähle einen kürzeren Namen. Maximal ${error.data} Zeichen.`);
            case ChatErrorMessage.ILLEGAL_CHARACTER:
                return this.sendMessage(msg, `Unerlaubte Schriftzeichen erkannt. Bitte verwende nur ${error.data}.`);
            case ChatErrorMessage.INVALID_DATE_FORMAT:
                return this.sendMessage(msg, `Ungültiges Datenformat. Bitte gib das Datum im Format ${error.data} an.`);
            case ChatErrorMessage.INVALID_DATE:
                return this.sendMessage(msg, `Ungültiges Datum. Bitte wähle ein Datum, das in der Zukunft liegt.`);
            case ChatErrorMessage.DUPLICATE_NAME:
                return this.sendMessage(msg, `Ungültiges Datenformat. Bitte gib das Datum im Format ${error.data} an.`);
            case ChatErrorMessage.CACHE_INVALID_FORMAT:
                return this.cancelBot(msg, `Cache enthält ungültige Daten. Das dürfte nicht passieren. Bitte informiere den Administrator.`);
            case ChatErrorMessage.CACHE_EMPTY:
                return this.cancelBot(msg, `Cache leer obwohl er es nicht sein sollte. Bitte versuche den Prozess erneut zu starten.`);
            case ChatErrorMessage.UNAVAILABLE_PLAYER:
                return this.cancelBot(msg, `Spieler nicht verfügbar.`);
            default:
                return this.sendMessage(msg, `Ein unbekannter Fehler ist aufgetreten: ${error}`);
        }

    }

    private shouldAcceptTextFromUser(user: TUser): boolean {
        return acceptTextBotStates.includes(user.botState)
    }

    private async startBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        const user = await this.userService.getByTelegramId(msg.from.id);

        this.setCachedUserInput(msg, CacheRoute.empty, undefined);

        if (!user) {
            if (msg.from.username === undefined) {
                return this.sendMessage(msg, 'Du musst vorher in den Telegram-Einstellungen einen Benutzernamen anlegen.')
            }

            await this.userService.create(new CreateUserDto(msg.from.username, msg.from.id));
            return this.sendMessage(msg, getInitialGreeting(name));
        }

        if (user.botState === BotState.OFF) {
            await this.updateBotState(msg, BotState.ON);
            return this.sendMessage(msg, getGreeting(name));
        }

        return this.sendHelp(msg.chat.id);
    }

    private async stopBot(user: TUser, msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        if (user.botState === BotState.OFF) {
            return;
        }

        this.cachedUserInput.delete(msg.from.id);
        await this.updateBotState(msg, BotState.OFF);
        return this.bot.sendMessage(msg.chat.id, getFarewell(name));
    }

    private async cancelBot(msg: Message, infoText?: string | undefined): Promise<Message> {
        const user = await this.userService.getByTelegramId(msg.from.id);

        if (user.botState === BotState.ON) {
            return this.bot.sendMessage(msg.chat.id, infoText ?? 'Mir doch egal, hab grad eh nichts gemacht...');
        }

        await this.updateBotState(msg, BotState.ON);
        await this.sendMessage(msg, 'Aktueller Vorgang wurde abgebrochen!');
    }

    private sendHelp(chatId: number): Promise<Message> {
        const textReply = Object.values(Command).map((commandName) => {
            if (helpMessage[commandName] === undefined) {
                return undefined;
            }

            return `/${commandName} - ${helpMessage[commandName]}`;
        }).filter(value => value !== undefined).join('\n');

        return this.bot.sendMessage(chatId, textReply);
    }

    private async startNewCup(msg: Message): Promise<Message> {
        await this.updateBotState(msg, BotState.START_NEW_CUP);

        return this.sendMessage(msg, 'Erstelle neuen Cup. Bitte gib zuerst einen Namen für den Cup an.');
    }

    private async setCupName(msg: Message, userInput: string): Promise<Message> | never {
        const match = userInput.match(REGEX.TEXT);
        if (match === null || match[0] !== userInput) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_CHARACTER, 'Buchstaben, Zahlen, Leerzeichen, "-" und "_"');
        }

        if (userInput.length > 32) {
            throw new ChatError(ChatErrorMessage.TOO_MANY_CHARACTERS, 32);
        }

        const cups = await this.cupService.getAll();

        if (cups.findIndex((cup) => cup.name === userInput) !== -1) {
            throw new ChatError(ChatErrorMessage.DUPLICATE_NAME);
        }

        this.setCachedUserInput(msg, CacheRoute.newcup, userInput)

        await this.updateBotState(msg, BotState.NEW_CUP_NAME_SET);

        const textReply = `Bitte sende mir den Endzeitpunkt für den Cup im Format ${DATE_FORMAT_DE}.`

        return this.sendMessage(msg, textReply);
    }

    private async createCup(msg: Message, userInput: any, user: TUser): Promise<Message> {
        if (moment(userInput, DATE_FORMAT_DE, true).isValid() === false) {
            throw new ChatError(ChatErrorMessage.INVALID_DATE_FORMAT, DATE_FORMAT_DE);
        }

        const now = moment();
        const endDateStartOfDay = moment(userInput, DATE_FORMAT_DE);
        const endDate = endDateStartOfDay.endOf('day');

        if (endDate.isBefore(now)) {
            throw new ChatError(ChatErrorMessage.INVALID_DATE);
        }

        const cupName = this.getCachedUserInput<string>(msg, CacheRoute.newcup);

        const cup = await this.cupService.create(user, new CreateCupDto(cupName, endDate.toDate()));
        await this.updateBotState(msg, BotState.ON);
        return await this.bot.sendMessage(msg.chat.id, `Cup "${cup.name}" endet am ${endDate.format(DATE_FORMAT_EXTENDED_DE)}`);
    }

    private async startJoinCup(msg: Message, user: TUser): Promise<Message> {
        const now = moment();

        const cups = await this.cupService.getBeforeDate(now.toDate());

        // Get only cups not attended
        const filteredCups = cups.filter((cup) => {
            const foundUser = cup.attendees.find((attendee) => attendee.id === user.id);
            return foundUser === undefined;
        });

        if (filteredCups.length === 0) {
            const infoText = `Du nimmst bereits an allen Cups teil!\n`;
            return this.cancelBot(msg, infoText);
        }

        const responseText = filteredCups.map((cup) => {
            const endDate = moment(cup.endTimestamp).format(DATE_FORMAT_DE);
            return `<b>${cup.name}</b> von <i>${cup.manager.username}</i> endet am ${endDate}.`;
        }).join('\n');

        const keyBoardData = filteredCups.map((cup) => cup.name);

        await this.updateBotState(msg, BotState.JOIN_CUP);

        return await this.sendMessageWithKeyboard(msg, responseText, keyBoardData, 1);
    }

    private async joinCup(msg: Message, userInput: string, user: TUser): Promise<Message> {
        const now = moment();
        const cups = await this.cupService.getBeforeDate(now.toDate());

        const cup = cups.find((cup) => cup.name === userInput);

        if (cup === undefined) {
            const infoText = 'Cup existiert nicht oder wurde bereits beendet.\n';
            return this.cancelBot(msg, infoText);
        }

        if (cup.attendees.find((attendee) => attendee.id === user.id) !== undefined) {
            const infoText = 'Du nimmst an diesem Cup bereits teil.\n';
            return this.cancelBot(msg, infoText);
        }

        cup.attendees.push(user as UserEntity);

        const newCup = await this.cupService.update(cup);

        const textReply = `Du nimmst jetzt an <b>${newCup.name}</b> teil!`;

        return this.sendMessage(msg, textReply);
    }

    public async getAllCups(msg: Message) {
        const cups = await this.cupService.getAllWithRelations();

        const textReply = cups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');
        return await this.sendMessage(msg, textReply)
    }

    private async getJoinedCups(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);

        const textReply = userEntity.attendedCups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');

        return await this.sendMessage(msg, textReply)
    }

    private async startDeleteCup(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);
        const textReply = 'Welchen deiner Cups möchtest du löschen?';
        const keyBoardReply = userEntity.ownedCups.map((cup) => cup.name);

        await this.updateBotState(msg, BotState.DEL_CUP);
        return await this.sendMessageWithKeyboard(msg, textReply, keyBoardReply, 1);
    }

    private async confirmDeleteCup(msg: Message, input: string, user: TUser): Promise<Message> {
        const { ownedCups } = await this.userService.getById(user.id, false, true);

        if (ownedCups.find((cup) => cup.name === input) === undefined) {
            return this.cancelBot(msg);
        }

        this.setCachedUserInput(msg, CacheRoute.delcup, input)
        const textReply = `Möchtest du <b>${input}</b> wirklich löschne? Bitte gib zur Bestätigung <i>${DELETE_CONFIRM_STRING}</i> ein.`;

        await this.updateBotState(msg, BotState.DEL_CUP_CONFIRM);
        return await this.sendMessage(msg, textReply);
    }

    private async deleteCup(msg: Message, input: string): Promise<Message> {
        if (input !== DELETE_CONFIRM_STRING) {
            return this.cancelBot(msg);
        }

        const cupName = this.getCachedUserInput(msg, CacheRoute.delcup);

        await this.cupService.deleteByName(cupName);
        const textReply = `<i>${cupName}</i> wurde gelöscht.`;

        await this.updateBotState(msg, BotState.ON);
        return await this.sendMessage(msg, textReply);
    }

    public async startNewGame(msg: Message, user: TUser): Promise<Message> {
        const { attendedCups } = await this.userService.getById(user.id, false, true);

        if (attendedCups.length === 1) {
            await this.chooseCupForGame(msg, attendedCups[0].name);
            await this.askForPlayer(msg, 'Gewinner');
        }

        const cups = attendedCups.map((cup) => cup.name);

        await this.updateBotState(msg, BotState.START_NEW_GAME);
        return this.sendMessageWithKeyboard(msg, 'Bitte wähle in welchem Cup das Spiel stattfindet', cups, 2);
    }

    public async chooseCupForGame(msg, cupName): Promise<void> {
        await this.updateBotState(msg, BotState.NEW_GAME_CUP_SET);
        this.setCachedUserInput(msg, CacheRoute.newgame, { cupName })
    }

    public async askForPlayer(msg, playerLabel: 'Gewinner' | 'Verlierer'): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);

        const { attendees } = await this.cupService.getByName(cachedUserInput.name);

        const usedPlayers = cachedUserInput.winners.concat(cachedUserInput.losers);
        const availablePlayers = attendees.map((player) => player.username)
            .filter((player) => usedPlayers.includes(player) !== false)

        console.log({ cachedUserInput });
        console.log({ attendees });
        console.log({ availablePlayers });

        availablePlayers.unshift('ENDE');
        return this.sendMessageWithKeyboard(msg, `Bitte wähle die ${playerLabel} des Spiels`, availablePlayers, 2);
    }

    public async addWinner(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);

        if (userInput === 'ENDE') {
            await this.updateBotState(msg, BotState.NEW_GAME_WINNERS_SET);
            await this.askForPlayer(msg, 'Verlierer');
        }

        if (cachedUserInput.winners.includes(userInput) || cachedUserInput.losers.includes(userInput)) {
            throw new ChatError(ChatErrorMessage.UNAVAILABLE_PLAYER)
        }

        const winners = cachedUserInput?.winners || [];

        this.setCachedUserInput(msg, CacheRoute.newgame, winners.concat(userInput));
        return this.askForPlayer(msg, 'Gewinner');
    }

    public async addLoser(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);

        if (userInput === 'ENDE') {
            // SPIEL SPEICHERN oder NACHRICHT ZUM SPEICHERN ANZEIGEN
            await this.updateBotState(msg, BotState.ON);
            this.cachedUserInput.delete(msg.from.id);
            return this.sendMessage(msg, 'Spiel eingetragen');
        }

        if (cachedUserInput.winners.includes(userInput) || cachedUserInput.losers.includes(userInput)) {
            throw new ChatError(ChatErrorMessage.UNAVAILABLE_PLAYER)
        }

        const losers = cachedUserInput?.losers || [];


        this.setCachedUserInput(msg, CacheRoute.newgame, losers.concat(userInput));
        return await this.askForPlayer(msg, 'Verlierer');
    }


    public async createGame(createGameDto: CreateGameDto, user: UserEntity): Promise<Message> {
        console.log({ createGameDto, user });


        return '' as any;
    }

    public async getMyGames(msg: Message, user: TUser): Promise<Message> {
        const userWithRelations = await this.userService.getById(user.id, false, true);
        console.log(userWithRelations);

        const game = await this.gameService.getGameById(userWithRelations.id);
        console.log({ game });

        return this.sendMessage(msg, JSON.stringify(game));
    }

    public async getAllGames(msg: Message): Promise<Message> {
        const allGames = await this.gameService.getAllGames();

        console.log({ allGames });

        return this.sendMessage(msg, JSON.stringify(allGames));
    }

    private setCachedUserInput(msg: Message, cacheRoute: CacheRoute, input: any): void {
        this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: input })
    }

    private addCachedUserInput(msg: Message, cacheRoute: CacheRoute, input: any): void {
        const cachedUserInput = this.cachedUserInput.get(msg.from.id);

        if (cachedUserInput.route !== cacheRoute) {
            throw new ChatError(ChatErrorMessage.CACHE_INVALID_FORMAT);
        }

        if (cachedUserInput?.data instanceof Array) {
            this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: [...cachedUserInput.data, ...input] })
            return;
        }

        if (cachedUserInput?.data instanceof Object) {
            this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: { ...cachedUserInput.data, ...input } })
        }

        this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: input })
    }


    private getCachedUserInput<T = any>(msg: Message, cacheRoute: CacheRoute): T {
        if (this.cachedUserInput.has(msg.from.id) === false) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }

        const cachedUserInput = this.cachedUserInput.get(msg.from.id);

        if (cachedUserInput.data === [] || cachedUserInput.data === '') {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }

        if (cachedUserInput.route !== cacheRoute) {
            throw new ChatError(ChatErrorMessage.CACHE_INVALID_FORMAT);
        }
        return cachedUserInput.data;
    }

    private sendMessage(msg: Message, text: string): Promise<Message> {
        const options: SendMessageOptions = {
            reply_markup: {
                remove_keyboard: true,
            },
            parse_mode: 'HTML',
        };

        return this.bot.sendMessage(msg.chat.id, text, options)
    };

    private sendMessageWithKeyboard(msg: Message, text: string, keyBoardData: Array<any>, columns: number): Promise<Message> {
        const options: SendMessageOptions = {
            reply_markup: ChatUtils.getKeyboardMarkup(keyBoardData, columns),
            parse_mode: 'HTML',
        };

        return this.bot.sendMessage(msg.chat.id, text, options)
    };

    private updateBotState(msg: Message, botState: BotState): Promise<TUser> {
        return this.userService.updateBotstate(msg.from.id, botState);
    }
}