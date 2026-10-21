import { NestFactory } from "@nestjs/core";
import { AppModule } from "src/app.module";
import { AccessService } from "src/package/access-control";

/**
 * Creates the first OWNER in single mode (fails with conflict once roles exist).
 * Usage: node dist/database/bootstrap-owner.js <identity user id (OIDC sub)>
 */
async function bootstrapOwner(): Promise<void> {
  const ownerId = process.argv[2];
  if (!ownerId)
    throw new Error("Usage: bootstrap-owner <identity user id (OIDC sub)>");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error"],
  });
  try {
    await app.get(AccessService).initializeSingleApplication(ownerId);
    console.log("Owner created");
  } finally {
    await app.close();
  }
}

bootstrapOwner().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
