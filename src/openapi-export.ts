import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createOpenApiDocument } from "./openapi";

/** Writes contracts/openapi.json without connecting to databases (preview mode). */
async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    preview: true,
    logger: false,
  });
  const document = createOpenApiDocument(app);
  writeFileSync(
    join(__dirname, "..", "contracts", "openapi.json"),
    JSON.stringify(document, null, 2) + "\n",
  );
  await app.close();
}

void exportOpenApi();
