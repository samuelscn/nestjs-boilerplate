import { MigrationInterface, QueryRunner } from "typeorm";

export class ExampleSchema1789148956491 implements MigrationInterface {
  name = "ExampleSchema1789148956491";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "example_item" ("id" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "name" character varying(120) NOT NULL, CONSTRAINT "PK_8bbd06c3e6e883e04f8e6b471ef" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "example_item"`);
  }
}
