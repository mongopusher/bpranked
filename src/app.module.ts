import {MiddlewareConsumer, Module, RequestMethod} from '@nestjs/common';
import {AppController} from '@webserver/app.controller';
import {AppService} from '@webserver/app.service';
import {UserModule} from '@webserver/user/user.module';
import {TypeOrmModule} from '@nestjs/typeorm';
import ormconfig from '@webserver/ormconfig';
import {AuthMiddleware} from '@webserver/user/middlewares/auth.middleware';
import {BotModule} from "@webserver/bot/bot.module";
import {CupModule} from "@webserver/cup/cup.module";

@Module({
    imports: [
        TypeOrmModule.forRoot(ormconfig),
        UserModule,
        BotModule,
        CupModule
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {
    public configure(consumer: MiddlewareConsumer) {
        consumer.apply(AuthMiddleware).forRoutes({
            path: '*',
            method: RequestMethod.ALL,
        });
    }
}
