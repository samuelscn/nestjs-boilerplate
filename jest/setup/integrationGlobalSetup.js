const { PostgreSqlContainer } = require("@testcontainers/postgresql");

module.exports = async () => {
  const container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("boilerplate_integration")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  process.env.NODE_ENV = "test";
  process.env.APP_PORT = "3000";
  process.env.LOG_RULES = "context=*;level=error";
  // Hermetic: a developer .env (loaded by dotenv/config) must not switch providers.
  process.env.IDENTITY_PROVIDER = "fake";
  process.env.AUTHORIZATION_MODE = "single";
  delete process.env.PROBLEM_TYPE_BASE;
  process.env.DATABASE_HOST = container.getHost();
  process.env.DATABASE_PORT = String(container.getPort());
  process.env.DATABASE_USERNAME = container.getUsername();
  process.env.DATABASE_PASSWORD = container.getPassword();
  process.env.DATABASE_NAME = container.getDatabase();
  global.__POSTGRES_CONTAINER__ = container;
};
