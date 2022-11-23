import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {Message, SendMessageOptions} from "node-telegram-bot-api";
import {Command} from "@webserver/bot/commands.constant";
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

@Injectable()
export class BotService {
    private bot: TelegramBot;
    private cachedUserInput: Map<number, Array<string>>;

    public constructor(@Inject(UserService) private readonly userService: UserService,
                       @Inject(CupService) private readonly cupService: CupService) {
        this.cachedUserInput = new Map<number, Array<string>>();
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
                return this.deleteCup(msg, user);
            case Command.GET_ALL_CUPS:
                return this.getAllCups(msg);
            case Command.GET_JOINED_CUPS:
                return this.getJoinedCups(msg, user);
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
                return this.sendMessage(msg, `Name bereits vergeben. Bitte versuche es erneut.`);
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

        this.cachedUserInput.set(msg.from.id, []);

        if (!user) {
            if (msg.from.username === undefined) {
                return this.sendMessage(msg, 'Du musst vorher in den Telegram-Einstellungen einen Benutzernamen anlegen.')
            }

            await this.userService.create(new CreateUserDto(msg.from.username, msg.from.id));
            return this.sendMessage(msg, getInitialGreeting(name));
        }

        if (user.botState === BotState.OFF) {
            await this.userService.updateBotstate(msg.from.id, BotState.ON);
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
        await this.userService.updateBotstate(msg.from.id, BotState.OFF);
        return this.bot.sendMessage(msg.chat.id, getFarewell(name));
    }

    private async cancelBot(msg: Message, infoText = ''): Promise<Message> {
        const user = await this.userService.getByTelegramId(msg.from.id);

        if (user.botState === BotState.ON) {
            return this.bot.sendMessage(msg.chat.id, 'Mir doch egal, hab grad eh nichts gemacht...');
        }

        await this.userService.updateBotstate(msg.from.id, BotState.ON);
        await this.sendMessage(msg, 'Aktueller Vorgang wurde abgebrochen!');
    }

    private sendHelp(chatId: number): Promise<Message> {
        return this.bot.sendMessage(chatId,
            '/help - zeige alle erlaubten Befehle\n' +
            '/start - startet den Bot\n' +
            '/stop - stoppt den Bot\n' +
            '/newcup - erstelle einen neuen Cup'
        );
    }

    private async startNewCup(msg: Message): Promise<Message> {
        await this.userService.updateBotstate(msg.from.id, BotState.START_NEW_CUP);

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

        this.cachedUserInput.set(msg.from.id, [userInput]);

        await this.userService.updateBotstate(msg.from.id, BotState.NEW_CUP_NAME_SET);

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

        const cachedUserInput = this.cachedUserInput.get(msg.from.id);

        const cup = await this.cupService.create(user, new CreateCupDto(cachedUserInput[0], endDate.toDate()));
        await this.userService.updateBotstate(msg.from.id, BotState.ON);
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

        await this.userService.updateBotstate(msg.from.id, BotState.JOIN_CUP);

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

    private async deleteCup(msg: Message, user: TUser): Promise<Message> {
        const userEntity = await this.userService.getById(user.id, false, true);
        const textReply = 'Welchen deiner Cups möchtest du löschen?';
        const keyBoardReply = userEntity.ownedCups.map((cup) => cup.name);

        await this.userService.updateBotstate(msg.from.id, BotState.DEL_CUP);
        return await this.sendMessageWithKeyboard(msg, textReply, keyBoardReply, 1);
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
}