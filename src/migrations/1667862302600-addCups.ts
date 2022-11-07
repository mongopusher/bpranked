import { MigrationInterface, QueryRunner } from "typeorm";

export class addCups1667862302600 implements MigrationInterface {
    name = 'addCups1667862302600'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cups" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "startTimestamp" TIMESTAMP NOT NULL, "endTimestamp" TIMESTAMP NOT NULL, "managerId" integer, CONSTRAINT "PK_eb06c57b14b7bd052c86fdc7933" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "botState" integer NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "cups" ADD CONSTRAINT "FK_42a8008db23bc5d60d674d515a2" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cups" DROP CONSTRAINT "FK_42a8008db23bc5d60d674d515a2"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "botState"`);
        await queryRunner.query(`DROP TABLE "cups"`);
    }

}
