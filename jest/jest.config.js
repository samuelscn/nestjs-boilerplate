module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  transform: { "^.+\\.ts$": "ts-jest" },
  setupFiles: ["<rootDir>/jest/setup/setEnvironment.js"],
  moduleNameMapper: { "^src/(.*)$": "<rootDir>/src/$1" },
  testEnvironment: "node",
  clearMocks: true,
  restoreMocks: true,
};
