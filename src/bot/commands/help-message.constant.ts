import {Command} from "@webserver/bot/commands/commands.constant";

export const helpMessage = {
    [Command.HELP]: 'zeigt alle erlaubten Befehle',
    [Command.START]: 'startet den Bot',
    [Command.STOP]: 'stoppt den Bot',
    [Command.GET_JOINED_CUPS]: 'zeigt dir Cups an, an denen du teilnimmst und die du erstellt hast',
    [Command.NEW_CUP]: 'erstelle einen neuen Cup',
    [Command.JOIN_CUP]: 'nimm an einem Cup teil',
    [Command.CANCEL]: 'bricht den aktuellen Vorgang ab',
    [Command.DELETE_CUP]: 'lösche einen deiner Cups',
    [Command.GET_ALL_CUPS]: 'zeigt dir alle Cups an',
    [Command.NEW_GAME]: 'trage ein neues Spiel ein',
    [Command.GET_MY_GAMES]: 'zeigt dir deine letzten 5 Spiele an',
}