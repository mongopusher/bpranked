import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {GameEntity} from "@webserver/game/game.entity";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";

@Injectable()
export class GameService {
    public constructor(@InjectRepository(GameEntity) private readonly gameRepository: Repository<GameEntity>) {

    }

    public async createGame(createGameDto: CreateGameDto): Promise<GameEntity> {
        console.log({ createGameDto });
        return '' as any;
    }

    public async getGameById(id: number): Promise<GameEntity> {
        return this.gameRepository.findOneBy({id})
    }

    public async getAllGames(): Promise<Array<GameEntity>> {
        return this.gameRepository.find();
    }
}