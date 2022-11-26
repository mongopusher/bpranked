import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {UserEntity} from "@webserver/user/user.entity";
import {BotService} from "@webserver/bot/bot.service";
import {UserService} from "@webserver/user/user.service";
import {CupService} from "@webserver/cup/cup.service";
import {CupEntity} from "@webserver/cup/cup.entity";
import {GameService} from "@webserver/game/game.service";
import {GameEntity} from "@webserver/game/game.entity";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity, CupEntity, GameEntity])],
    providers: [BotService, UserService, CupService, GameService],
    exports: [BotService],
})
export class BotModule {}