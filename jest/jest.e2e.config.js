const config = require("./jest.config.js");

module.exports = {
  ...config,
  testRegex: ".*\\.e2e-spec\\.ts$",
  collectCoverageFrom: ["src/package/*/http/rest/controller/**/*.ts"],
  coverageDirectory: "<rootDir>/coverage/e2e",
  globalSetup: "<rootDir>/jest/setup/integrationGlobalSetup.js",
  globalTeardown: "<rootDir>/jest/setup/integrationGlobalTeardown.js",
  maxWorkers: 1,
  testTimeout: 120000,
};
