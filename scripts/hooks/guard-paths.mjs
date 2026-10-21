// Claude Code PreToolUse hook (Edit/Write): blocks edits to files that must never be
// hand-edited. Exit code 2 refuses the tool call and shows the reason to the agent.
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

const input = JSON.parse(
  await new Promise((done) => {
    let data = "";
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => done(data || "{}"));
  }),
);
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
if (!target) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const absolute = resolve(root, target);
const path = relative(root, absolute).replaceAll("\\", "/");
const rules = [
  [
    /^\.env(?!\.example$)/u,
    "Environment files hold secrets. Edit .env.example and ask the user to set values.",
  ],
  [
    /^package-lock\.json$/u,
    "Use npm install/uninstall to change dependencies; never hand-edit the lockfile.",
  ],
  [
    /^contracts\/openapi\.json$/u,
    "Generated. Change decorators/DTOs and run `npm run openapi:export`.",
  ],
];
for (const [pattern, reason] of rules)
  if (pattern.test(path)) {
    console.error(`Blocked edit to ${path}: ${reason}`);
    process.exit(2);
  }
// Applied migrations are history: change the schema with a new generated migration.
if (/\/persistence\/migration\/.+\.ts$/u.test(path) && existsSync(absolute)) {
  console.error(
    `Blocked edit to existing migration ${path}. Generate a new migration with the project script instead.`,
  );
  process.exit(2);
}
