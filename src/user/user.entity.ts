import {BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn} from 'typeorm';
import {hash} from 'bcrypt';
import {BotState} from "@webserver/bot/botState.constant";

@Entity({name: 'users'})
export class UserEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    telegramId: number;

    @Column()
    username: string | undefined;

    @Column({select: false})
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
}
