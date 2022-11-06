import {Module} from "@nestjs/common";
import {TypeOrmModule} from "@nestjs/typeorm";
import {UserEntity} from "@webserver/user/user.entity";
import {BotService} from "@webserver/bot/bot.service";

@Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    providers: [BotService],
    exports: [BotService],
})
export class BotModule {}