import {KeyboardButton, ReplyKeyboardMarkup} from "node-telegram-bot-api";
import {CupEntity} from "@webserver/cup/cup.entity";
import moment from "moment";
import {GameEntity} from "@webserver/game/game.entity";
import {UserEntity} from "@webserver/user/user.entity";


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

    public static getFormattedGameWithUser(game: GameEntity, user: UserEntity): string {
        const winnerIds = game.winners.map((winner) => winner.id);

        console.log(game);

        const cupManagerName = game.cup.manager?.username !== undefined ? `<b>${game.cup.manager.username}</b>s ` : '';
        const cupInfo = `${cupManagerName}${game.cup.name}`;
        const date = moment(game.created_at).format(DATE_FORMAT_EXTENDED_DE);

        const gameHeader = `${cupInfo} - ${date}`;
        let gameBody;

        if (winnerIds.includes(user.id) === true) {
            gameBody = `Gewonnen ${ChatUtils.getGameMessage(game.winners, game.losers, user)}`;
        } else {
            gameBody = `Verloren ${ChatUtils.getGameMessage(game.losers, game.winners, user)}`;
        }
        return [gameHeader, gameBody, ''].join('\n');
    }

    private static getGameMessage(myTeam: Array<UserEntity>, theirTeam: Array<UserEntity>, self: UserEntity): string {
        const mates = myTeam.filter((winner) => winner.id != self.id).map((user) => user.username);
        const withMates = mates.length !== 0 ? `mit ${mates.join(', ')} ` : '';
        const againstEnemies = `gegen ${theirTeam.map((user) => user.username).join(', ')}`;
        return `${withMates}${againstEnemies}`;
    }

}
