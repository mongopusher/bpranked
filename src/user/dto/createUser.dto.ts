import {IsNotEmpty, IsOptional} from 'class-validator';

export class CreateUserDto {
    public constructor(username: string, telegramId: number, chatId: number, password?: string | undefined) {
        this.username = username;
        this.telegramId = telegramId;
        this.chatId = chatId;
        this.password = password;
    }

    @IsNotEmpty()
    readonly username: string;

    @IsNotEmpty()
    readonly telegramId: number;

    @IsNotEmpty()
    readonly chatId: number;

    @IsOptional()
    readonly password: string | undefined;
}