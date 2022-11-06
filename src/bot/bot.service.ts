import {Injectable} from "@nestjs/common";
import TelegramBot, {Message} from "node-telegram-bot-api";
import {Commands} from "@webserver/bot/commands.constant";
import {BotState} from "@webserver/bot/botState.constant";
import {getFarewell, getGreeting} from "@webserver/bot/message.utils";

@Injectable()
export class BotService {
    private state: Map<number, BotState>;
    private bot: TelegramBot;

    public constructor() {
        this.state = new Map<number, BotState>();
    }

    public async initialize(): Promise<void> {
        const token = process.env.BOT_TOKEN;

        this.bot = new TelegramBot(token, {polling: true});

        // es gibt vieles mehr als nur 'on' oder 'onText'
        this.bot.onText(/\/(.+)/, (msg, match) => {
            console.log(msg);
            const command = match[1];

            if (command === Commands.START) {
                return this.startBot(msg);
            }

            if (this.state.has(msg.chat.id) !== true) {
                return;
            }

            switch (command) {
                case Commands.STOP:
                    return this.stopBot(msg);
                case Commands.METADATA:
                    return this.bot.sendMessage(msg.chat.id, JSON.stringify(msg));
                case Commands.HELP:
                default:
                    return this.sendHelp(msg.chat.id);
            }
        });
    }


    private startBot(msg: Message): Promise<Message> {
        // TODO: check for database entry as well later
        const name = msg.from.first_name || msg.from.username;

        if (this.state.has(msg.chat.id) !== true) {
            this.state.set(msg.chat.id, BotState.ON);
            return this.bot.sendMessage(msg.chat.id, `Hallo ${name}, verneige dich vor deinem neuen Gott!`);
        }

        if (this.state.get(msg.chat.id) === BotState.OFF) {
            this.state.set(msg.chat.id, BotState.ON);
            return this.bot.sendMessage(msg.chat.id, getGreeting(name));
        }

        return this.bot.sendMessage(msg.chat.id,
            '/help - show possible commands\n' +
            '/start - start the bot\n' +
            '/stop - stop the bot\n'
        );
    }

    private stopBot(msg: Message): Promise<Message> {
        const name = msg.from.first_name || msg.from.username;

        if (this.state.get(msg.chat.id) === BotState.OFF) {
            return;
        }

        this.state.set(msg.chat.id, BotState.OFF);
        return this.bot.sendMessage(msg.chat.id, getFarewell(name));
    }

    private sendHelp(chatId: number): Promise<Message> {
        return this.bot.sendMessage(chatId,
            '/help - show possible commands\n' +
            '/start - start the bot\n' +
            '/stop - stop the bot'
        );
    }
}