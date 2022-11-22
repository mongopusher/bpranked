import {KeyboardButton, ReplyKeyboardMarkup} from "node-telegram-bot-api";

export class ChatUtils {
    public static getKeyboardMarkup(data: Array<any>, columns: number, shouldOnlySendOnce = true): ReplyKeyboardMarkup {
        const keyboard: Array<Array<KeyboardButton>> = [];

        for (let i = 0; i < data.length; i++) {
            const column = [];
            for (let j = 0; j < columns; j++) {
                column.push(data[i * columns + j]);
            }
            keyboard.push(column);
        }

        return {
            keyboard: keyboard,
            one_time_keyboard: shouldOnlySendOnce,
        };
    }
}