import {IsNotEmpty, IsOptional} from 'class-validator';

export class CreateCupDto {
    public constructor(managerId: number, name: string, endTimestamp: Date, startTimestamp?: Date | undefined) {
        this.managerId = managerId;
        this.name = name;
        this.endTimestamp = endTimestamp;
        this.startTimestamp = startTimestamp;
    }

    @IsNotEmpty()
    readonly managerId: number;

    @IsNotEmpty()
    readonly name: string;

    @IsNotEmpty()
    readonly endTimestamp: Date;

    @IsOptional()
    readonly startTimestamp: Date | undefined;
}