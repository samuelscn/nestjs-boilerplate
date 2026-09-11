# Docker

O `Dockerfile` usa estágios separados para dependências, build e runtime. A
imagem final executa como usuário sem privilégios e contém apenas `dist`,
dependências de produção e metadados do pacote.

`docker-compose.yml` sobe API e PostgreSQL para desenvolvimento/demo. Credenciais
ali são locais e devem ser substituídas em qualquer ambiente real. O volume
preserva dados entre reinícios; `docker compose down -v` os apaga.

Testes não usam esse banco: Testcontainers cria PostgreSQL efêmero por suíte. O
`docker-compose.test.yml` existe para depuração manual na porta 5433.
