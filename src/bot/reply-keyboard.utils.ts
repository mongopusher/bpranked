import {KeyboardButton, ReplyKeyboardMarkup} from "node-telegram-bot-api";

export class ReplyKeyboardUtils {
    public static get(data: Array<any>, columns: number, shouldOnlySendOnce = true): ReplyKeyboardMarkup {
        const keyboard: Array<Array<KeyboardButton>> = [];

        for (const entry in data) {
            const column = [];
            for (let i = 0; i < columns; i++) {
                column.push(data.shift());
            }
            keyboard.push(column);
        }

        return {
            keyboard: keyboard,
            one_time_keyboard: shouldOnlySendOnce,
        };
    }
}