import {BeforeInsert, BeforeUpdate, Column, Entity, ManyToMany, OneToMany, PrimaryGeneratedColumn} from 'typeorm';
import {hash} from 'bcrypt';
import {BotState} from "@webserver/bot/bot-state.constant";
import {CupEntity} from "@webserver/cup/cup.entity";
import {GameEntity} from '@webserver/game/game.entity';

@Entity({ name: 'users' })
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

    @Column({ nullable: true })
    elo: number | undefined;

    @BeforeInsert()
    @BeforeUpdate()
    async hashPassword() {
        if (this.password !== undefined) {
            this.password = await hash(this.password, 10);
        }
    }

    @OneToMany(() => CupEntity, (cup) => cup.manager)
    ownedCups: Array<CupEntity>;

    @ManyToMany(() => CupEntity, (cup) => cup.attendees)
    attendedCups: Array<CupEntity>;

    @ManyToMany(() => GameEntity, (game) => game.winners)
    gamesWon: Array<GameEntity>;

    @ManyToMany(() => GameEntity, (game) => game.losers)
    gamesLost: Array<GameEntity>;
}
