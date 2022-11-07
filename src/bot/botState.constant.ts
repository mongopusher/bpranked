export enum BotState {
    OFF = 0,
    ON = 1,

    START_NEW_CUP = 20, // request name
    NEW_CUP_NAME_SET = 20, // request duration

}

export const acceptTextBotStates = [
    BotState.START_NEW_CUP,
    BotState.NEW_CUP_NAME_SET,
]