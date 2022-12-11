import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {UserEntity} from "@webserver/user/user.entity";
import {BotService} from "@webserver/bot/bot.service";
import {UserService} from "@webserver/user/user.service";
import {CupService} from "@webserver/cup/cup.service";
import {CupEntity} from "@webserver/cup/cup.entity";
import {GameService} from "@webserver/game/game.service";
import {GameEntity} from "@webserver/game/game.entity";
import {EloEntity} from "@webserver/elo/elo.entity";
import {EloService} from "@webserver/elo/elo.service";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, CupEntity, GameEntity, EloEntity])],
    providers: [BotService, UserService, CupService, GameService, EloService],
    exports: [BotService],
})
export class BotModule {}