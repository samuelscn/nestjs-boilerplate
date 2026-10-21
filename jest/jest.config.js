module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "..",
  transform: {
    "^.+\\.ts$": "ts-jest",
    "node_modules/(uuid|jose)/.+\\.js$":
      "<rootDir>/jest/transform/esm-to-commonjs.js",
  },
  transformIgnorePatterns: ["/node_modules/(?!(uuid|jose)/)"],
  setupFiles: ["<rootDir>/jest/setup/setEnvironment.js"],
  moduleNameMapper: { "^src/(.*)$": "<rootDir>/src/$1" },
  testEnvironment: "node",
  clearMocks: true,
  restoreMocks: true,
};
