import {IsNotEmpty, IsOptional} from 'class-validator';

export class CreateCupDto {
    public constructor(name: string, endTimestamp: Date, startTimestamp?: Date | undefined) {
        this.name = name;
        this.endTimestamp = endTimestamp;
        this.startTimestamp = startTimestamp;
    }

    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    readonly endTimestamp: Date;

    @IsOptional()
    readonly startTimestamp: Date | undefined;
}