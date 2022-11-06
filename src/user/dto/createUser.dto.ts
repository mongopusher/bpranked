import {IsNotEmpty, IsOptional} from 'class-validator';

export class CreateUserDto {
    public constructor(username: string, telegramId: number, password?: string | undefined) {
        this.username = username;
        this.telegramId = telegramId;
        this.password = password;
    }

    @IsNotEmpty()
    readonly username: string;

    @IsNotEmpty()
    readonly telegramId: number;

    @IsOptional()
    readonly password: string | undefined;
}