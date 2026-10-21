import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessSchema1792546616834 implements MigrationInterface {
  name = "AccessSchema1792546616834";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD "email" character varying(254)`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD "displayName" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD "status" character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD "lastSeenAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD "profileSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ALTER COLUMN "identityUserId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f84603e5d2becb4b8407496a99" ON "access_identity_user" ("email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD CONSTRAINT "CHK_cc34d598660bdd2b7a008abe9c" CHECK (("status" = 'invited') = ("identityUserId" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ADD CONSTRAINT "CHK_1336598d36267b128e07cde29b" CHECK ("status" IN ('invited', 'active', 'suspended'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP CONSTRAINT "CHK_1336598d36267b128e07cde29b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP CONSTRAINT "CHK_cc34d598660bdd2b7a008abe9c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f84603e5d2becb4b8407496a99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" ALTER COLUMN "identityUserId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP COLUMN "profileSyncedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP COLUMN "lastSeenAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP COLUMN "displayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_identity_user" DROP COLUMN "email"`,
    );
  }
}
