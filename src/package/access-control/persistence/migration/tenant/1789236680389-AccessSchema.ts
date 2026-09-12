import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessSchema1789236680389 implements MigrationInterface {
  name = "AccessSchema1789236680389";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "access_permission" ("id" character varying(100) NOT NULL, CONSTRAINT "PK_f508f8beabd39886e3394e0cbf8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_tenant" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(80) NOT NULL, CONSTRAINT "UQ_9e782ec84d4b76cf5ecefa7ab4e" UNIQUE ("slug"), CONSTRAINT "PK_275ba69ed42c12fc2de39cc8cb1" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_membership" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenantId" uuid NOT NULL, "identityUserId" character varying(255) NOT NULL, CONSTRAINT "UQ_4b254290754a1f6c2eaccd71d00" UNIQUE ("tenantId", "id"), CONSTRAINT "UQ_bd48c76c4e3c81f59dffdba607a" UNIQUE ("tenantId", "identityUserId"), CONSTRAINT "PK_894d11f3727d65479bd74c6d224" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenantId" uuid NOT NULL, "name" character varying(120) NOT NULL, "slug" character varying(80) NOT NULL, "description" character varying(500), "isSystem" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_0f78759e7d0942791f307b74ff1" UNIQUE ("tenantId", "id"), CONSTRAINT "UQ_74e802f717bea72e1947a387b33" UNIQUE ("tenantId", "slug"), CONSTRAINT "PK_7d06a7e6a36beabf44a9daff95b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role_permission" ("tenantId" uuid NOT NULL, "roleId" uuid NOT NULL, "permissionId" character varying(100) NOT NULL, CONSTRAINT "PK_bfa593af4c441ef424afd90e94a" PRIMARY KEY ("tenantId", "roleId", "permissionId"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "access_role_assignment" ("tenantId" uuid NOT NULL, "memberId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_a4ecd12f1fcb3e6a59c71414660" PRIMARY KEY ("tenantId", "memberId", "roleId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_46b9ea23988d75332e54dce24e" ON "access_role_assignment" ("tenantId", "roleId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "access_audit" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tenantId" uuid NOT NULL, "event" character varying(50) NOT NULL, "actorId" character varying(255) NOT NULL, "targetId" character varying(255) NOT NULL, CONSTRAINT "PK_b6a4e188bb1a19cc67bda200569" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a86c75d9f2631984b1deb4c877" ON "access_audit" ("tenantId", "createdAt") `,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD CONSTRAINT "FK_ac180c7cd867d94cba214e89ff2" FOREIGN KEY ("tenantId") REFERENCES "access_tenant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role" ADD CONSTRAINT "FK_1df9f5103f04636cda997e43d14" FOREIGN KEY ("tenantId") REFERENCES "access_tenant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" ADD CONSTRAINT "FK_8130e8ccad4daed327ab3c5dbf6" FOREIGN KEY ("permissionId") REFERENCES "access_permission"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" ADD CONSTRAINT "FK_f341e89227513943ff1adf36cc2" FOREIGN KEY ("tenantId", "roleId") REFERENCES "access_role"("tenantId","id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" ADD CONSTRAINT "FK_46b9ea23988d75332e54dce24e4" FOREIGN KEY ("tenantId", "roleId") REFERENCES "access_role"("tenantId","id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" ADD CONSTRAINT "FK_f10acca0b6781c352cd30047873" FOREIGN KEY ("tenantId", "memberId") REFERENCES "access_membership"("tenantId","id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_audit" ADD CONSTRAINT "FK_296c410c444a395c83e6a635d96" FOREIGN KEY ("tenantId") REFERENCES "access_tenant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_audit" DROP CONSTRAINT "FK_296c410c444a395c83e6a635d96"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" DROP CONSTRAINT "FK_f10acca0b6781c352cd30047873"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_assignment" DROP CONSTRAINT "FK_46b9ea23988d75332e54dce24e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" DROP CONSTRAINT "FK_f341e89227513943ff1adf36cc2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role_permission" DROP CONSTRAINT "FK_8130e8ccad4daed327ab3c5dbf6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_role" DROP CONSTRAINT "FK_1df9f5103f04636cda997e43d14"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP CONSTRAINT "FK_ac180c7cd867d94cba214e89ff2"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a86c75d9f2631984b1deb4c877"`,
    );
    await queryRunner.query(`DROP TABLE "access_audit"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_46b9ea23988d75332e54dce24e"`,
    );
    await queryRunner.query(`DROP TABLE "access_role_assignment"`);
    await queryRunner.query(`DROP TABLE "access_role_permission"`);
    await queryRunner.query(`DROP TABLE "access_role"`);
    await queryRunner.query(`DROP TABLE "access_membership"`);
    await queryRunner.query(`DROP TABLE "access_tenant"`);
    await queryRunner.query(`DROP TABLE "access_permission"`);
  }
}
