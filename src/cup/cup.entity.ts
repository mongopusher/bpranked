import {Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {UserEntity} from "@webserver/user/user.entity";
import {GameEntity} from "@webserver/game/game.entity";
import {EloEntity} from "@webserver/elo/elo.entity";
import {CupMode} from "@webserver/cup/cup-type.enum";

@Entity({ name: 'cups' })
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

    @OneToMany(() => EloEntity, (elo) => elo.user)
    @JoinTable()
    elos: Array<EloEntity>;

    @OneToMany(() => GameEntity, (game) => game.cup)
    games: Array<GameEntity>;

    @Column()
    startTimestamp: Date;

    @Column()
    endTimestamp: Date;

    @Column({
        type: 'enum',
        enum: CupMode,
        default: CupMode.Two
    })
    mode: CupMode;
}
