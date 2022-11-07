import {BeforeInsert, BeforeUpdate, Column, Entity, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {hash} from 'bcrypt';
import {BotState} from "@webserver/bot/botState.constant";
import {CupEntity} from "@webserver/cup/cup.entity";

@Entity({name: 'users'})
export class UserEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    telegramId: number;

    @Column()
    username: string | undefined;

    @Column({
        select: false,
        nullable: true,
    })
    password: string | undefined;

    @Column()
    botState: BotState;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        if (this.password !== undefined) {
            this.password = await hash(this.password, 10);
        }
    }

    @OneToMany(() => CupEntity, (cup) => cup.manager)
    cups: Array<CupEntity>;
}
