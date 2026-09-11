const config = require("./jest.config.js");

module.exports = {
  ...config,
  testRegex: ".*\\.spec\\.ts$",
  collectCoverageFrom: ["src/package/*/core/service/**/*.ts"],
  coverageDirectory: "<rootDir>/coverage/unit",
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
