import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {
    InlineKeyboardMarkup,
    Message,
    ReplyKeyboardMarkup,
    SendBasicOptions,
    SendMessageOptions
} from "node-telegram-bot-api";
import {Command} from "@webserver/bot/commands.constant";
import {acceptTextBotStates, BotState} from "@webserver/bot/bot-state.constant";
import {getFarewell, getGreeting, getInitialGreeting} from "@webserver/bot/message.utils";
import {UserService} from "@webserver/user/user.service";
import {CreateUserDto} from "@webserver/user/dto/createUser.dto";
import {UserEntity} from "@webserver/user/user.entity";
import {CupService} from "@webserver/cup/cup.service";
import {CreateCupDto} from "@webserver/cup/dto/createCup.dto";
import {REGEX} from "@webserver/bot/regex.constant";
import {ChatErrorMessage} from "@webserver/bot/chat-error-message.constant";
import {ChatError} from "@webserver/bot/error/chat-error";
import moment from "moment";
import {ReplyKeyboardUtils} from "@webserver/bot/reply-keyboard.utils";

const DATE_FORMAT_DE = 'DD.MM.YYYY';
const DATE_FORMAT_EXTENDED_DE = 'DD.MM.YYYY HH:mm:ss';

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

        this.bot = new TelegramBot(token, {polling: true});

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

        const user = await this.userService.getByTelegramId(msg.from.id)

        if (!user) {
            return;
        }

        if (user.botState === BotState.OFF) {
            return;
        }

        console.log(`processing command [${command}] for user [${user.username}]`)
        void await this.bot.sendChatAction(msg.chat.id, 'typing');

        switch (command) {
            case Command.STOP:
                return this.stopBot(user, msg);
            case Command.METADATA:
                return this.bot.sendMessage(msg.chat.id, JSON.stringify(msg));
            case Command.NEW_CUP:
                return this.startNewCup(msg);
            case Command.JOIN_CUP:
                return this.joinCup(msg);
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

        // TODO: check the whole file for usage of user id vs telegram id
        console.log(`User [${user.username}] is in [${user.botState}] and sent plain text: [${userInput}]`);
        switch (user.botState) {
            case BotState.START_NEW_CUP:
                return this.setCupName(msg, userInput);
            case BotState.NEW_CUP_NAME_SET:
                return this.createCup(msg, userInput, user);
            default:
                throw new Error('THIS SHOULD NEVER HAPPEN');
        }
    }

    private async handleChatError(msg: Message, error: ChatError): Promise<Message> {
        if (error instanceof ChatError) {
            console.log(error);

            switch (error.message) {
                case ChatErrorMessage.TOO_MANY_CHARACTERS:
                    return this.bot.sendMessage(msg.chat.id,
                        `Bitte wähle einen kürzeren Namen. Maximal ${error.data} Zeichen.`)
                case ChatErrorMessage.ILLEGAL_CHARACTER:
                    return this.bot.sendMessage(msg.chat.id,
                        `Unerlaubte Schriftzeichen erkannt. Bitte verwende nur ${error.data}.`)
                case ChatErrorMessage.INVALID_DATE_FORMAT:
                    return this.bot.sendMessage(msg.chat.id,
                        `Ungültiges Datenformat. Bitte gib das Datum im Format ${error.data} an.`)
                case ChatErrorMessage.INVALID_DATE:
                    return this.bot.sendMessage(msg.chat.id,
                        `Ungültiges Datum. Bitte wähle ein Datum, das in der Zukunft liegt.`)
                default:
                    return this.bot.sendMessage(msg.chat.id, `Ein unbekannter Fehler ist aufgetreten: ${error}`);
            }
        }
    }

    private shouldAcceptTextFromUser(user: UserEntity): boolean {
        return acceptTextBotStates.includes(user.botState)
    }

    private async startBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        const user = await this.userService.getByTelegramId(msg.from.id);

        this.cachedUserInput.set(msg.from.id, []);

        if (!user) {
            if (msg.from.username === undefined) {
                return this.bot.sendMessage(msg.chat.id, 'Du musst vorher in den Telegram-Einstellungen einen Benutzernamen anlegen.')
            }

            await this.userService.create(new CreateUserDto(msg.from.username, msg.from.id));
            return this.bot.sendMessage(msg.chat.id, getInitialGreeting(name));
        }

        if (user.botState === BotState.OFF) {
            await this.userService.updateBotstate(msg.from.id, BotState.ON);
            return this.bot.sendMessage(msg.chat.id, getGreeting(name));
        }

        return this.sendHelp(msg.chat.id);
    }

    private async stopBot(user: UserEntity, msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        if (user.botState === BotState.OFF) {
            return;
        }

        this.cachedUserInput.delete(msg.from.id);
        await this.userService.updateBotstate(msg.from.id, BotState.OFF);
        return this.bot.sendMessage(msg.chat.id, getFarewell(name));
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

        return this.bot.sendMessage(msg.chat.id, 'Erstelle neuen Cup. Bitte gib zuerst einen Namen für den Cup an.');
    }

    private async setCupName(msg: Message, userInput: string): Promise<Message> | never {
        const match = userInput.match(REGEX.TEXT);
        if (match === null || match[0] !== userInput) {
            throw new ChatError(ChatErrorMessage.ILLEGAL_CHARACTER, 'Buchstaben, Zahlen, Leerzeichen, "-" und "_"');
        }

        if (userInput.length > 32) {
            throw new ChatError(ChatErrorMessage.TOO_MANY_CHARACTERS, 32);
        }

        //TODO: maybe Check for duplicate names?

        this.cachedUserInput.set(msg.from.id, [userInput]);

        await this.userService.updateBotstate(msg.from.id, BotState.NEW_CUP_NAME_SET);

        return await this.bot.sendMessage(msg.chat.id, `Bitte sende mir den Endzeitpunkt für den Cup im Format ${DATE_FORMAT_DE}.`);
    }

    private async createCup(msg: Message, userInput: any, user: UserEntity): Promise<Message> {
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

    private async joinCup(msg: Message): Promise<Message> {
        const now = moment();

        const cups = await this.cupService.getBeforeDate(now.toDate());

        const responseText = cups.map((cup) => {
            const endDate = moment(cup.endTimestamp).format(DATE_FORMAT_DE);
            return `<b>${cup.name}</b> von <i>${cup.manager.username}</i> endet am ${endDate}.`;
        }).join('<br>');

        console.log(responseText);

        const keyBoardData = cups.map((cup) => cup.name);

        const options: SendMessageOptions = {
            reply_markup: ReplyKeyboardUtils.get(keyBoardData, 1),
            parse_mode: 'HTML',
        };

        return await this.bot.sendMessage(msg.chat.id, responseText, options);
    }
}