import {Column, Entity, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {UserEntity} from "@webserver/user/user.entity";

@Entity({name: 'cups'})
export class CupEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @ManyToOne(() => UserEntity, (user) => user.cups)
    manager: UserEntity;

    @Column()
    startTimestamp: Date;

    @Column()
    endTimestamp: Date;
}
