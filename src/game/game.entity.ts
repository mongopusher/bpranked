import {CreateDateColumn, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {UserEntity} from "@webserver/user/user.entity";
import {CupEntity} from "@webserver/cup/cup.entity";

@Entity({ name: 'games' })
export class GameEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CupEntity, (cup) => cup.games, {
        onDelete: 'CASCADE',
    })
    cup: CupEntity;

    @ManyToMany(() => UserEntity, (user) => user.gamesWon)
    @JoinTable()
    winners: Array<UserEntity>;

    @ManyToMany(() => UserEntity, (user) => user.gamesLost)
    @JoinTable()
    losers: Array<UserEntity>;

    @CreateDateColumn()
    created_at: Date;
}