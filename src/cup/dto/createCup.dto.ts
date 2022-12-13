import {IsNotEmpty, IsOptional} from 'class-validator';
import {CupMode} from "@webserver/cup/cup-mode.enum";

export class CreateCupDto {
    public constructor(name: string, type: CupMode, endTimestamp: Date, startTimestamp?: Date | undefined) {
        this.name = name;
        this.type = type;
        this.endTimestamp = endTimestamp;
        this.startTimestamp = startTimestamp;
    }

    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    readonly type: CupMode;

    @IsNotEmpty()
    readonly endTimestamp: Date;

    @IsOptional()
    readonly startTimestamp: Date | undefined;
}