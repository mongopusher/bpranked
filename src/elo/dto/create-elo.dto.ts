import {IsNotEmpty} from "class-validator";
import {CupEntity} from "@webserver/cup/cup.entity";
import {UserEntity} from "@webserver/user/user.entity";

export class CreateEloDto {
    public constructor(user: UserEntity, cup: CupEntity) {
        this.user = user;
        this.cup = cup;
    }

    @IsNotEmpty()
    readonly user: UserEntity;

    @IsNotEmpty()
    readonly cup: CupEntity;
}