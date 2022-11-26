import {HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {MoreThan, Repository} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {CupEntity} from './cup.entity';
import {CreateCupDto} from "@webserver/cup/dto/createCup.dto";
import {UserEntity} from '@webserver/user/user.entity';
import {FindManyOptions} from "typeorm/find-options/FindManyOptions";
import {TUser} from "@webserver/user/types/user.type";

@Injectable()
export class CupService {
    public constructor(
        @InjectRepository(CupEntity)
        private readonly cupRepository: Repository<CupEntity>,
    ) {
    }

    public async getAll(): Promise<Array<CupEntity>> {
        return await this.cupRepository.find();
    }

    public async getAllWithRelations(): Promise<Array<CupEntity>> {
        const searchOptions: FindManyOptions = {
            order: {
                endTimestamp: 'ASC',
                startTimestamp: 'DESC',
            },
            relations: {
                attendees: true,
                manager: true
            }
        }
        return this.cupRepository.find(searchOptions);
    }

    public async getBeforeDate(date: Date): Promise<Array<CupEntity>> {
        const searchOptions: FindManyOptions = {
            where: {
                endTimestamp: MoreThan(date),
            },
            order: {
                endTimestamp: 'ASC',
                startTimestamp: 'DESC',
            },
            relations: {
                manager: true,
                attendees: true,
            }
        }
        return await this.cupRepository.find(searchOptions);
    }

    public async create(user: TUser, createCupDto: CreateCupDto): Promise<CupEntity> {
        //TODO: keine sonderzeichen im namen, nur maximal 32 zeichen lang bitte
        const cupByName = await this.cupRepository.findOneBy({
            name: createCupDto.name,
        });

        if (cupByName !== null) {
            throw new HttpException(
                'Cup name is already taken',
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }


        const newCup = new CupEntity();
        Object.assign(newCup, createCupDto);

        newCup.manager = user as UserEntity;

        if (createCupDto.startTimestamp === undefined) {
            newCup.startTimestamp = new Date;
        }


        return await this.cupRepository.save(newCup);
    }

    public async update(cup: CupEntity): Promise<CupEntity> {
        return this.cupRepository.save(cup);
    }

    public async getByName(name: string): Promise<CupEntity> {
        return await this.cupRepository.findOne({ where: { name }, relations: { attendees: true } });
    }

    public async deleteByName(name: string): Promise<void> {
        const deleteResult = await this.cupRepository.delete({ name });

        if (deleteResult.affected !== 1) {
            throw new Error('Only 1 row should have been deleted');
        }
    }
}
