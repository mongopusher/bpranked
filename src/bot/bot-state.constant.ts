export enum BotState {
    OFF = 0,
    ON = 1,

    // newcup
    START_NEW_CUP = 20,
    NEW_CUP_NAME_SET = 21,

    // joincup
    JOIN_CUP = 30,
}

export const acceptTextBotStates = [
    BotState.START_NEW_CUP,
    BotState.NEW_CUP_NAME_SET,
    BotState.JOIN_CUP,
]