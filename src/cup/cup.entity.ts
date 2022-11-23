import {Column, Entity, JoinTable, ManyToMany, ManyToOne, PrimaryGeneratedColumn} from 'typeorm';
import {UserEntity} from "@webserver/user/user.entity";

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

    @Column()
    startTimestamp: Date;

    @Column()
    endTimestamp: Date;
}
