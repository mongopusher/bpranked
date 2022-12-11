import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {EloEntity} from "@webserver/elo/elo.entity";

@Injectable()
export class EloService {
    public constructor(@InjectRepository(EloEntity) private readonly eloRepository: Repository<EloEntity>) {

    }

    public async createDefaultElo(createGameDto: CreateGameDto): Promise<EloEntity> {
        console.log({ createGameDto });
        return '' as any;
    }

    public async getEloById(id: number): Promise<EloEntity> {
        return this.eloRepository.findOneBy({ id })
    }

    // public async getEloByUserAndCup(user: UserEntity, cup: CupEntity): Promise<EloEntity> {
    //     return this.eloRepository.findOneBy({ user: user.id, cup: cup.id })
    // }
    //
    // public async getElosByUser(user: UserEntity): Promise<Array<EloEntity>> {
    //     return this.eloRepository.findBy({ user })
    // }
    //
    // public async getElosByCup(cup: CupEntity): Promise<Array<EloEntity>> {
    //     return this.eloRepository.findBy({ cup });
    // }
}