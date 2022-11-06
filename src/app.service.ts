import {Inject, Injectable} from '@nestjs/common';
import {BotService} from "@webserver/bot/bot.service";

@Injectable()
export class AppService {
    public constructor(@Inject(BotService) private botService: BotService) {
        void this.botService.initialize();
    }

    getHello(): string {
        return 'Hello App!';
    }
}
