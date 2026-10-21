const defaults = {
  NODE_ENV: "test",
  APP_PORT: "3000",
  LOG_RULES: "context=*;level=error",
  DATABASE_HOST: "localhost",
  DATABASE_PORT: "5432",
  DATABASE_USERNAME: "postgres",
  DATABASE_PASSWORD: "postgres",
  DATABASE_NAME: "boilerplate_test",
  IDENTITY_PROVIDER: "fake",
  AUTHORIZATION_MODE: "single",
};

process.env = { ...defaults, ...process.env };
