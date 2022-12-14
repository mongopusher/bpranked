import {KeyboardButton, ReplyKeyboardMarkup} from "node-telegram-bot-api";
import {CupEntity} from "@webserver/cup/cup.entity";
import moment from "moment";
import {GameEntity} from "@webserver/game/game.entity";
import {UserEntity} from "@webserver/user/user.entity";
import {EMOJI} from "@webserver/bot/utils/emoji.constant";
import {CUP} from "@webserver/cup/cup.constant";
import {TUser} from "@webserver/user/types/user.type";


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


    public static getFormattedCup(cup: CupEntity): string {
        const startDate = moment(cup.startTimestamp).format(DATE_FORMAT_DE);
        const endDate = moment(cup.endTimestamp).format(DATE_FORMAT_DE);
        const username = cup.manager?.username !== undefined ? `<b>${cup.manager.username}</b>s ` : '';
        const cupType = `<i>${CUP[cup.mode]}</i>`;

        const responseLines = [`${startDate} - ${endDate}`];
        responseLines.push(`${username}${cup.name}: ${cupType}`);

        return responseLines.join('\n');
    }

    public static getEloForCup(cup: CupEntity, elo?: number): string {
        const username = cup.manager?.username !== undefined ? `<b>${cup.manager.username}</b>s ` : '';
        const eloDisplay = elo !== undefined ? `<b>${elo}</b>` : `<i>unranked</i>`

        return `${username}${cup.name}: ${eloDisplay}`;
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

    public static getFormattedGameWithUser(game: GameEntity, user: UserEntity): string {
        const winnerIds = game.winners.map((winner) => winner.id);

        const cupManagerName = game.cup.manager?.username !== undefined ? `<b>${game.cup.manager.username}</b>s ` : '';
        const cupInfo = `${cupManagerName}${game.cup.name}`;
        const date = moment(game.created_at).format(DATE_FORMAT_EXTENDED_DE);

        const gameHeader = `${cupInfo} - ${date}`;
        let gameBody;

        if (winnerIds.includes(user.id) === true) {
            gameBody = `${EMOJI.GLOWING_STAR} Gewonnen ${ChatUtils.getGameMessage(game.winners, game.losers, user)}`;
        } else {
            gameBody = `${EMOJI.SKULL} Verloren ${ChatUtils.getGameMessage(game.losers, game.winners, user)}`;
        }
        return [gameHeader, gameBody, ''].join('\n');
    }

    public static getGameSummary(game: GameEntity): string {
        const summary = [`Spiel in ${game.cup.name} eingetragen:`];
        summary.push(`${EMOJI.GLOWING_STAR} Sieger: ${game.winners.map(ChatUtils.getUserLink)}`);
        summary.push(`${EMOJI.PILE_OF_POO} Verlierer: ${game.losers.map(ChatUtils.getUserLink)}`);
        return summary.join('\n');
    }

    public static isTruthy(text: string): boolean {
        const firstSymbol = text.substring(0,4).toUpperCase();
        return ['Y', 'J', 'YES', 'JA', 'JA!', 'JA.'].includes(firstSymbol);
    }

    public static isFalsy(text: string): boolean {
        const firstSymbol = text.substring(0,4).toUpperCase();
        return ['N', 'NEIN', 'NO'].includes(firstSymbol);
    }

    public static getGameMessage(myTeam: Array<UserEntity>, theirTeam: Array<UserEntity>, self: TUser): string {
        const mates = myTeam.filter((winner) => winner.id != self.id).map((user) => user.username);
        const withMates = mates.length !== 0 ? `mit ${mates.join(', ')} ` : '';
        const againstEnemies = `gegen ${theirTeam.map(ChatUtils.getUserLink).join(', ')}`;
        return `${withMates}${againstEnemies}`;
    }

    public static getUserLink(user: TUser): string {
        return `<a href="${user.telegramId}">${user.username}</a>`;
    }
}
