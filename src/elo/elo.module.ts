import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {EloEntity} from "@webserver/elo/elo.entity";
import {EloService} from "@webserver/elo/elo.service";

@Module({
    imports: [TypeOrmModule.forFeature([EloEntity])],
    controllers: [],
    providers: [EloService],
    exports: [EloService],
})
export class EloModule {
}
