import {Injectable} from '@nestjs/common';
import TelegramBot, {Message} from 'node-telegram-bot-api';
import {Commands} from './commands.constant';

@Injectable()
export class AppService {
    public constructor() {
        const token = process.env.BOT_TOKEN;

        // Create a bot that uses 'polling' to fetch new updates
        const bot = new TelegramBot(token, {polling: true});


        // es gibt vieles mehr als nur 'on' oder 'onText'
        bot.onText(/\/(.+)/, (msg, match) => {
            console.log(msg);
            const command = match[1];

            switch (command) {
                case Commands.START:
                    return bot.sendMessage(msg.chat.id, `Hallo ${msg.chat.first_name}`);
                case Commands.STOP:
                    return bot.sendMessage(msg.chat.id, `Tschüss ${msg.chat.first_name}`);
                case Commands.METADATA:
                    return bot.sendMessage(msg.chat.id, JSON.stringify(msg));
                case Commands.HELP:
                default:
                    return this.sendHelp(bot, msg.chat.id);
            }
        });
    }

    private sendHelp(bot: TelegramBot, chatId: number): Promise<Message> {
        return bot.sendMessage(chatId,
            '/help - show possible commands\n' +
            '/start - start the bot\n' +
            '/stop - stop the bot\n'
        );
    }

    getHello(): string {
        return 'Hello App!';
    }
}
