// Conventional Commits (feat, fix, docs, chore…), also used to read history and changelogs.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: { "body-max-line-length": [0] },
};
