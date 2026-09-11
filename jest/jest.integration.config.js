const config = require("./jest.config.js");

module.exports = {
  ...config,
  testRegex: ".*\\.integration-spec\\.ts$",
  collectCoverageFrom: ["src/package/*/persistence/repository/**/*.ts"],
  coverageDirectory: "<rootDir>/coverage/integration",
  globalSetup: "<rootDir>/jest/setup/integrationGlobalSetup.js",
  globalTeardown: "<rootDir>/jest/setup/integrationGlobalTeardown.js",
  maxWorkers: 1,
  testTimeout: 120000,
};
