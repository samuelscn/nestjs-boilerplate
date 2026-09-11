import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const packagesRoot = join(root, "src/package");
const errors = [];
const allowedPackageEntries = new Set([
  "README.md",
  "index.ts",
  "__test__",
  "core",
  "http",
  "persistence",
  "public-api",
]);

const walk = (directory) =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

for (const name of readdirSync(packagesRoot)) {
  const packagePath = join(packagesRoot, name);
  if (!statSync(packagePath).isDirectory() || name === "shared") continue;
  for (const required of ["README.md", "index.ts", `${name}.module.ts`]) {
    if (!existsSync(join(packagePath, required)))
      errors.push(`${name}: missing ${required}`);
  }
  for (const entry of readdirSync(packagePath)) {
    if (!allowedPackageEntries.has(entry) && entry !== `${name}.module.ts`) {
      errors.push(`${name}: unexpected root entry ${entry}`);
    }
  }
}

const sharedModules = join(packagesRoot, "shared/module");
for (const name of readdirSync(sharedModules)) {
  const modulePath = join(sharedModules, name);
  if (!statSync(modulePath).isDirectory()) continue;
  for (const required of ["README.md", "index.ts"]) {
    if (!existsSync(join(modulePath, required)))
      errors.push(`shared/${name}: missing ${required}`);
  }
}

for (const file of walk(packagesRoot).filter((path) => path.endsWith(".ts"))) {
  const content = readFileSync(file, "utf8");
  const displayPath = relative(root, file);
  if (
    displayPath.includes("/http/") &&
    /from ['"][^'"]*repository/.test(content)
  ) {
    errors.push(`${displayPath}: HTTP layer must not import repositories`);
  }
  if (displayPath.includes("/core/") && /from ['"]typeorm['"]/.test(content)) {
    errors.push(`${displayPath}: core must not import TypeORM`);
  }
}

if (errors.length > 0) {
  console.error(`Architecture check failed:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Architecture check passed.");
