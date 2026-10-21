# Deploy no Railway

Cada projeto gerado deste boilerplate tem dois ambientes no mesmo projeto Railway, cada um
com o próprio Postgres:

| Ambiente     | Gatilho                                            | Como                                                     |
| ------------ | -------------------------------------------------- | -------------------------------------------------------- |
| `homolog`    | merge na `main`                                    | integração GitHub nativa do Railway (com _Wait for CI_)  |
| `production` | release publicada no GitHub para uma tag da `main` | `.github/workflows/deploy-production.yml` (`railway up`) |

O `railway.json` vale para os dois: build pelo `Dockerfile`, `preDeployCommand`
`node dist/database/migrate.js` (migrations de todos os pacotes com a role de migration e
grants para a role runtime), healthcheck em `/health/ready` (consulta o banco) e restart em
falha. Um deploy só recebe tráfego depois que migrations e healthcheck passaram.

## Checklist ao nascer um projeto

1. **Railway**: projeto com os ambientes `homolog` e `production`. Em cada um, um serviço
   **Postgres** e um serviço **`api`** a partir do repositório (outro nome exige a variável
   `RAILWAY_SERVICE` no GitHub).
   - `homolog`: branch `main`, **Wait for CI** ligado.
   - `production`: **sem** deploy automático (só o workflow implanta).
   - _Settings → Networking → Generate Domain_ em cada serviço `api`.
2. **Roles do banco** (uma vez por ambiente). O usuário do Postgres do Railway é superuser, e
   a API recusa subir com ele (`AccessDatabaseCheck`). Crie as roles com senhas novas:
   ```sh
   railway link   # selecione o projeto e o ambiente
   railway connect Postgres   # abre psql como superuser; ou use a DATABASE_PUBLIC_URL
   ```
   e execute o conteúdo de `scripts/database/provision-roles.sql` (via psql:
   `-v migrator_password=... -v app_password=... -f scripts/database/provision-roles.sql`).
3. **Variáveis** do serviço `api` (tabela abaixo). Nunca reutilize senhas entre ambientes.
4. **Identity**: adicione o domínio da API em `OAUTH_RESOURCES` do Ginga Identity do mesmo
   ambiente; o front que chama esta API usa esse valor como `OIDC_AUDIENCE`.
5. **GitHub**: secret `RAILWAY_TOKEN` (_production → Settings → Tokens → Project Token_).
   Opcional: proteger o environment `production` com aprovação manual.
6. **Primeiro OWNER** (modo `single`), depois do primeiro deploy, com o `sub` do usuário no
   Identity:
   ```sh
   railway ssh --service api --environment homolog
   node dist/database/bootstrap-owner.js <sub>
   ```
   No modo `tenant`, o primeiro membro nasce pelo signup de tenant.

## Variáveis por ambiente

| Variável                                                      | Valor                                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`                                                    | `production` (também em homolog: é a imagem de produção)                     |
| `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME`           | `${{Postgres.PGHOST}}` / `${{Postgres.PGPORT}}` / `${{Postgres.PGDATABASE}}` |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD`                     | `ginga_app` / senha definida no provisionamento                              |
| `MIGRATION_DATABASE_USERNAME` / `MIGRATION_DATABASE_PASSWORD` | `ginga_migrator` / senha definida no provisionamento                         |
| `AUTHORIZATION_MODE`                                          | `single` ou `tenant`, decidido antes do primeiro deploy (não troca depois)   |
| `IDENTITY_PROVIDER`                                           | `oidc`                                                                       |
| `OIDC_ISSUER`                                                 | `https://<identity do ambiente>/api/auth`                                    |
| `OIDC_AUDIENCE`                                               | domínio desta API (o mesmo cadastrado em `OAUTH_RESOURCES`)                  |
| `LOG_LEVEL`                                                   | `info`                                                                       |
| `PROBLEM_TYPE_BASE` / `FEATURE_FLAGS`                         | opcionais                                                                    |

`PORT` é injetada pelo Railway e usada quando `APP_PORT` não está definida.

## Produção e rollback

1. `main` verde e implantada em homolog.
2. Crie a tag `vX.Y.Z` na `main` e publique a release. Pre-releases não implantam.
3. Rollback: _Actions → Deploy production → Run workflow_ com uma tag anterior, ou
   _Redeploy_ no painel do Railway. Migrations não são revertidas: mudanças de schema
   devem ser compatíveis com a versão anterior (expand/contract).
