import {Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {UserEntity} from "@webserver/user/user.entity";
import {CupEntity} from "@webserver/cup/cup.entity";

@Entity({name: 'elos'})
export class EloEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => CupEntity, (cup) => cup.elos)
    cup: CupEntity;

    @ManyToOne(() => UserEntity, (user) => user.elos)
    user: UserEntity;

    @Column()
    timestamp: Date;
}