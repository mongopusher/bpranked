import {IsOptional} from 'class-validator';
import {BotState} from "@webserver/bot/bot-state.constant";

export class UpdateUserDto {
    public constructor(
        username?: string | undefined,
        telegramId?: number | undefined,
        password?: string | undefined,
        botState?: BotState | undefined
    ) {
        this.username = username;
        this.telegramId = telegramId;
        this.password = password;
        this.botState = botState;
    }

    @IsOptional()
    readonly username?: string | undefined;

    @IsOptional()
    readonly password?: string | undefined;

    @IsOptional()
    readonly telegramId?: number | undefined;

    @IsOptional()
    readonly botState?: BotState | undefined;
}
