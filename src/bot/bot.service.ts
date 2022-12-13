import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {Message, SendMessageOptions} from "node-telegram-bot-api";
import {Command} from "@webserver/bot/commands/commands.constant";
import {acceptTextBotStates, BotState} from "@webserver/bot/bot-state.constant";
import {getCheers, getFarewell, getGreeting, getInitialGreeting, gib} from "@webserver/bot/utils/message.utils";
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
import {GameService} from "@webserver/game/game.service";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {CupEntity} from "@webserver/cup/cup.entity";
import {EloService} from "@webserver/elo/elo.service";
import {CreateEloDto} from "@webserver/elo/dto/create-elo.dto";
import {EMOJI} from "@webserver/bot/utils/emoji.constant";
import {CupType} from "@webserver/cup/cup-type.enum";
import {CUP, CUPS} from "@webserver/cup/cup.constant";

const DELETE_CONFIRM_STRING = 'lösch dich';

enum CacheRoute {
    empty = '',
    newcup = 'newcup',
    joincup = 'joincup',
    delcup = 'delcup',
    newgame = 'newgame',
}

type TNewGameCache = {
    cupName: string;
    winners?: Array<string>,
    losers?: Array<string>,
}

type TNewCupCache = {
    cupType: CupType;
    cupName?: string;
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
                       @Inject(GameService) private readonly gameService: GameService,
                       @Inject(EloService) private readonly eloService: EloService) {
        this.cachedUserInput = new Map<number, TUserInputCache>();
    }

    public async initialize(): Promise<void> {
        const token = process.env.BOT_TOKEN;

        this.bot = new TelegramBot(token, { polling: true });

        this.bot.on('message', async (msg) => {
            if (msg.chat.type !== 'private') {
                // TODO: add support for specific commands like show highscore
                return;
            }

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
            case Command.GET_MY_ELO:
                return this.getElo(msg, user);
            case Command.PROST:
            case Command.CHEERS:
                return this.sendMessage(msg, getCheers());
            case Command.GIB:
                return this.sendMessage(msg, gib());
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
                return this.chooseCupType(msg, userInput);
            case BotState.NEW_CUP_TYPE_SET:
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
                return this.chooseCupForGame(msg, userInput, user);
            case BotState.NEW_GAME_CUP_SET:
                return this.addWinner(msg, userInput);
            case BotState.NEW_GAME_WINNERS_SET:
                return this.addLoser(msg, userInput);
            case BotState.NEW_GAME_CONFIRM:
                return this.createGame(msg, userInput, user);
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
                return this.sendMessage(msg, `Name bereits vorhanden. Bitte wähle einen anderen.`);
            case ChatErrorMessage.NO_CUPS:
                return this.sendMessage(msg, `Es gibt noch keine Cups. Du kannst einen erstellen mit /newcup`);
            case ChatErrorMessage.NO_ACTIVE_CUPS:
                return this.sendMessage(msg, `Es gibt keine aktiven Cups. Du kannst einen erstellen mit /newcup`);
            case ChatErrorMessage.NO_JOINED_CUPS:
                return this.sendMessage(msg, `Du nimmst an keinem Cup teil. Tritt einem Cup bei mit /joincup`);
            case ChatErrorMessage.TOO_FEW_PLAYERS_IN_CUP:
                return this.cancelBot(msg, 'Du kannst nur Spiele in Cups mit mindestens 2 Teilnehmern erstellen!');
            case ChatErrorMessage.CACHE_INVALID_FORMAT:
                return this.cancelBot(msg, `Cache enthält ungültige Daten. Das dürfte nicht passieren. Bitte informiere den Administrator.`);
            case ChatErrorMessage.CACHE_EMPTY:
                return this.cancelBot(msg, `Cache leer obwohl er es nicht sein sollte. Bitte versuche den Prozess erneut zu starten.`);
            case ChatErrorMessage.UNAVAILABLE_PLAYER:
                return this.cancelBot(msg, `Spieler nicht verfügbar.`);
            case ChatErrorMessage.ILLEGAL_ACTION:
                return this.cancelBot(msg, `Unerlaubte Aktion! Vorgang wird abgebrochen.`);
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
            return this.sendMessage(msg, infoText ?? `Mir doch egal ${EMOJI.SHRUG} hab grad eh nichts gemacht...`);
        }

        await this.updateBotState(msg, BotState.ON);
        await this.sendMessage(msg, infoText ?? 'Aktueller Vorgang wurde abgebrochen!');
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

        const textReply = `Bitte wähle aus, was in deinem Cup gespielt werden soll.`

        const keyBoardData = [CUP[CupType.OneVsOne], CUP[CupType.TwoVsTwo], CUP[CupType.ThreeVsThree]];

        return this.sendMessageWithKeyboard(msg, textReply, keyBoardData, 1);
    }

    private async chooseCupType(msg: Message, userInput: string): Promise<Message> {
        if (CUPS.includes(userInput) === false) {
            return this.sendMessage(msg, 'Ungültige Eingabe!', false);
        }

        this.setCachedUserInput<TNewCupCache>(msg, CacheRoute.newcup, { cupType: CUP[userInput] });

        await this.updateBotState(msg, BotState.NEW_CUP_TYPE_SET);

        return this.sendMessage(msg, 'Bitte gib einen Namen für den Cup an.');
    }

    private async setCupName(msg: Message, userInput: string): Promise<Message> | never {
        const cupName = userInput;
        const match = cupName.match(REGEX.TEXT);
        if (match === null || match[0] !== cupName) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_CHARACTER, 'Buchstaben, Zahlen, Leerzeichen, "-" und "_"');
        }

        if (cupName.length > 32) {
            throw new ChatError(ChatErrorMessage.TOO_MANY_CHARACTERS, 32);
        }

        const cups = await this.cupService.getAll();

        if (cups.findIndex((cup) => cup.name === cupName) !== -1) {
            throw new ChatError(ChatErrorMessage.DUPLICATE_NAME);
        }

        this.addCachedUserInput<TNewCupCache>(msg, CacheRoute.newcup, { cupName })

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

        const { cupName, cupType } = this.getCachedUserInput<TNewCupCache>(msg, CacheRoute.newcup);

        const cup = await this.cupService.create(user, new CreateCupDto(cupName, cupType, endDate.toDate()));
        await this.updateBotState(msg, BotState.ON);
        return await this.sendMessage(msg, `Cup <i>${cup.name}</i> erstellt!`);
    }

    private async startJoinCup(msg: Message, user: TUser): Promise<Message> {
        const now = moment();

        const cups = await this.cupService.getBeforeDate(now.toDate());

        if (cups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_ACTIVE_CUPS);
        }

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

        const createEloDto = new CreateEloDto(user as UserEntity, cup);
        await this.eloService.createDefaultElo(createEloDto);

        const textReply = `Du nimmst jetzt an <b>${newCup.name}</b> teil!`;

        return this.sendMessage(msg, textReply);
    }

    public async getAllCups(msg: Message) {
        const cups = await this.cupService.getAllWithRelations();

        if (cups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_CUPS)
        }

        const textReply = cups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');
        return await this.sendMessage(msg, textReply)
    }

    private async getJoinedCups(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);

        if (userEntity.attendedCups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_JOINED_CUPS);
        }

        const textReply = userEntity.attendedCups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');

        return this.sendMessage(msg, textReply)
    }

    private async startDeleteCup(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);

        if (userEntity.ownedCups.length === 0) {
            return this.cancelBot(msg, 'Du hast noch keinen Cup!');
        }

        const keyBoardReply = userEntity.ownedCups.map((cup) => cup.name);

        await this.updateBotState(msg, BotState.DEL_CUP);

        const textReply = 'Welchen deiner Cups möchtest du löschen?';
        return await this.sendMessageWithKeyboard(msg, textReply, keyBoardReply, 1);
    }

    private async confirmDeleteCup(msg: Message, input: string, user: TUser): Promise<Message> {
        const { ownedCups } = await this.userService.getById(user.id, false, true);

        const cupToDelete = ownedCups.find((cup) => cup.name === input)

        if (cupToDelete === undefined) {
            return this.cancelBot(msg);
        }

        this.setCachedUserInput(msg, CacheRoute.delcup, cupToDelete.id)
        const textReply = `Möchtest du <b>${input}</b> wirklich löschne? Bitte gib zur Bestätigung <i>${DELETE_CONFIRM_STRING}</i> ein.`;

        await this.updateBotState(msg, BotState.DEL_CUP_CONFIRM);
        return await this.sendMessage(msg, textReply);
    }

    private async deleteCup(msg: Message, input: string): Promise<Message> {
        if (input !== DELETE_CONFIRM_STRING) {
            return this.cancelBot(msg);
        }

        const cupId = this.getCachedUserInput(msg, CacheRoute.delcup);

        const cup = await this.cupService.getById(cupId);

        await this.cupService.deleteById(cupId);
        const textReply = `<i>${cup.name}</i> wurde gelöscht.`;

        await this.updateBotState(msg, BotState.ON);
        return await this.sendMessage(msg, textReply);
    }

    public async startNewGame(msg: Message, user: TUser): Promise<Message> {
        const { attendedCups } = await this.userService.getById(user.id, false, true);

        if (attendedCups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_JOINED_CUPS);
        }

        if (attendedCups.length === 1) {
            await this.chooseCupForGame(msg, attendedCups[0].name, user);
            return;
        }

        const cups = attendedCups.map((cup) => cup.name);

        await this.updateBotState(msg, BotState.START_NEW_GAME);
        return this.sendMessageWithKeyboard(msg, 'Bitte wähle in welchem Cup das Spiel stattfindet', cups, 2);
    }

    public async chooseCupForGame(msg, cupName, user: TUser): Promise<Message> {
        const cup = await this.cupService.getByName(cupName);

        if (cup.name !== cupName) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_ACTION);
        }

        if (cup.attendees.length < cup.type) {
            throw new ChatError(ChatErrorMessage.TOO_FEW_PLAYERS_IN_CUP);
        }

        if (cup.attendees.some((attendee) => attendee.username === user.username) === false) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_ACTION);
        }

        this.setCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame, { cupName })
        await this.updateBotState(msg, BotState.NEW_GAME_CUP_SET);
        return this.askForPlayer(msg, 'Gewinner', cup);
    }

    public async askForPlayer(msg, playerLabel: 'Gewinner' | 'Verlierer', cup: CupEntity): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);
        const winners = cachedUserInput?.winners || [];
        const losers = cachedUserInput?.losers || [];

        const usedPlayers = winners.concat(losers);
        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => usedPlayers.includes(player) === false)

        return this.sendMessageWithKeyboard(msg, `Bitte wähle die ${playerLabel} des Spiels`, availablePlayers, 1);
    }

    public async addWinner(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);

        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.sendMessage(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const winners = (cachedUserInput?.winners || []).concat(userInput);

        this.addCachedUserInput(msg, CacheRoute.newgame, { winners });


        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => winners.includes(player) === false)

        if (availablePlayers.length === cup.type) {
            for (const player of availablePlayers) {
                await this.addLoser(msg, player);
            }
        }

        if (winners.length === cup.type) {
            await this.updateBotState(msg, BotState.NEW_GAME_WINNERS_SET);
            return await this.askForPlayer(msg, 'Verlierer', cup);
        }

        return this.askForPlayer(msg, 'Gewinner', cup);
    }

    public async addLoser(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);


        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.sendMessage(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const losers = (cachedUserInput?.losers || []).concat(userInput);
        this.addCachedUserInput(msg, CacheRoute.newgame, { losers });

        if (losers.length === cup.type) {
            // TODO: Zusammenfassing des spiels ZUM SPEICHERN ANZEIGEN
            await this.updateBotState(msg, BotState.NEW_GAME_CONFIRM);
            return await this.confirmCreateGame(msg);
        }

        return await this.askForPlayer(msg, 'Verlierer', cup);
    }


    public async confirmCreateGame(msg: Message): Promise<Message> {
        const { winners, losers } = this.getCachedUserInput(msg, CacheRoute.newgame);

        const textReply = [
            `<b>${winners.join(', ')}</b> (Gewinner)`,
            `vs`,
            `<b>${losers.join(', ')}</b> (Verlierer)`,
            'Schwörst du bei den Bierponggöttern, dass deine Angaben wahrheitsgemäß sind?',
        ].join('\n')

        await this.updateBotState(msg, BotState.NEW_GAME_CONFIRM);
        return this.sendMessageWithKeyboard(msg, textReply, ['JA', 'NEIN'], 2);
    }


    public async createGame(msg: Message, confirmResponse: string, user: TUser): Promise<Message> {
        if (confirmResponse === 'JA') {
            const createGameData = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);
            // TODO: maybe add cache for remebering the cup? another botstate

            const cup = await this.cupService.getByName(createGameData.cupName);
            const winners = await this.userService.getMultipleByName(createGameData.winners);
            const losers = await this.userService.getMultipleByName(createGameData.losers);


            const createGameDto = new CreateGameDto(cup, winners, losers);
            await this.gameService.createGame(createGameDto);

            await this.eloService.updateElos(cup, winners, losers);

            // TODO: send broadcast to every mensch except creating user
            // Idea: send sad emoji and send winning emoji (like biceps flex) for losers and winners
            this.cachedUserInput.delete(msg.from.id);
            await this.updateBotState(msg, BotState.ON);
            return this.sendMessage(msg, 'Spiel eingetragen.');
        }

        if (confirmResponse === 'NEIN') {
            this.cachedUserInput.delete(msg.from.id);
            return this.cancelBot(msg, 'Eintragen des Spiels abgebrochen.');
        }

        const textReply = 'Ich habe dich nicht verstanden, bitte antworte laut mit <b>JA</b> oder <b>NEIN</b>';
        return this.sendMessage(msg, textReply, false);
    }

    public async getMyGames(msg: Message, user: TUser): Promise<Message> {
        const userWithRelations = await this.userService.getById(user.id, false, true);
        const gameIds = [];

        gameIds.push(...userWithRelations.gamesLost.map((game) => game.id));
        gameIds.push(...userWithRelations.gamesWon.map((game) => game.id));

        if (gameIds.length === 0) {
            return this.sendMessage(msg, 'Du hast an keinem Spiel teilgenommen!');
        }

        const games = await this.gameService.getGamesByIds(gameIds);

        const textReply = games.map((game) => {
            return ChatUtils.getFormattedGameWithUser(game, userWithRelations);
        }).join('\n')

        return this.sendMessage(msg, textReply);
    }

    public async getAllGames(msg: Message): Promise<Message> {
        const allGames = await this.gameService.getAllGames();

        console.log({ allGames });

        return this.sendMessage(msg, JSON.stringify(allGames));
    }

    public async getElo(msg: Message, user: TUser): Promise<Message> {
        const elos = await this.eloService.getByUserIdWithCups(user.id);

        if (elos.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_JOINED_CUPS);
        }

        const textReply = elos.map((elo) => ChatUtils.getEloForCup(elo.cup, elo.elo)).join('\n');

        return this.sendMessage(msg, textReply);
    }

    private setCachedUserInput<T = any>(msg: Message, cacheRoute: CacheRoute, input: Partial<T>): void {
        this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: input })
    }

    private addCachedUserInput<T = any>(msg: Message, cacheRoute: CacheRoute, input: Partial<T> | T): void {
        const cachedUserInput = this.cachedUserInput.get(msg.from.id);

        if (cachedUserInput.route !== cacheRoute) {
            throw new ChatError(ChatErrorMessage.CACHE_INVALID_FORMAT);
        }

        if (cachedUserInput?.data instanceof Array && input instanceof Array) {
            this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: [...cachedUserInput.data, ...input] })
            return;
        }

        if (cachedUserInput?.data instanceof Object) {
            this.cachedUserInput.set(msg.from.id, { route: cacheRoute, data: { ...cachedUserInput.data, ...input } })
            return;
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

    private sendMessage(msg: Message, text: string, shouldRemoveKeyboard = true): Promise<Message> {
        const options: SendMessageOptions = {
            reply_markup: {
                remove_keyboard: shouldRemoveKeyboard,
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