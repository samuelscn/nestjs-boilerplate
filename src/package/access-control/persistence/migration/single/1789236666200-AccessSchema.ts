import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessSchema1789236666200 implements MigrationInterface {
  name = "AccessSchema1789236666200";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "access_permission" ("id" character varying(100) NOT NULL, CONSTRAINT "PK_f508f8beabd39886e3394e0cbf8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_identity_user" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "identityUserId" character varying(255) NOT NULL, CONSTRAINT "UQ_7e28b5ecc70101d4c27133122c6" UNIQUE ("identityUserId"), CONSTRAINT "PK_fa730233e79532229f470ba9355" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(80) NOT NULL, "description" character varying(500), "isSystem" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_a12d3bf0c656a567e0423174328" UNIQUE ("slug"), CONSTRAINT "PK_7d06a7e6a36beabf44a9daff95b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role_permission" ("roleId" uuid NOT NULL, "permissionId" character varying(100) NOT NULL, CONSTRAINT "PK_a58a242506d219abb1d031357db" PRIMARY KEY ("roleId", "permissionId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role_assignment" ("memberId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_ad7be15e38f4e4791c9e77902cd" PRIMARY KEY ("memberId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_da38895f8a0cc97a1b2826326e" ON "access_role_assignment" ("roleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "access_audit" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "event" character varying(50) NOT NULL, "actorId" character varying(255) NOT NULL, "targetId" character varying(255) NOT NULL, CONSTRAINT "PK_b6a4e188bb1a19cc67bda200569" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_lock" ("name" character varying(30) NOT NULL, CONSTRAINT "UQ_6705e74c081cf17f8a515625c0b" UNIQUE ("name"), CONSTRAINT "PK_6705e74c081cf17f8a515625c0b" PRIMARY KEY ("name"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" ADD CONSTRAINT "FK_8130e8ccad4daed327ab3c5dbf6" FOREIGN KEY ("permissionId") REFERENCES "access_permission"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" ADD CONSTRAINT "FK_7a96be03f16b2984348172aeb28" FOREIGN KEY ("roleId") REFERENCES "access_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" ADD CONSTRAINT "FK_da38895f8a0cc97a1b2826326ec" FOREIGN KEY ("roleId") REFERENCES "access_role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" ADD CONSTRAINT "FK_4905f77352ff6d57cfbe307cf41" FOREIGN KEY ("memberId") REFERENCES "access_identity_user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" DROP CONSTRAINT "FK_4905f77352ff6d57cfbe307cf41"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" DROP CONSTRAINT "FK_da38895f8a0cc97a1b2826326ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" DROP CONSTRAINT "FK_7a96be03f16b2984348172aeb28"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" DROP CONSTRAINT "FK_8130e8ccad4daed327ab3c5dbf6"`,
    );
    await queryRunner.query(`DROP TABLE "access_lock"`);
    await queryRunner.query(`DROP TABLE "access_audit"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_da38895f8a0cc97a1b2826326e"`,
    );
    await queryRunner.query(`DROP TABLE "access_role_assignment"`);
    await queryRunner.query(`DROP TABLE "access_role_permission"`);
    await queryRunner.query(`DROP TABLE "access_role"`);
    await queryRunner.query(`DROP TABLE "access_identity_user"`);
    await queryRunner.query(`DROP TABLE "access_permission"`);
  }
}
