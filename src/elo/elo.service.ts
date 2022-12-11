import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {EloEntity} from "@webserver/elo/elo.entity";
import {CreateEloDto} from "./dto/create-elo.dto";
import {CupEntity} from "@webserver/cup/cup.entity";
import {UserEntity} from "@webserver/user/user.entity";

@Injectable()
export class EloService {
    public constructor(@InjectRepository(EloEntity) private readonly eloRepository: Repository<EloEntity>) {

    }

    public async updateElos(cup: CupEntity, winners: Array<UserEntity>, losers: Array<UserEntity>): Promise<EloEntity> {
        // make magic elo berechnung!

        console.log({
            cup: cup.name,
            winners: winners.map((user) => user.username).join(', '),
            losers: losers.map((user) => user.username).join(', '),
        });

        // const elo = new EloEntity();

        // return this.eloRepository.save(elo);
        return '' as any;
    }

    public async createDefaultElo(createEloDto: CreateEloDto): Promise<EloEntity> {
        console.log({ createEloDto: createEloDto });

        const elo = new EloEntity();
        Object.assign(elo, createEloDto)

        return this.eloRepository.save(elo);
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