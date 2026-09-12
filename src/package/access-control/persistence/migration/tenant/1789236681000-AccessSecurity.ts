import { MigrationInterface, QueryRunner } from "typeorm";
import { installSecurityV1, removeSecurityV1 } from "../security-v1";
export class AccessSecurity1789236681000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await installSecurityV1(runner, true);
  }
  async down(runner: QueryRunner): Promise<void> {
    await removeSecurityV1(runner, true);
  }
}
