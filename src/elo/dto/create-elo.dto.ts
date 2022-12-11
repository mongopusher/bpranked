import {IsNotEmpty} from "class-validator";
import {CupEntity} from "@webserver/cup/cup.entity";
import {UserEntity} from "@webserver/user/user.entity";
import {ELO} from "@webserver/elo/elo.constant";

export class CreateEloDto {
    public constructor(user: UserEntity, cup: CupEntity) {
        this.user = user;
        this.cup = cup;
        this.elo = ELO.DEFAULT;
    }

    @IsNotEmpty()
    readonly user: UserEntity;

    @IsNotEmpty()
    readonly cup: CupEntity;

    @IsNotEmpty()
    readonly elo: number;
}