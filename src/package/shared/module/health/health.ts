import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";

/**
 * Plain HTTP routes outside Nest routing: no guard, interceptor or authentication, so
 * load balancers and the Railway healthcheck reach them. Register before `listen()`.
 * - `/health/live`: process is up.
 * - `/health/ready`: every given DataSource answers `SELECT 1`.
 */
export function registerHealthRoutes(
  app: INestApplication,
  sources: DataSource[],
): void {
  const http = app.getHttpAdapter();
  http.get("/health/live", (_request: unknown, response: unknown) => {
    http.reply(response, { status: "ok" }, 200);
  });
  http.get("/health/ready", async (_request: unknown, response: unknown) => {
    try {
      await Promise.all(sources.map((source) => source.query("SELECT 1")));
      http.reply(response, { status: "ok" }, 200);
    } catch {
      http.reply(response, { status: "unavailable" }, 503);
    }
  });
}
