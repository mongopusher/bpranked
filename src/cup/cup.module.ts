import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {CupEntity} from "@webserver/cup/cup.entity";
import {CupService} from "@webserver/cup/cup.service";

@Module({
    imports: [TypeOrmModule.forFeature([CupEntity])],
    controllers: [],
    providers: [CupService],
    exports: [CupService],
})
export class CupModule {
}
