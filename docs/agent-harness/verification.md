# Verificação

| Mudança              | Verificação mínima                           |
| -------------------- | -------------------------------------------- |
| Documentação         | revisão dos links e exemplos                 |
| TypeScript           | `npm run build`                              |
| Layout/imports       | `npm run lint`                               |
| Regra de negócio     | `npm run test:unit`                          |
| Repository/migration | `npm run test:integration`                   |
| Controller/DTO/fluxo | `npm run test:e2e` + `npm run openapi:check` |
| Mudança ampla        | `npm run check` + suítes pertinentes         |
| Dependências         | `npm run security:audit` + suítes afetadas   |

Integração e E2E precisam de Docker para o Testcontainers. Registre claramente
quando o ambiente impedir sua execução; não substitua silenciosamente PostgreSQL
por um banco em memória com semântica diferente.
