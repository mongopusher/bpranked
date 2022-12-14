import {IsNotEmpty, IsOptional} from 'class-validator';
import {CupMode} from "@webserver/cup/cup-mode.enum";

export class CreateCupDto {
    public constructor(name: string, mode: CupMode, endTimestamp: Date, startTimestamp?: Date | undefined) {
        this.name = name;
        this.mode = mode;
        this.endTimestamp = endTimestamp;
        this.startTimestamp = startTimestamp;
    }

    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    readonly mode: CupMode;

    @IsNotEmpty()
    readonly endTimestamp: Date;

    @IsOptional()
    readonly startTimestamp: Date | undefined;
}