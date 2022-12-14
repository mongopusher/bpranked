import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {In, Repository} from "typeorm";
import {GameEntity} from "@webserver/game/game.entity";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";

@Injectable()
export class GameService {
    public constructor(@InjectRepository(GameEntity) private readonly gameRepository: Repository<GameEntity>) {

    }

    public async createGame(createGameDto: CreateGameDto): Promise<GameEntity> {
        const game = new GameEntity();
        Object.assign(game, createGameDto);

        return this.gameRepository.save(game);
    }

    public async getGameById(id: number): Promise<GameEntity> {
        return this.gameRepository.findOneBy({ id })
    }

    public async getGamesByIds(ids: Array<number>): Promise<Array<GameEntity>> {
        return this.gameRepository.find({
                where: {
                    id: In(ids)
                },
                take: 5,
                order: {
                    created_at: "DESC",
                },
                relations: {
                    winners: true,
                    losers: true,
                    cup: true,
                }
            }
        )
    }

    public async getAllGames(): Promise<Array<GameEntity>> {
        return this.gameRepository.find();
    }
}