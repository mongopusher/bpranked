import {Inject, Injectable} from "@nestjs/common";
import TelegramBot, {Message} from "node-telegram-bot-api";
import {Commands} from "@webserver/bot/commands.constant";
import {BotState} from "@webserver/bot/botState.constant";
import {getFarewell, getGreeting, getInitialGreeting} from "@webserver/bot/message.utils";
import {UserService} from "@webserver/user/user.service";
import {CreateUserDto} from "@webserver/user/dto/createUser.dto";
import {UserEntity} from "@webserver/user/user.entity";

@Injectable()
export class BotService {
    private state: Map<number, BotState>;
    private bot: TelegramBot;

    public constructor(@Inject(UserService) private readonly userService: UserService) {
        this.state = new Map<number, BotState>();
    }

    public async initialize(): Promise<void> {
        const token = process.env.BOT_TOKEN;

        this.bot = new TelegramBot(token, {polling: true});

        // es gibt vieles mehr als nur 'on' oder 'onText'
        this.bot.onText(/\/(.+)/, async (msg, match) => {
            console.log(msg);
            const command = match[1];

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
                case Commands.HELP:
                default:
                    return this.sendHelp(msg.chat.id);
            }
        });
    }


    private async startBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        const user = await this.userService.getByTelegramId(msg.from.id);

        console.log(user);

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
}