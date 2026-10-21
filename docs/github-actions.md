# GitHub Actions e segurança

O workflow `continuous-integration.yml` executa em pull requests para `main`, em
cada push na `main` (o commit squash do merge), manualmente e toda segunda-feira. Ele possui três checks:

- `Quality`: lint, regras arquiteturais, build e testes unitários.
- `Database tests`: integração e E2E com PostgreSQL efêmero via Testcontainers.
- `Security`: falha para qualquer vulnerabilidade reportada pelo `npm audit`,
  inclusive de severidade baixa e em dependências de desenvolvimento.

O passo `npm outdated` é informativo porque “mais recente” nem sempre significa
compatível ou seguro. Dependabot abre PRs semanais para npm, actions e Docker;
cada atualização precisa passar pelos mesmos checks.

## Proteção obrigatória

O arquivo de workflow não consegue proteger branches sozinho. Em
`Settings → Rules → Rulesets`, proteja `main` (único tronco, ver `docs/workflow.md`),
exija pull request e marque como obrigatórios os checks `Quality`, `Database tests` e `Security`.
Sem essa configuração no GitHub, administradores ainda podem fazer merge apesar
de uma action falhar.

## Deploy de produção

`deploy-production.yml` roda quando uma release (não pre-release) é publicada para uma tag
da `main`, ou manualmente com uma tag anterior (rollback). Executa `railway up --ci` com o
secret `RAILWAY_TOKEN` (project token do ambiente production) e a variável opcional
`RAILWAY_SERVICE` (padrão `api`). Homologação não passa por aqui: o Railway implanta a
`main` sozinho. Setup completo em [`deploy.md`](deploy.md).
