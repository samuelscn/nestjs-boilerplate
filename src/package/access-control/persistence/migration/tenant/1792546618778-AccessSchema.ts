import { MigrationInterface, QueryRunner } from "typeorm";

export class AccessSchema1792546618778 implements MigrationInterface {
  name = "AccessSchema1792546618778";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD "email" character varying(254)`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD "displayName" character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD "status" character varying(16) NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD "lastSeenAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD "profileSyncedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP CONSTRAINT "UQ_bd48c76c4e3c81f59dffdba607a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ALTER COLUMN "identityUserId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_48595aa8aad7a7b3a094de567f" ON "access_membership" ("tenantId", "email") WHERE "email" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD CONSTRAINT "CHK_1df82b5f5a779d7d2a222d9afe" CHECK (("status" = 'invited') = ("identityUserId" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD CONSTRAINT "CHK_a13c5dae605b24f23399bcc5a7" CHECK ("status" IN ('invited', 'active', 'suspended'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD CONSTRAINT "UQ_bd48c76c4e3c81f59dffdba607a" UNIQUE ("tenantId", "identityUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP CONSTRAINT "UQ_bd48c76c4e3c81f59dffdba607a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP CONSTRAINT "CHK_a13c5dae605b24f23399bcc5a7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP CONSTRAINT "CHK_1df82b5f5a779d7d2a222d9afe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_48595aa8aad7a7b3a094de567f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ALTER COLUMN "identityUserId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" ADD CONSTRAINT "UQ_bd48c76c4e3c81f59dffdba607a" UNIQUE ("tenantId", "identityUserId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP COLUMN "profileSyncedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP COLUMN "lastSeenAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP COLUMN "status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP COLUMN "displayName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "access_membership" DROP COLUMN "email"`,
    );
  }
}
