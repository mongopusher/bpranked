import {IsNotEmpty, IsNotEmptyObject, IsOptional} from "class-validator";
import {CupEntity} from "@webserver/cup/cup.entity";
import {UserEntity} from "@webserver/user/user.entity";

export class CreateGameDto {
    public constructor(cup: CupEntity, winners: Array<UserEntity>, losers: Array<UserEntity>) {
        this.cup = cup;
        this.winners = winners;
        this.losers = losers;
    }

    @IsNotEmpty()
    readonly cup: CupEntity;

    @IsNotEmptyObject()
    readonly winners: Array<UserEntity>;

    @IsNotEmptyObject()
    readonly losers: Array<UserEntity>;
}