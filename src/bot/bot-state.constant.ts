export enum BotState {
    OFF = 0,
    ON = 1,

    // newcup
    START_NEW_CUP = 20,
    NEW_CUP_NAME_SET = 21,

    // joincup
    JOIN_CUP = 30,

    // delcup
    DEL_CUP = 40,
    DEL_CUP_CONFIRM = 41,

    // newgame
    START_NEW_GAME = 50,
    NEW_GAME_CUP_SET = 51,
    NEW_GAME_WINNERS_SET = 52,
    NEW_GAME_LOSERS_SET = 53,

}

export const acceptTextBotStates = [
    BotState.START_NEW_CUP,
    BotState.NEW_CUP_NAME_SET,
    BotState.JOIN_CUP,
    BotState.DEL_CUP,
    BotState.DEL_CUP_CONFIRM,
    BotState.START_NEW_GAME,
]