import { spawnSync } from "node:child_process";
import "dotenv/config";

const [operation, mode = process.env.AUTHORIZATION_MODE ?? "single"] =
  process.argv.slice(2);
if (
  !["generate", "revert"].includes(operation) ||
  !["single", "tenant"].includes(mode)
) {
  throw new Error(
    "Usage: npm run migration:access:<generate|revert> -- <single|tenant>",
  );
}
const args = [
  "-r",
  "ts-node/register",
  "-r",
  "tsconfig-paths/register",
  "node_modules/typeorm/cli.js",
  `migration:${operation}`,
];
if (operation === "generate")
  args.push(
    `src/package/access-control/persistence/migration/${mode}/AccessSchema`,
  );
args.push("-d", "src/package/access-control/persistence/access.datasource.ts");
const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: { ...process.env, AUTHORIZATION_MODE: mode },
});
process.exit(result.status ?? 1);
