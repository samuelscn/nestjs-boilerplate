# Error tracking

Rastreamento de erros com Sentry, **ligado só quando `SENTRY_DSN` existe** (sem DSN é
no-op: desenvolvimento, testes e CI não enviam nada).

- `src/instrument.ts` chama `initErrorTracking()` antes de qualquer outro import em `main.ts`.
- O `ProblemExceptionFilter` chama `captureUnexpected(error, traceId)` para toda falha
  5xx; erros 4xx e de domínio não viram evento.
- Somente erros: sem tracing, sem breadcrumbs. `scrubEvent` remove headers, cookies,
  query string, body e usuário; o evento leva stack, rota e a tag `traceId`, o mesmo
  correlation id dos logs e do campo `traceId` da resposta Problem Details.

Variáveis: `SENTRY_DSN`, `SENTRY_ENVIRONMENT` (ex. `homolog`, `production`; padrão
`NODE_ENV`) e `SENTRY_RELEASE` (padrão: commit injetado pelo Railway).
