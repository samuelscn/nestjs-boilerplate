# Docker

O `Dockerfile` usa estágios separados para dependências, build e runtime. A
imagem final executa como usuário sem privilégios e contém apenas `dist`,
dependências de produção e metadados do pacote.

`docker-compose.yml` sobe API e PostgreSQL para desenvolvimento/demo. Credenciais
ali são locais e devem ser substituídas em qualquer ambiente real. O volume
preserva dados entre reinícios; `docker compose down -v` os apaga.

O compose local usa `NODE_ENV=development` e `IDENTITY_PROVIDER=fake` por padrão.
O init local cria `ginga_migrator` e `ginga_app` apenas em volumes novos. A API usa
o login restrito; antes de iniciá-la, rode `npm run db:migrate` (migrations e grants;
ver [o guia de autorização](authorization.md#operação-e-usuários-de-banco)). Não apague
um volume existente para provisionar essas roles. Escolha `AUTHORIZATION_MODE`
antes de criar o schema. Sem adapter do Identity Provider, endpoints retornam 401.

Testes não usam esse banco: Testcontainers cria PostgreSQL efêmero por suíte. O
`docker-compose.test.yml` existe para depuração manual na porta 5433.
