import {HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {Repository} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {CupEntity} from './cup.entity';
import {CreateCupDto} from "@webserver/cup/dto/createCup.dto";

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

    public async create(createCupDto: CreateCupDto): Promise<CupEntity> {
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

        if (createCupDto.startTimestamp === undefined) {
            newCup.startTimestamp = new Date;
        }


        return await this.cupRepository.save(newCup);
    }
}
