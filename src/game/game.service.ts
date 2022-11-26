import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {GameEntity} from "@webserver/game/game.entity";
import {UserEntity} from "@webserver/user/user.entity";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";

@Injectable()
export class GameService {
    public constructor(@InjectRepository(GameEntity) private readonly gameRepository: Repository<GameEntity>) {

    }

    public async createGame(createGameDto: CreateGameDto, user: UserEntity): Promise<GameEntity> {
        console.log({ createGameDto, user });
        return '' as any;
    }

    public async getGameById(id: number): Promise<GameEntity> {
        return this.gameRepository.findOneBy({id})
    }

    public async getAllGames(): Promise<Array<GameEntity>> {
        return this.gameRepository.find();
    }
}