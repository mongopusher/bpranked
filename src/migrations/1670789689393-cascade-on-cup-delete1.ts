import { MigrationInterface, QueryRunner } from "typeorm";

export class cascadeOnCupDelete11670789689393 implements MigrationInterface {
    name = 'cascadeOnCupDelete11670789689393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_75b598e81e6db84bad3071f62f8"`);
        await queryRunner.query(`ALTER TABLE "games" ADD CONSTRAINT "FK_75b598e81e6db84bad3071f62f8" FOREIGN KEY ("cupId") REFERENCES "cups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "games" DROP CONSTRAINT "FK_75b598e81e6db84bad3071f62f8"`);
        await queryRunner.query(`ALTER TABLE "games" ADD CONSTRAINT "FK_75b598e81e6db84bad3071f62f8" FOREIGN KEY ("cupId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
