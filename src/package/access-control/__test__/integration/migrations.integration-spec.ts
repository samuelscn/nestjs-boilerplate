import { securityDatabase } from "../support/security-database";
import { AccessDatabaseCheck } from "../../persistence/access-database-check";

describe.each(["single", "tenant"] as const)(
  "%s migration lifecycle",
  (mode) => {
    let db: Awaited<ReturnType<typeof securityDatabase>>;
    beforeAll(async () => {
      db = await securityDatabase(mode);
    });
    afterAll(async () => {
      if (db) await db.close();
    });
    it("reverts and reapplies policies then schema without metadata drift", async () => {
      await db.migration.undoLastMigration();
      await db.migration.runMigrations();
      await new AccessDatabaseCheck(db.source, mode).onModuleInit();
      const [{ count }] = await db.migration.query<{ count: string }[]>(
        "SELECT count(*) FROM access_migrations",
      );
      for (let index = 0; index < Number(count); index++)
        await db.migration.undoLastMigration();
      expect(
        await db.migration.query(
          "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'access_migrations'",
        ),
      ).toEqual([]);
      await db.migration.runMigrations();
      expect(
        (await db.migration.driver.createSchemaBuilder().log()).upQueries,
      ).toEqual([]);
    });
  },
);
