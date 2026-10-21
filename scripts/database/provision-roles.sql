-- One-time provisioning of a hosted PostgreSQL (e.g. Railway) as its superuser.
-- Usage (passwords from your secret manager, never committed):
--   psql "$SUPERUSER_DATABASE_URL" -v migrator_password="..." -v app_password="..." \
--     -f scripts/database/provision-roles.sql
-- Then: MIGRATION_DATABASE_USERNAME=ginga_migrator, DATABASE_USERNAME=ginga_app.
\set ON_ERROR_STOP on
CREATE ROLE ginga_migrator LOGIN PASSWORD :'migrator_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
CREATE ROLE ginga_app LOGIN PASSWORD :'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO ginga_migrator;
GRANT USAGE ON SCHEMA public TO ginga_app;
