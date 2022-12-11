import {Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {UserEntity} from "@webserver/user/user.entity";
import {GameEntity} from "@webserver/game/game.entity";

@Entity({name: 'cups'})
export class CupEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @ManyToOne(() => UserEntity, (user) => user.ownedCups)
    manager: UserEntity | undefined;

    @ManyToMany(() => UserEntity, (user) => user.attendedCups)
    @JoinTable()
    attendees: Array<UserEntity> | undefined;

    @OneToMany(() => GameEntity, (game) => game.cup)
    games: Array<GameEntity>;

    @Column()
    startTimestamp: Date;

    @Column()
    endTimestamp: Date;
}
