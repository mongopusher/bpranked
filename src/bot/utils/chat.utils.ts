import {KeyboardButton, ReplyKeyboardMarkup} from "node-telegram-bot-api";
import {CupEntity} from "@webserver/cup/cup.entity";
import moment from "moment";


export const DATE_FORMAT_DE = 'DD.MM.YYYY';
export const DATE_FORMAT_EXTENDED_DE = 'DD.MM.YYYY HH:mm:ss';

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

    public static getFormattedCup(cup: CupEntity, elo?: number): string {
        const startDate = moment(cup.startTimestamp).format(DATE_FORMAT_DE);
        const endDate = moment(cup.endTimestamp).format(DATE_FORMAT_DE);
        const username = cup.manager?.username !== undefined ? `<b>${cup.manager.username}</b>s ` : '';

        const responseLines = [`${startDate} - ${endDate}`];
        responseLines.push(`${username}${cup.name} ${elo ?? ': ' + elo}`);

        return responseLines.join('\n');
    }
}