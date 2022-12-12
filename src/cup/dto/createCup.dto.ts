import {IsNotEmpty, IsOptional} from 'class-validator';
import {CupType} from "@webserver/cup/cup-type.enum";

export class CreateCupDto {
    public constructor(name: string, type: CupType, endTimestamp: Date, startTimestamp?: Date | undefined) {
        this.name = name;
        this.type = type;
        this.endTimestamp = endTimestamp;
        this.startTimestamp = startTimestamp;
    }

    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    readonly type: CupType;

    @IsNotEmpty()
    readonly endTimestamp: Date;

    @IsOptional()
    readonly startTimestamp: Date | undefined;
}