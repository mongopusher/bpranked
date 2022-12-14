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
import {ChatUtils, DATE_FORMAT_DE} from "@webserver/bot/utils/chat.utils";
import {TUser} from "@webserver/user/types/user.type";
import {helpMessage} from "@webserver/bot/commands/help-message.constant";
import {GameService} from "@webserver/game/game.service";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {CupEntity} from "@webserver/cup/cup.entity";
import {EloService} from "@webserver/elo/elo.service";
import {CreateEloDto} from "@webserver/elo/dto/create-elo.dto";
import {EMOJI} from "@webserver/bot/utils/emoji.constant";
import {CupMode} from "@webserver/cup/cup-mode.enum";
import {CUP, CUPS} from "@webserver/cup/cup.constant";

const DELETE_CONFIRM_STRING = 'lösch dich';

enum CacheRoute {
    empty = '',
    newcup = 'newcup',
    joincup = 'joincup',
    delcup = 'delcup',
    newgame = 'newgame',
    gameconfirmation = 'gameconfirmation'
}

type TNewGameCache = {
    cupName: string;
    winners?: Array<string>,
    losers?: Array<string>,
    acceptingLosers?: Array<string>,
}

type TNewCupCache = {
    cupMode: CupMode;
    cupName?: string;
}

type TGameConfirmationCache = {
    creatorName: string;
    cupName: string;
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
                return this.answer(msg, getCheers());
            case Command.GIB:
                return this.answer(msg, gib());
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
            case BotState.NEW_GAME_LOSERS_SET:
                return this.broadcastCreateGameConfirmation(msg, userInput, user);
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
                return this.answer(msg, `Bitte wähle einen kürzeren Namen. Maximal ${error.data} Zeichen.`);
            case ChatErrorMessage.ILLEGAL_CHARACTER:
                return this.answer(msg, `Unerlaubte Schriftzeichen erkannt. Bitte verwende nur ${error.data}.`);
            case ChatErrorMessage.INVALID_DATE_FORMAT:
                return this.answer(msg, `Ungültiges Datenformat. Bitte gib das Datum im Format ${error.data} an.`);
            case ChatErrorMessage.INVALID_DATE:
                return this.answer(msg, `Ungültiges Datum. Bitte wähle ein Datum, das in der Zukunft liegt.`);
            case ChatErrorMessage.DUPLICATE_NAME:
                return this.answer(msg, `Name bereits vorhanden. Bitte wähle einen anderen.`);
            case ChatErrorMessage.NO_CUPS:
                return this.answer(msg, `Es gibt noch keine Cups. Du kannst einen erstellen mit /newcup`);
            case ChatErrorMessage.NO_ACTIVE_CUPS:
                return this.answer(msg, `Es gibt keine aktiven Cups. Du kannst einen erstellen mit /newcup`);
            case ChatErrorMessage.NO_JOINED_CUPS:
                return this.answer(msg, `Du nimmst an keinem Cup teil. Tritt einem Cup bei mit /joincup`);
            case ChatErrorMessage.TOO_FEW_PLAYERS_IN_CUP:
                return this.cancelBot(msg, `Für ein Spiel in diesem Cup benötigst du mindestens ${error.data} Spieler!`);
            case ChatErrorMessage.CACHE_INVALID_FORMAT:
                return this.cancelBot(msg, `Cache enthält ungültige Daten. Das dürfte nicht passieren. Bitte informiere den Administrator.`);
            case ChatErrorMessage.CACHE_EMPTY:
                return this.cancelBot(msg, `Cache leer obwohl er es nicht sein sollte. Bitte versuche den Prozess erneut zu starten.`);
            case ChatErrorMessage.UNAVAILABLE_PLAYER:
                return this.cancelBot(msg, `Spieler nicht verfügbar.`);
            case ChatErrorMessage.ILLEGAL_ACTION:
                return this.cancelBot(msg, `Unerlaubte Aktion! Vorgang wird abgebrochen.`);
            default:
                return this.answer(msg, `Ein unbekannter Fehler ist aufgetreten: ${error}`);
        }

    }

    private shouldAcceptTextFromUser(user: TUser): boolean {
        return acceptTextBotStates.includes(user.botState)
    }

    private async startBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        const user = await this.userService.getByTelegramId(msg.from.id);

        this.setCachedUserInput(msg.from.id, CacheRoute.empty, undefined);

        if (!user) {
            if (msg.from.username === undefined) {
                return this.answer(msg, 'Du musst vorher in den Telegram-Einstellungen einen Benutzernamen anlegen.')
            }

            await this.userService.create(new CreateUserDto(msg.from.username, msg.from.id, msg.chat.id));
            return this.answer(msg, getInitialGreeting(name));
        }

        if (user.botState === BotState.OFF) {
            await this.updateBotState(msg.from.id, BotState.ON);
            return this.answer(msg, getGreeting(name));
        }

        return this.sendHelp(msg.chat.id);
    }

    private async stopBot(user: TUser, msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        if (user.botState === BotState.OFF) {
            return;
        }

        this.cachedUserInput.delete(msg.from.id);
        await this.updateBotState(msg.from.id, BotState.OFF);
        return this.bot.sendMessage(msg.chat.id, getFarewell(name));
    }

    private async cancelBot(msg: Message, infoText?: string | undefined): Promise<Message> {
        const user = await this.userService.getByTelegramId(msg.from.id);

        if (user.botState === BotState.ON) {
            return this.sendMessage(msg.from.id, infoText ?? `Mir doch egal ${EMOJI.SHRUG} hab grad eh nichts gemacht...`);
        }

        await this.updateBotState(msg.from.id, BotState.ON);
        await this.sendMessage(msg.from.id, infoText ?? 'Aktueller Vorgang wurde abgebrochen!');
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
        await this.updateBotState(msg.from.id, BotState.START_NEW_CUP);

        const textReply = `Bitte wähle aus, was in deinem Cup gespielt werden soll.`

        const keyBoardData = [CUP[CupMode.One], CUP[CupMode.Two], CUP[CupMode.Three]];

        return this.answerWithKeyboard(msg, textReply, keyBoardData, 1);
    }

    private async chooseCupType(msg: Message, userInput: string): Promise<Message> {
        if (CUPS.includes(userInput) === false) {
            return this.answer(msg, 'Ungültige Eingabe!', false);
        }

        this.setCachedUserInput<TNewCupCache>(msg.from.id, CacheRoute.newcup, { cupMode: CUP[userInput] });

        await this.updateBotState(msg.from.id, BotState.NEW_CUP_TYPE_SET);

        return this.answer(msg, 'Bitte gib einen Namen für den Cup an.');
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

        this.addCachedUserInput<TNewCupCache>(msg.from.id, CacheRoute.newcup, { cupName })

        await this.updateBotState(msg.from.id, BotState.NEW_CUP_NAME_SET);

        const textReply = `Bitte sende mir den Endzeitpunkt für den Cup im Format ${DATE_FORMAT_DE}.`

        return this.answer(msg, textReply);
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

        const { cupName, cupMode } = this.getCachedUserInput<TNewCupCache>(msg.from.id, CacheRoute.newcup);
        console.log({ cupMode });


        const cup = await this.cupService.create(user, new CreateCupDto(cupName, cupMode, endDate.toDate()));
        await this.updateBotState(msg.from.id, BotState.ON);
        return await this.answer(msg, `Cup <i>${cup.name}</i> erstellt!`);
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

        await this.updateBotState(msg.from.id, BotState.JOIN_CUP);

        return await this.answerWithKeyboard(msg, responseText, keyBoardData, 1);
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

        return this.answer(msg, textReply);
    }

    public async getAllCups(msg: Message) {
        const cups = await this.cupService.getAllWithRelations();

        if (cups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_CUPS)
        }

        const textReply = cups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');
        return await this.answer(msg, textReply)
    }

    private async getJoinedCups(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);

        if (userEntity.attendedCups.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_JOINED_CUPS);
        }

        const textReply = userEntity.attendedCups.map((cup) => ChatUtils.getFormattedCup(cup)).join('\n\n');

        return this.answer(msg, textReply)
    }

    private async startDeleteCup(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);

        if (userEntity.ownedCups.length === 0) {
            return this.cancelBot(msg, 'Du hast noch keinen Cup!');
        }

        const keyBoardReply = userEntity.ownedCups.map((cup) => cup.name);

        await this.updateBotState(msg.from.id, BotState.DEL_CUP);

        const textReply = 'Welchen deiner Cups möchtest du löschen?';
        return await this.answerWithKeyboard(msg, textReply, keyBoardReply, 1);
    }

    private async confirmDeleteCup(msg: Message, input: string, user: TUser): Promise<Message> {
        const { ownedCups } = await this.userService.getById(user.id, false, true);

        const cupToDelete = ownedCups.find((cup) => cup.name === input)

        if (cupToDelete === undefined) {
            return this.cancelBot(msg);
        }

        this.setCachedUserInput(msg.from.id, CacheRoute.delcup, cupToDelete.id)
        const textReply = `Möchtest du <b>${input}</b> wirklich löschne? Bitte gib zur Bestätigung <i>${DELETE_CONFIRM_STRING}</i> ein.`;

        await this.updateBotState(msg.from.id, BotState.DEL_CUP_CONFIRM);
        return await this.answer(msg, textReply);
    }

    private async deleteCup(msg: Message, input: string): Promise<Message> {
        if (input !== DELETE_CONFIRM_STRING) {
            return this.cancelBot(msg);
        }

        const cupId = this.getCachedUserInput(msg.from.id, CacheRoute.delcup);

        const cup = await this.cupService.getById(cupId);

        await this.cupService.deleteById(cupId);
        const textReply = `<i>${cup.name}</i> wurde gelöscht.`;

        await this.updateBotState(msg.from.id, BotState.ON);
        return await this.answer(msg, textReply);
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

        await this.updateBotState(msg.from.id, BotState.START_NEW_GAME);
        return this.answerWithKeyboard(msg, 'Bitte wähle in welchem Cup das Spiel stattfindet', cups, 2);
    }

    public async chooseCupForGame(msg, cupName, user: TUser): Promise<Message> {
        const cup = await this.cupService.getByName(cupName);

        if (cup.name !== cupName) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_ACTION);
        }

        if (cup.attendees.length < cup.mode * 2) {
            throw new ChatError(ChatErrorMessage.TOO_FEW_PLAYERS_IN_CUP, cup.mode * 2);
        }

        if (cup.attendees.some((attendee) => attendee.username === user.username) === false) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_ACTION);
        }

        this.setCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame, { cupName })
        await this.updateBotState(msg.from.id, BotState.NEW_GAME_CUP_SET);
        return this.askForPlayer(msg, 'Gewinner', cup);
    }

    public async askForPlayer(msg, playerLabel: 'Gewinner' | 'Verlierer', cup: CupEntity): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg, CacheRoute.newgame);
        const winners = cachedUserInput?.winners || [];
        const losers = cachedUserInput?.losers || [];

        const usedPlayers = winners.concat(losers);
        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => usedPlayers.includes(player) === false)

        return this.answerWithKeyboard(msg, `Bitte wähle die ${playerLabel} des Spiels`, availablePlayers, 1);
    }

    public async addWinner(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg.from.id, CacheRoute.newgame);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);

        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.answer(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const winners = (cachedUserInput?.winners || []).concat(userInput);

        this.addCachedUserInput(msg.from.id, CacheRoute.newgame, { winners });


        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => winners.includes(player) === false)

        if (availablePlayers.length === cup.mode) {
            this.addCachedUserInput(msg.from.id, CacheRoute.newgame, { losers: availablePlayers });

            return await this.confirmCreateGame(msg);
        }

        if (winners.length === cup.mode) {
            await this.updateBotState(msg.from.id, BotState.NEW_GAME_WINNERS_SET);
            return await this.askForPlayer(msg, 'Verlierer', cup);
        }

        return this.askForPlayer(msg, 'Gewinner', cup);
    }

    public async addLoser(msg: Message, userInput: string): Promise<Message> {
        const cachedUserInput = this.getCachedUserInput<TNewGameCache>(msg.from.id, CacheRoute.newgame);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);


        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.answer(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const losers = (cachedUserInput?.losers || []).concat(userInput);
        this.addCachedUserInput(msg.from.id, CacheRoute.newgame, { losers });

        if (losers.length === cup.mode) {
            return await this.confirmCreateGame(msg);
        }

        return await this.askForPlayer(msg, 'Verlierer', cup);
    }


    public async confirmCreateGame(msg: Message): Promise<Message> {
        const { winners, losers } = this.getCachedUserInput(msg.from.id, CacheRoute.newgame);

        const textReply = [
            `${EMOJI.GLOWING_STAR} <b>${winners.join(', ')}</b> (Gewinner)`,
            `gegen`,
            `${EMOJI.SKULL} <b>${losers.join(', ')}</b> (Verlierer)`,
            '',
            'Schwörst du bei den Bierponggöttern, dass deine Angaben wahrheitsgemäß sind?',
        ].join('\n')

        await this.updateBotState(msg.from.id, BotState.NEW_GAME_LOSERS_SET);
        return this.answerWithKeyboard(msg, textReply, ['Ja!', 'Nein.'], 2);
    }

    public async broadcastCreateGameConfirmation(msg: Message, confirmResponse: string, user: TUser): Promise<Message> {
        if (ChatUtils.isTruthy(confirmResponse) === true) {
            const newGameCache = this.getCachedUserInput<TNewGameCache>(msg.from.id, CacheRoute.newgame);
            // TODO: maybe add cache for remebering the cup? another botstate

            const winners = await this.userService.getMultipleByName(newGameCache.winners);
            const losers = await this.userService.getMultipleByName(newGameCache.losers);

            // break here
            for (const player of losers) {
                const loser = await this.userService.getById(player.id);

                if (player.id === user.id) {
                    this.processSuccessfulCreateGameConfirmation(msg.from.id, player.username);
                    continue;
                }

                if (player.botState === BotState.OFF) {
                    await this.answer(msg, `${player.username} ist offline und wird nicht um Bestätigung gefragt`);
                    this.processSuccessfulCreateGameConfirmation(msg.from.id, player.username);
                    continue;
                }

                let broadCastText = '';
                if (player.botState !== BotState.ON) {
                    broadCastText = 'Tut mir leid, dass ich dich unterbrechen muss.\n';
                }

                await this.updateBotState(loser.telegramId, BotState.NEW_GAME_BROADCAST_SENT);

                this.setCachedUserInput<TGameConfirmationCache>(loser.telegramId, CacheRoute.gameconfirmation, {
                    creatorName: user.username,
                    cupName: newGameCache.cupName,
                });

                broadCastText += 'Du hast eben ein Spiel gegen verloren, oder?' + ChatUtils.getGameMessage(losers, winners, player);

                await this.askForPlayerConfirmation(player.chatId, broadCastText);
            }

            await this.updateBotState(msg.from.id, BotState.ON);
            return this.answer(msg, 'Spiel vorgemerkt. Einer der Verlierer muss das Spiel nun bestätigen.');
        }

        if (ChatUtils.isFalsy(confirmResponse) === true) {
            this.cachedUserInput.delete(msg.from.id);
            return this.cancelBot(msg, 'Eintragen des Spiels abgebrochen.');
        }

        const textReply = 'Ich habe dich nicht verstanden, bitte antworte laut mit <b>JA</b> oder <b>NEIN</b>';
        return this.answer(msg, textReply, false);
    }

    public async receiveCreateGameConfirmation(msg: Message, userInput: string, user: TUser): Promise<Message> {
        const confirmationCache = this.getCachedUserInput<TGameConfirmationCache>(msg.from.id, CacheRoute.gameconfirmation);
        const creator = await this.userService.getByUsername(confirmationCache.creatorName);

        if (ChatUtils.isFalsy(userInput) === true) {
            this.cachedUserInput.delete(creator.telegramId);
            await this.updateBotState(creator.telegramId, BotState.ON);
            // TODO: hier ebenfalls broadcasten an alle
            await this.sendMessage(creator.chatId, `${user.username} hat das Spiel abgelehnt. Vorgang abgebrochen!`);
        }

        if (ChatUtils.isTruthy(userInput) === true) {
            this.processSuccessfulCreateGameConfirmation(creator.telegramId, user.username);
        }

        return this.answer(msg, 'Ich habe dich nicht verstanden.', false);
    }

    private async processSuccessfulCreateGameConfirmation(creatorTelegramId: number, ownUsername: string): Promise<void> {
        const newGameCache = this.getCachedUserInput<TNewGameCache>(creatorTelegramId, CacheRoute.newgame);

        const acceptingLosers = newGameCache.acceptingLosers ?? [];
        acceptingLosers.push(ownUsername);

        if (acceptingLosers.length !== newGameCache.losers.length) {
            this.addCachedUserInput<TNewGameCache>(creatorTelegramId, CacheRoute.newgame, { acceptingLosers: [...acceptingLosers] })
            return;
        }

        // TODO: test 4 real for equal
        if (acceptingLosers.length === newGameCache.losers.length) {
            const cup = await this.cupService.getByName(newGameCache.cupName);
            const winners = await this.userService.getMultipleByName(newGameCache.winners);
            const losers = await this.userService.getMultipleByName(newGameCache.losers);

            const createGameDto = new CreateGameDto(cup, winners, losers);
            await this.gameService.createGame(createGameDto);

            await this.eloService.updateElos(cup, winners, losers);

            let isCreatorIncluded = false;
            for (const winner of winners) {
                await this.sendMessage(winner.chatId, 'Sieg eingetragen!');
                await this.updateBotState(winner.telegramId, BotState.ON);
                this.cachedUserInput.delete(winner.telegramId);
                if (winner.id === creatorTelegramId) {
                    isCreatorIncluded = true;
                }
            }

            for (const loser of losers) {
                await this.sendMessage(loser.chatId, 'Niederlage eingetragen!');
                await this.updateBotState(loser.telegramId, BotState.ON);
                this.cachedUserInput.delete(loser.telegramId);
                if (loser.id === creatorTelegramId) {
                    isCreatorIncluded = true;
                }
            }

            if (isCreatorIncluded === false) {
                const creator = await this.userService.getByTelegramId(creatorTelegramId);
                await this.updateBotState(creator.telegramId, BotState.ON);
                this.cachedUserInput.delete(creator.telegramId);
                await this.sendMessage(creator.chatId, 'Spiel eingetragen!');
            }
        }
    }

    public async getMyGames(msg: Message, user: TUser): Promise<Message> {
        const userWithRelations = await this.userService.getById(user.id, false, true);
        const gameIds = [];

        gameIds.push(...userWithRelations.gamesLost.map((game) => game.id));
        gameIds.push(...userWithRelations.gamesWon.map((game) => game.id));

        if (gameIds.length === 0) {
            return this.answer(msg, 'Du hast an keinem Spiel teilgenommen!');
        }

        const games = await this.gameService.getGamesByIds(gameIds);

        const textReply = games.map((game) => {
            return ChatUtils.getFormattedGameWithUser(game, userWithRelations);
        }).join('\n')

        return this.answer(msg, textReply);
    }

    public async getAllGames(msg: Message): Promise<Message> {
        const allGames = await this.gameService.getAllGames();

        console.log({ allGames });

        return this.answer(msg, JSON.stringify(allGames));
    }

    public async getElo(msg: Message, user: TUser): Promise<Message> {
        const elos = await this.eloService.getByUserIdWithCups(user.id);

        if (elos.length === 0) {
            throw new ChatError(ChatErrorMessage.NO_JOINED_CUPS);
        }

        const textReply = elos.map((elo) => ChatUtils.getEloForCup(elo.cup, elo.elo)).join('\n');

        return this.answer(msg, textReply);
    }

    private askForPlayerConfirmation(chatId: number, text: string): Promise<Message> {
        return this.sendMessageWithKeyboard(chatId, text, [`Ja.`], 2)
    }

    private setCachedUserInput<T = any>(telegramId: number, cacheRoute: CacheRoute, input: Partial<T>): void {
        this.cachedUserInput.set(telegramId, { route: cacheRoute, data: input })
    }

    private addCachedUserInput<T = any>(telegramId: number, cacheRoute: CacheRoute, input: Partial<T> | T): void {
        const cachedUserInput = this.cachedUserInput.get(telegramId);

        if (cachedUserInput.route !== cacheRoute) {
            throw new ChatError(ChatErrorMessage.CACHE_INVALID_FORMAT);
        }

        if (cachedUserInput?.data instanceof Array && input instanceof Array) {
            this.cachedUserInput.set(telegramId, { route: cacheRoute, data: [...cachedUserInput.data, ...input] })
            return;
        }

        if (cachedUserInput?.data instanceof Object) {
            this.cachedUserInput.set(telegramId, { route: cacheRoute, data: { ...cachedUserInput.data, ...input } })
            return;
        }

        this.cachedUserInput.set(telegramId, { route: cacheRoute, data: input })
    }


    private getCachedUserInput<T = any>(telegramId: number, cacheRoute: CacheRoute): T {
        if (this.cachedUserInput.has(telegramId) === false) {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }

        const cachedUserInput = this.cachedUserInput.get(telegramId);

        if (cachedUserInput.data === [] || cachedUserInput.data === '') {
            throw new ChatError(ChatErrorMessage.CACHE_EMPTY);
        }

        if (cachedUserInput.route !== cacheRoute) {
            throw new ChatError(ChatErrorMessage.CACHE_INVALID_FORMAT);
        }
        return cachedUserInput.data;
    }

    private answer(msg: Message, text: string, shouldRemoveKeyboard = true): Promise<Message> {
        return this.sendMessage(msg.chat.id, text, shouldRemoveKeyboard)
    };

    private sendMessage(chatId: number, text: string, shouldRemoveKeyboard = true): Promise<Message> {
        const options: SendMessageOptions = {
            reply_markup: {
                remove_keyboard: shouldRemoveKeyboard,
            },
            parse_mode: 'HTML',
        };

        return this.bot.sendMessage(chatId, text, options);
    }

    private answerWithKeyboard(msg: Message, text: string, keyBoardData: Array<any>, columns: number): Promise<Message> {
        return this.sendMessageWithKeyboard(msg.chat.id, text, keyBoardData, columns);
    };

    private sendMessageWithKeyboard(chatId: number, text: string, keyBoardData: Array<any>, columns: number): Promise<Message> {
        const options: SendMessageOptions = {
            reply_markup: ChatUtils.getKeyboardMarkup(keyBoardData, columns),
            parse_mode: 'HTML',
        };

        return this.bot.sendMessage(chatId, text, options)
    };


    private updateBotState(telegramId: number, botState: BotState): Promise<TUser> {
        return this.userService.updateBotstate(telegramId, botState);
    }
}