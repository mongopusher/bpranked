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
                if (data[i * columns + j] !== undefined) {
                    column.push(data[i * columns + j]);
                }
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
        const eloDisplay = elo !== undefined ? `<b>${elo}</b>` : `<i>unranked</i>`

        const responseLines = [`${startDate} - ${endDate}`];
        responseLines.push(`${username}${cup.name}: ${eloDisplay}`);

        return responseLines.join('\n');
    }


    public static createTable(columnLengths: Array<number>, inputArray: Array<any>): string {
        let tableArray = inputArray.map((dataEntry: any) => {
            if (dataEntry.toString().length > columnLengths[0]) {
                throw new Error('string length bigger than column length');
            }
            const whiteSpacesCount = columnLengths[0] - dataEntry.toString().length;

            return `|${dataEntry}${' '.repeat(whiteSpacesCount)}|`;
        });

        return `<code>${tableArray.join('\n')}</code>`
    }
}