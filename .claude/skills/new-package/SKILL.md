---
name: new-package
description: Create a new business package (module with core/http/persistence) following the example package. Use when adding a new domain or bounded context to the API.
---

# Novo pacote de negócio

Modelo: `src/package/example` (forma, não domínio). Regras em `docs/CODING-PATTERNS.md`.

1. `src/package/<nome>/` com `README.md`, `index.ts`, `<nome>.module.ts` (o `npm run lint:structure` exige).
2. `core/`: models, `service/` (regra de negócio; sem HTTP e sem TypeORM), erros como `DomainError(kind, code)` e catálogo de códigos específicos em `core/model`.
3. `persistence/`: entities com prefixo de tabela `<nome>_`, DataSource nomeado, repository com métodos de intenção. Migrations **geradas** pelo script (nunca SQL à mão). Exporte um `PackageDatabase` (`persistence/<nome>-database.ts`, siga `example-database.ts`: options + grants mínimos do runtime) e registre-o em `src/database/migrate.ts`; sem isso o deploy não migra nem concede acesso às tabelas.
4. `http/rest/`: controller fino (chama service), DTOs de entrada com class-validator **e** `@ApiProperty`, `*ResponseDto` de saída. Nunca retorne entity ou interface do core.
5. Permissões: adicione o recurso em `definePermissions` (`shared/module/authorization/permissions.ts`) e uma migration que insira as novas permissions no catálogo do banco (siga `security-v1.ts`).
6. Registre o módulo em `src/app.module.ts` e os códigos específicos em `src/openapi.ts`.
7. `npm run openapi:export` e commite `contracts/openapi.json`.

Aceite: `npm run check`, `npm run test:integration` (persistência), `npm run test:e2e` (contrato) e `npm run openapi:check` verdes.
