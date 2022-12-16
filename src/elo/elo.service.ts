import {Injectable} from "@nestjs/common";
import {InjectRepository} from "@nestjs/typeorm";
import {FindOptionsRelations, Repository} from "typeorm";
import {CreateGameDto} from "@webserver/game/dto/create-game.dto";
import {EloEntity} from "@webserver/elo/elo.entity";
import {CreateEloDto} from "./dto/create-elo.dto";
import {CupEntity} from "@webserver/cup/cup.entity";
import {UserEntity} from "@webserver/user/user.entity";
import {ELO} from "./elo.constant";

@Injectable()
export class EloService {

    public constructor(@InjectRepository(EloEntity) private readonly eloRepository: Repository<EloEntity>) {

    }

    public async updateElos(cup: CupEntity, winners: Array<UserEntity>, losers: Array<UserEntity>): Promise<void> {
        const eloEntities: Array<EloEntity & { newElo?: number }> = [];

        let totalWinnerElo = 0;
        let totalLoserElo = 0;

        for (const winner of winners) {
            const eloEntity = await this.getEloByUserAndCup(winner, cup);
            eloEntities.push(eloEntity);
            totalWinnerElo += eloEntity.elo;
        }

        for (const loser of losers) {
            const eloEntity = await this.getEloByUserAndCup(loser, cup);
            eloEntities.push(eloEntity);
            totalLoserElo += eloEntity.elo;
        }

        const averageWinnerElo = totalWinnerElo / winners.length;
        const averageLoserElo = totalLoserElo / losers.length;

        let totalEloDiff = 0;

        for (const eloEntity of eloEntities) {
            let eloDiff = 0;
            if (winners.findIndex((winner) => winner.id === eloEntity.user.id) !== -1) {
                eloDiff = this.getNewElo(eloEntity.elo, averageLoserElo, true);
            } else {
                eloDiff = this.getNewElo(eloEntity.elo, averageWinnerElo, false);
            }
            eloEntity.newElo = eloEntity.elo + eloDiff;
            totalEloDiff += eloDiff;
        }

        if (totalEloDiff !== 0) {
            throw new Error('DIE HUAN RECHNUNG PASST NED');
        }

        for (const eloEntity of eloEntities) {
            eloEntity.elo = eloEntity.newElo;
            delete eloEntity.newElo;
            delete eloEntity.updated_at;

            await this.eloRepository.update({ id: eloEntity.id }, eloEntity);
        }
    }

    private getNewElo(ownElo: number, enemyElo: number, isWinner: boolean): number {
        const scaling = (ownElo - enemyElo) * ELO.SCALE_FACTOR;
        return isWinner === true ? scaling + ELO.BASE_GAIN : scaling - ELO.BASE_GAIN;
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

    public async getByUserIdWithCups(userId: number): Promise<Array<EloEntity>> {
        return this.eloRepository.createQueryBuilder('elo')
            .leftJoinAndSelect('elo.cup', 'cup')
            .where('elo.userId = :userId', { userId })
            .getMany();
    }

    public async getEloByUserAndCup(user: UserEntity, cup: CupEntity): Promise<EloEntity> {
        return this.eloRepository.createQueryBuilder('elo')
            .leftJoinAndSelect('elo.user', 'user')
            .where('elo.userId = :userId', { userId: user.id })
            .andWhere('elo.cupId = :cupId', { cupId: cup.id })
            .getOne();
    }

    //
    // public async getElosByUser(user: UserEntity): Promise<Array<EloEntity>> {
    //     return this.eloRepository.findBy({ user })
    // }
    //
    // public async getElosByCup(cup: CupEntity): Promise<Array<EloEntity>> {
    //     return this.eloRepository.findBy({ cup });
    // }
}