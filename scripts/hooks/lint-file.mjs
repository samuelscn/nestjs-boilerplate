// Claude Code PostToolUse hook (Edit/Write): lints the edited TypeScript file so layer and
// type-safety rules give feedback while the agent works. Exit 2 returns findings to the agent.
import { spawnSync } from "node:child_process";
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
const target = input.tool_input?.file_path;
if (!target || !/\.ts$/u.test(target)) process.exit(0);
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const path = relative(root, resolve(root, target));
if (!path.startsWith("src/")) process.exit(0);
const result = spawnSync(
  process.execPath,
  ["node_modules/eslint/bin/eslint.js", path],
  { cwd: root, encoding: "utf8" },
);
if (result.status !== 0) {
  console.error(
    `ESLint found problems in ${path}. Fix them before continuing:\n${result.stdout}${result.stderr}`,
  );
  process.exit(2);
}
