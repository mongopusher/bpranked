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
import {CUP, CUP_TEXTS, CUPS_REVERSED} from "@webserver/cup/cup.constant";
import {CacheService} from "@webserver/bot/cache/cache.service";

const DELETE_CONFIRM_STRING = 'lösch dich';

@Injectable()
export class BotService {
    private bot: TelegramBot;
    private developerIds: Array<string>;
    private bugReportGroupUrl: string;

    public constructor(@Inject(UserService) private readonly userService: UserService,
                       @Inject(CupService) private readonly cupService: CupService,
                       @Inject(GameService) private readonly gameService: GameService,
                       @Inject(CacheService) private readonly cacheService: CacheService,
                       @Inject(EloService) private readonly eloService: EloService) {
    }

    public async initialize(): Promise<void> {
        const token = process.env.BOT_TOKEN;
        this.developerIds = process.env.DEVELOPER_IDS.split(',');
        this.bugReportGroupUrl = process.env.BUG_REPORT_GROUP_URL;


        this.bot = new TelegramBot(token, { polling: true });

        this.bot.on('message', async (msg) => {
            if (msg.chat.type !== 'private') {
                // TODO: add support for specific commands like show highscore
                console.log({ msg });
                return;
            }

            try {
                await this.handleMessage(msg);
            } catch (error) {
                if (error instanceof ChatError) {
                    return this.handleChatError(msg, error);
                }

                console.log(error);
                const response = [
                    'Ein unbekannter Fehler ist aufgetreten, bitte erstelle ein <a href="https://github.com/mongopusher/bpranked/issues/new">Bugticket</a> und füge deinen Chatverlauf als Screenshot hinzu.',
                    `Alternativ kannst du deinen Screenshot auch in diese <a href="${this.bugReportGroupUrl}">Gruppe</a> senden`,
                    '',
                    error
                ]

                return this.cancelBot(msg, response.join('\n'));

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

    private async handleCommand(msg: Message, command: Command | string | undefined): Promise<any> {
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

        if (command.startsWith(Command.PROXY)) {
            return this.proxyFunction(user, msg, command);
        }

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

    private async handleText(msg: Message, userInput: string): Promise<any> {
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
                return this.chooseCupType(msg, userInput, user);
            case BotState.NEW_CUP_TYPE_SET:
                return this.setCupName(msg, userInput, user);
            case BotState.NEW_CUP_NAME_SET:
                return this.createCup(msg, userInput, user);
            case BotState.JOIN_CUP:
                return this.joinCup(msg, userInput, user);
            case BotState.DEL_CUP:
                return this.confirmDeleteCup(msg, userInput, user);
            case BotState.DEL_CUP_CONFIRM:
                return this.deleteCup(msg, userInput, user);
            case BotState.START_NEW_GAME:
                return this.chooseCupForGame(msg, userInput, user);
            case BotState.NEW_GAME_CUP_SET:
                return this.addWinner(msg, userInput, user);
            case BotState.NEW_GAME_WINNERS_SET:
                return this.addLoser(msg, userInput, user);
            case BotState.NEW_GAME_LOSERS_SET:
                return this.finishNewGame(msg, userInput, user);
            case BotState.GAME_CONFIRMATION:
                return this.receiveCreateGameConfirmation(userInput, user);
            default:
                throw new Error('THIS SHOULD NEVER HAPPEN');
        }
    }

    private async handleChatError(msg: Message, error: ChatError): Promise<Message> {
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
            case ChatErrorMessage.INSUFFICIENT_RIGHTS:
                return this.cancelBot(msg, `Du musst ${error.data} sein um diese Aktion zu tätigen! Vorgang wird abgebrochen.`);
            default:
                return this.answer(msg, `Ein unbekannter Fehler ist aufgetreten: ${error}`);
        }

    }

    private shouldAcceptTextFromUser(user: TUser): boolean {
        return acceptTextBotStates.includes(user.botState)
    }

    private async proxyFunction(me: TUser, msg: Message, paramString: string): Promise<void> {
        if (this.developerIds.includes(msg.from.id.toString()) !== true) {
            throw new ChatError(ChatErrorMessage.INSUFFICIENT_RIGHTS, 'Entwickler');
        }

        const params = paramString.split(' ', 3);

        console.log({ commands: params });

        if (params[1] === 'error') {
            throw new Error('Intentionally thrown error for testing purpose');
        }

        if (params[1] === 'link') {
            await this.sendMessage(msg.chat.id, `<a href="${params[2]}">Test Link</a>`)
        }

        // if (params[1] === 'confirm') {
        //     await this.processSuccessfulCreateGameConfirmation(me, params[2]);
        // }
    }

    private async startBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        const user = await this.userService.getByTelegramId(msg.from.id);

        if (!user) {
            if (msg.from.username === undefined) {
                return this.answer(msg, 'Du musst vorher in den Telegram-Einstellungen einen Benutzernamen anlegen.')
            }

            await this.userService.create(new CreateUserDto(msg.from.username, msg.from.id, msg.chat.id));
            return this.answer(msg, getInitialGreeting(name));
        }

        this.cacheService.deleteAll(user.id);

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

        this.cacheService.deleteAll(user.id);
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

    private async chooseCupType(msg: Message, userInput: string, user: TUser): Promise<Message> {
        if (CUP_TEXTS.includes(userInput) === false) {
            return this.answer(msg, 'Ungültige Eingabe!', false);
        }

        this.cacheService.setNewCup(user.id, { cupMode: CUPS_REVERSED[userInput] });

        await this.updateBotState(msg.from.id, BotState.NEW_CUP_TYPE_SET);

        return this.answer(msg, 'Bitte gib einen Namen für den Cup an.');
    }

    private async setCupName(msg: Message, userInput: string, user: TUser): Promise<Message> | never {
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

        this.cacheService.addNewCup(user.id, { cupName })

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

        const { cupName, cupMode } = this.cacheService.getNewCup(user.id);

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

        this.cacheService.set(user.id, cupToDelete.id);
        const textReply = `Möchtest du <b>${input}</b> wirklich löschne? Bitte gib zur Bestätigung <i>${DELETE_CONFIRM_STRING}</i> ein.`;

        await this.updateBotState(msg.from.id, BotState.DEL_CUP_CONFIRM);
        return await this.answer(msg, textReply);
    }

    private async deleteCup(msg: Message, input: string, user: TUser): Promise<Message> {
        if (input !== DELETE_CONFIRM_STRING) {
            return this.cancelBot(msg);
        }

        const cupId = this.cacheService.get<number>(user.id);

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

        this.cacheService.setNewGame(user.id, { cupName })
        await this.updateBotState(msg.from.id, BotState.NEW_GAME_CUP_SET);
        return this.askForPlayer(msg, 'Gewinner', cup, user);
    }

    public async askForPlayer(msg: Message, playerLabel: 'Gewinner' | 'Verlierer', cup: CupEntity, user: TUser): Promise<Message> {
        const cachedUserInput = this.cacheService.getNewGame(user.id);
        const winners = cachedUserInput?.winners || [];
        const losers = cachedUserInput?.losers || [];

        const usedPlayers = winners.concat(losers);
        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => usedPlayers.includes(player) === false)

        return this.answerWithKeyboard(msg, `Bitte wähle die ${playerLabel} des Spiels`, availablePlayers, 1);
    }

    public async addWinner(msg: Message, userInput: string, user: TUser): Promise<Message> {
        const cachedUserInput = this.cacheService.getNewGame(user.id);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);

        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.answer(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const winners = (cachedUserInput?.winners || []).concat(userInput);

        this.cacheService.addNewGame(user.id, { winners });


        const availablePlayers = cup.attendees.map((player) => player.username)
            .filter((player) => winners.includes(player) === false)

        if (availablePlayers.length === cup.mode) {
            this.cacheService.addNewGame(user.id, { losers: availablePlayers });

            return await this.confirmCreateGame(msg, user);
        }

        if (winners.length === cup.mode) {
            await this.updateBotState(msg.from.id, BotState.NEW_GAME_WINNERS_SET);
            return await this.askForPlayer(msg, 'Verlierer', cup, user);
        }

        return this.askForPlayer(msg, 'Gewinner', cup, user);
    }

    public async addLoser(msg: Message, userInput: string, user): Promise<Message> {
        const cachedUserInput = this.cacheService.getNewGame(user.id);

        const cup = await this.cupService.getByName(cachedUserInput.cupName);


        if (cachedUserInput.winners?.includes(userInput) || cachedUserInput.losers?.includes(userInput)) {
            return this.answer(msg, 'Spieler ist bereits eingetragen!', false);
        }

        const losers = (cachedUserInput?.losers || []).concat(userInput);
        this.cacheService.addNewGame(user.id, { losers });

        if (losers.length === cup.mode) {
            return await this.confirmCreateGame(msg, user);
        }

        return await this.askForPlayer(msg, 'Verlierer', cup, user);
    }


    public async confirmCreateGame(msg: Message, user: TUser): Promise<Message> {
        const { winners, losers } = this.cacheService.getNewGame(user.id);

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

    public async finishNewGame(msg: Message, confirmResponse: string, user: TUser): Promise<void> {
        if (ChatUtils.isFalsy(confirmResponse) === true) {
            this.cacheService.deleteNewGame(user.id);
            await this.cancelBot(msg, 'Eintragen des Spiels abgebrochen.');
            return;
        }

        if (ChatUtils.isTruthy(confirmResponse) === true) {
            await this.updateBotState(msg.from.id, BotState.NEW_GAME_BROADCAST_SENT);

            const newGameCache = this.cacheService.getNewGame(user.id);
            const losers = await this.userService.getMultipleByName(newGameCache.losers);

            // you are the only loser, no need to confirm
            if (losers.length === 1 && losers[0].id === user.id) {
                return this.processSuccessfulCreateGameConfirmation(user, user);
            }

            for (const player of losers) {
                await this.broadcastToLosers(player, user, msg);
            }

            await this.updateBotState(msg.from.id, BotState.ON);
            await this.answer(msg, 'Spiel vorgemerkt. Die Verlierer müssen das Spiel nun bestätigen.');
            return;
        }

        const textReply = 'Ich habe dich nicht verstanden, bitte antworte laut mit <b>JA</b> oder <b>NEIN</b>';
        await this.answer(msg, textReply, false);
    }

    private async broadcastToLosers(loser: TUser, creator: TUser, originalMessage: Message) {
        if (loser.id === creator.id) {
            await this.processSuccessfulCreateGameConfirmation(creator, loser);
            return;
        }

        if (loser.botState === BotState.OFF) {
            await this.answer(originalMessage, `${loser.username} ist offline und wird nicht um Bestätigung gefragt`);
            await this.processSuccessfulCreateGameConfirmation(creator, loser);
            return;
        }

        let broadCastText = '';
        if (loser.botState !== BotState.ON) {
            broadCastText = 'Aktueller Vorgang wurde abgebrochen.\n';
        }

        const newGameCache = this.cacheService.getNewGame(creator.id);
        const winners = await this.userService.getMultipleByName(newGameCache.winners);
        const losers = await this.userService.getMultipleByName(newGameCache.losers);

        await this.updateBotState(loser.telegramId, BotState.GAME_CONFIRMATION);

        this.cacheService.setConfirmingGame(loser.id, {
            creatorName: creator.username,
            cupName: newGameCache.cupName,
        });

        broadCastText += `${ChatUtils.getUserLink(creator)} hat mir gezwitschert, dass du `;
        broadCastText += `${ChatUtils.getGameMessage(losers, winners, loser)} verloren hast ${EMOJI.LOUDLY_CRYING_FACE} Stimmt das?`;

        await this.askForPlayerConfirmation(loser.chatId, broadCastText);
    }

    public async receiveCreateGameConfirmation(userInput: string, user: TUser): Promise<Message> {
        const confirmationCache = this.cacheService.getConfirmingGame(user.id);
        const creator = await this.userService.getByUsername(confirmationCache.creatorName);

        if (ChatUtils.isFalsy(userInput) === true) {
            this.cacheService.deleteNewGame(creator.id);
            await this.updateBotState(creator.telegramId, BotState.ON);
            // TODO: hier ebenfalls broadcasten an alle
            await this.sendMessage(creator.chatId, `${ChatUtils.getUserLink(user)} hat das Spiel abgelehnt. Vorgang abgebrochen!`);
            return;
        }

        if (ChatUtils.isTruthy(userInput) === true) {
            await this.processSuccessfulCreateGameConfirmation(creator, user);
            return;
        }

        return this.sendMessage(user.chatId, 'Ich habe dich nicht verstanden.', false);
    }

    private async processSuccessfulCreateGameConfirmation(creator: TUser, user: TUser): Promise<void> {
        const newGameCache = this.cacheService.getNewGame(creator.id);
        const acceptingLosers = newGameCache.acceptingLosers ?? [];

        if (acceptingLosers.includes(user.username) === true) {
            await this.sendMessage(user.chatId, 'Du hast dieses Spiel bereits bestätigt.');
            return;
        }

        if (newGameCache.losers.includes(user.username) !== true) {
            await this.sendMessage(user.chatId, 'Du nimmst an diesem Spiel nicht teil!');
            return;
        }

        acceptingLosers.push(user.username);
        console.log({ acceptingLosers, newGameCache, creator })

        if (acceptingLosers.length < newGameCache.losers.length) {
            this.cacheService.addNewGame(creator.id, { acceptingLosers: [...acceptingLosers] })
            return;
        }

        if (acceptingLosers.length === newGameCache.losers.length) {
            const mergedLosers = new Set([...acceptingLosers, ...newGameCache.losers]);

            if (mergedLosers.size !== newGameCache.losers.length) {
                throw new ChatError(ChatErrorMessage.ILLEGAL_ACTION)
            }

            const cup = await this.cupService.getByName(newGameCache.cupName);
            const winners = await this.userService.getMultipleByName(newGameCache.winners);
            const losers = await this.userService.getMultipleByName(newGameCache.losers);

            const createGameDto = new CreateGameDto(cup, winners, losers);
            const game = await this.gameService.createGame(createGameDto);
            const formattedGame = ChatUtils.getGameSummary(game);
            await this.eloService.updateElos(cup, winners, losers);

            const subscribers = [...winners, ...losers].filter(({ username }) => username !== creator.username);
            console.log(subscribers);

            for (const subscriber of subscribers) {
                await this.sendMessage(subscriber.chatId, formattedGame);
                await this.updateBotState(subscriber.telegramId, BotState.ON);
                this.cacheService.deleteAll(subscriber.id);
            }

            console.log(`New game created in ${cup.name}`);
            console.log(`${subscribers.length} subscribers have been notified`);
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
        return this.sendMessageWithKeyboard(chatId, text, ['Ja.', 'Nein.'], 2)
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
            disable_web_page_preview: true
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
            disable_web_page_preview: true
        };

        return this.bot.sendMessage(chatId, text, options)
    };


    private updateBotState(telegramId: number, botState: BotState): Promise<TUser> {
        return this.userService.updateBotstate(telegramId, botState);
    }
}