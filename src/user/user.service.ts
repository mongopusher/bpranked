import {HttpException, HttpStatus, Injectable} from '@nestjs/common';
import {UserEntity} from '@webserver/user/user.entity';
import {FindOneOptions, Not, Repository} from 'typeorm';
import {InjectRepository} from '@nestjs/typeorm';
import {CreateUserDto} from '@webserver/user/dto/createUser.dto';
import {sign} from 'jsonwebtoken';
import {IUserResponse} from '@webserver/user/types/user-response.interface';
import {LoginUserDto} from '@webserver/user/dto/loginUser.dto';
import {compare} from 'bcrypt';
import {UpdateUserDto} from '@webserver/user/dto/updateUser.dto';
import * as fs from 'fs';
import {BotState} from "@webserver/bot/botState.constant";

@Injectable()
export class UserService {
    public constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,
    ) {
    }

    public async getAll(): Promise<Array<UserEntity>> {
        return await this.userRepository.find();
    }

    public async create(createUserDto: CreateUserDto): Promise<UserEntity> {
        //TODO: keine sonderzeichen im namen, nur maximal 32 zeichen lang bitte
        const userByTelegramId = await this.userRepository.findOneBy({
            telegramId: createUserDto.telegramId,
        });

        if (userByTelegramId !== null) {
            throw new HttpException(
                'Telegram id is already taken',
                HttpStatus.UNPROCESSABLE_ENTITY,
            );
        }

        const newUser = new UserEntity();
        Object.assign(newUser, createUserDto);
        newUser.botState = BotState.ON;
        return await this.userRepository.save(newUser);
    }

    public async login(loginUserDto: LoginUserDto): Promise<UserEntity> {
        const user = await this.userRepository.findOne({
            select: ['id', 'username', 'password'],
            where: {
                username: loginUserDto.username,
            },
        });


        if (user === null) {
            throw new HttpException(
                `User or email ${loginUserDto.username} does not exist`,
                HttpStatus.UNAUTHORIZED,
            );
        }

        const isPasswordCorrect = await compare(
            loginUserDto.password,
            user.password,
        );

        if (isPasswordCorrect === false) {
            throw new HttpException(
                `Password for ${loginUserDto.username} is wrong`,
                HttpStatus.UNAUTHORIZED,
            );
        }

        return user;
    }

    public async updateBotstate(telegramId: number, botState: BotState): Promise<UserEntity> {
        const updateResult = await this.userRepository.update(
            {telegramId},
            {botState},
        );

        if (updateResult.affected !== 1) {
            console.error(
                'Always should be 1 row on updateUser! Actual affected: ',
                updateResult.affected,
            );
        }

        return this.getByTelegramId(telegramId);
    }

    public async updateUser(
        telegramId: number,
        updateUserDto: UpdateUserDto,
    ): Promise<UserEntity> {
        const user = await this.getByTelegramId(telegramId, true);

        const username = updateUserDto.username ?? user.username;

        if (updateUserDto.username !== undefined) {
            const possibleDuplicateByUsername = await this.userRepository.findOneBy({
                id: Not(telegramId),
                username,
            });

            if (possibleDuplicateByUsername !== null) {
                throw new HttpException(
                    'Username is already taken!',
                    HttpStatus.BAD_REQUEST,
                );
            }
        }


        Object.assign(user, {username});
        const updateResult = await this.userRepository.update(
            {telegramId},
            {username},
        );
        if (updateResult.affected !== 1) {
            console.error(
                'Always should be 1 row on updateUser! Actual affected: ',
                updateResult.affected,
            );
        }

        return await this.getById(telegramId);
    }

    public async getById(
        id: number,
        withPassword = false,
    ): Promise<UserEntity | null> {
        if (id === undefined || id === null) {
            return null;
        }

        const searchOptions: FindOneOptions = withPassword
            ? {where: {id}, select: ['username', 'password', 'email']}
            : {where: {id}};

        return await this.userRepository.findOne(searchOptions);
    }

    public async getByTelegramId(
        telegramId: number,
        withPassword = false,
    ): Promise<UserEntity | null> {
        if (telegramId === undefined || telegramId === null) {
            return null;
        }

        const searchOptions: FindOneOptions = withPassword
            ? {where: {telegramId}, select: ['username', 'password']}
            : {where: {telegramId}};

        return await this.userRepository.findOne(searchOptions);
    }

    public async buildUserResponse(user: UserEntity): Promise<IUserResponse> {
        const token = await this.generateJwt(user);
        return {
            user: {
                username: user.username,
                id: user.id,
                botState: user.botState,
                token,
                telegramId: user.telegramId,
                expiresIn: 86400,
                cups: user.cups,
            },
        };
    }

    private async generateJwt(user: UserEntity): Promise<string> {
        let RS256Secret;
        try {
            RS256Secret = await fs.promises.readFile('./resources/private.key');
        } catch (e) {
            console.error('Error while reading rs256 secret: ', e);
            throw new HttpException(
                'Internal Server Error',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return sign(
            {
                id: user.id,
                username: user.username,
            },
            RS256Secret,
            {
                algorithm: 'RS256',
                expiresIn: '1d',
            },
        );
    }
}
