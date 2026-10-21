---
name: add-error-code
description: Introduce a specific public problem code for a business rule. Use when clients must distinguish a failure (e.g. CATEGORY_FULL) from the generic status code.
---

# Novo código de erro

Contrato: RFC 9457 (`shared/module/problem/README.md`).

1. Só crie código específico se o cliente precisa distinguir a condição; senão use o genérico do `kind`.
2. Declare no catálogo do pacote (`core/model`, ex.: `AccessProblem`) com comentário do significado. Formato `UPPER_SNAKE`, imutável depois de publicado.
3. Lance `new DomainError("rule" | "conflict" | ..., Codigo, { params: { max: 32 } })`. `params` só com primitivos, sem PII ou segredos.
4. Registre o catálogo em `src/openapi.ts` (enum `ProblemCode`) e rode `npm run openapi:export`.
5. E2E verificando status, `code` e `params`.
6. Frontend: `npm run api:sync` + tradução em pt-BR/en (o teste de contrato do front falha sem ela).
