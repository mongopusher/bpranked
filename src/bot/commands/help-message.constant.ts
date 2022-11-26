import {Command} from "@webserver/bot/commands/commands.constant";

export const helpMessage = {
    [Command.HELP]: 'zeigt alle erlaubten Befehle\n',
    [Command.START]:     'startet den Bot\n',
    [Command.STOP]:     'stoppt den Bot\n',
    [Command.GET_JOINED_CUPS]:     'zeigt dir Cups an, an denen du teilnimmst und die du erstellt hast\n',
    [Command.NEW_CUP]:     'erstelle einen neuen Cup',
    [Command.JOIN_CUP]:     'nimm an einem Cup teil\n',
    [Command.CANCEL]:     'bringt den aktuellen Vorgang ab\n',
    [Command.DELETE_CUP]:     'lösche einen deiner Cups\n',
    [Command.GET_ALL_CUPS]:     'zeigt dir alle Cups an\n'
}