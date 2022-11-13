import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {Message} from "node-telegram-bot-api";
import {Commands} from "@webserver/bot/commands.constant";
import {acceptTextBotStates, BotState} from "@webserver/bot/botState.constant";
import {getFarewell, getGreeting, getInitialGreeting} from "@webserver/bot/message.utils";
import {UserService} from "@webserver/user/user.service";
import {CreateUserDto} from "@webserver/user/dto/createUser.dto";
import {UserEntity} from "@webserver/user/user.entity";
import {CupService} from "@webserver/cup/cup.service";
import {CreateCupDto} from "@webserver/cup/dto/createCup.dto";

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
                console.log(error);
                await this.bot.sendMessage(msg.chat.id, `An unknown error occurred: ${error}`);
            }
        });
    }

    private async handleMessage(msg: Message): Promise<Message> {
        const userInput = msg.text.toString();

        console.log('handle message: ', msg.text);
        console.log('handle message as string: ', userInput);

        if (userInput.at(0) === '/') {
            return await this.handleCommand(msg, userInput.slice(1, 0))
        }

        return await this.handleText(msg, userInput);
    }

    private async handleCommand(msg: Message, command: Commands | string | undefined): Promise<Message> {
        if (command === Commands.START) {
            return this.startBot(msg);
        }

        const user = await this.userService.getByTelegramId(msg.from.id)

        if (!user) {
            return;
        }

        switch (command) {
            case Commands.STOP:
                return this.stopBot(user, msg);
            case Commands.METADATA:
                return this.bot.sendMessage(msg.chat.id, JSON.stringify(msg));
            case Commands.NEW_CUP:
                return this.startNewCup(msg);
            case Commands.HELP:
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
            '/stop - stopppt den bot'
        );
    }

    private async startNewCup(msg: Message): Promise<Message> {
        await this.userService.updateBotstate(msg.from.id, BotState.START_NEW_CUP);

        return this.bot.sendMessage(msg.chat.id, 'Erstelle neuen Cup. Bitte gib zuerst einen Namen für den Cup an.');
    }

    private async setCupName(msg: Message, userInput: any): Promise<Message> {
        this.cachedUserInput.set(msg.from.id, [userInput]);

        await this.userService.updateBotstate(msg.from.id, BotState.NEW_CUP_NAME_SET);

        return await this.bot.sendMessage(msg.chat.id, 'Bitte sende mir den Endzeitpunkt für den Cup im Format YYYY-MM-DD.');
    }

    private async createCup(msg: Message, userInput: any, user: UserEntity): Promise<Message> {
        const date = new Date(userInput);
        console.log(date);
        const cachedUserInput = this.cachedUserInput.get(msg.from.id);

        const cup = await this.cupService.create(user, new CreateCupDto(cachedUserInput[0], date));
        await this.userService.updateBotstate(msg.from.id, BotState.ON);
        return await this.bot.sendMessage(msg.chat.id, `Cup erstellt:  ${cup.name} endet am ${cup.endTimestamp}`);
    }
}