import { UserEntity } from '@webserver/user/user.entity';

export type TUser = Omit<UserEntity, 'hashPassword' | 'password' | 'ownedCups' | 'attendedCups'| 'gamesWon' | 'gamesLost' | 'elos'>;
