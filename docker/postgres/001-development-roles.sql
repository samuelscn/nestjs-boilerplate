-- Local development only. Production credentials are provisioned by the operator.
CREATE ROLE ginga_migrator LOGIN PASSWORD 'ginga_migrator_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE ginga_app LOGIN PASSWORD 'ginga_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO ginga_migrator;
GRANT USAGE ON SCHEMA public TO ginga_app;
