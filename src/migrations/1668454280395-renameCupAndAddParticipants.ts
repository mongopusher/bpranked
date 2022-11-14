import { MigrationInterface, QueryRunner } from "typeorm";

export class renameCupAndAddParticipants1668454280395 implements MigrationInterface {
    name = 'renameCupAndAddParticipants1668454280395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "cups_attendees_users" ("cupsId" integer NOT NULL, "usersId" integer NOT NULL, CONSTRAINT "PK_6583bc5ed986ee2c6b3c21ad005" PRIMARY KEY ("cupsId", "usersId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5e974ba4eac3d3b3e4cf5e1084" ON "cups_attendees_users" ("cupsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_80253500b6f9cb7aac4fd0351c" ON "cups_attendees_users" ("usersId") `);
        await queryRunner.query(`ALTER TABLE "cups_attendees_users" ADD CONSTRAINT "FK_5e974ba4eac3d3b3e4cf5e10845" FOREIGN KEY ("cupsId") REFERENCES "cups"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "cups_attendees_users" ADD CONSTRAINT "FK_80253500b6f9cb7aac4fd0351c4" FOREIGN KEY ("usersId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "cups_attendees_users" DROP CONSTRAINT "FK_80253500b6f9cb7aac4fd0351c4"`);
        await queryRunner.query(`ALTER TABLE "cups_attendees_users" DROP CONSTRAINT "FK_5e974ba4eac3d3b3e4cf5e10845"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_80253500b6f9cb7aac4fd0351c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e974ba4eac3d3b3e4cf5e1084"`);
        await queryRunner.query(`DROP TABLE "cups_attendees_users"`);
    }

}
