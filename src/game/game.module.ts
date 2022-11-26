import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {GameEntity} from "@webserver/game/game.entity";
import {GameService} from "@webserver/game/game.service";

@Module({
    imports: [TypeOrmModule.forFeature([GameEntity])],
    controllers: [],
    providers: [GameService],
    exports: [GameService],
})
export class GameModule {
}
