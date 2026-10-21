---
name: new-endpoint
description: Add or change an HTTP endpoint end to end - DTOs, permission, OpenAPI, Problem Details errors, E2E and the published contract. Use for any controller/route change.
---

# Novo endpoint

1. DTO de entrada com class-validator + `@ApiProperty`/`@ApiPropertyOptional` (tipos explícitos, inclusive `type: Number` em query params). Query com arrays: `@Transform(toArray)` (veja `MemberQueryDto`).
2. Handler: `@RequirePermission(...)` (ou `RequireAll/AnyPermission`; `RequireMembership` só para dados do próprio chamador), `@ApiOkResponse/@ApiCreatedResponse({ type })`, `@HttpCode(204)` + `@ApiNoContentResponse()` quando não houver corpo. Feature nova: `@FeatureFlag("nome")`.
3. Service lança `DomainError(kind, code, { params })` (ou `AccessError`) — nunca responda erro manualmente.
4. E2E: sucesso + falhas relevantes, verificando `status` e `code` do Problem Details.
5. `npm run openapi:export` e commite `contracts/openapi.json`. Avise que o frontend precisa de `npm run api:sync` (e traduções se houver código ou permissão novos).

Aceite: `npm run test:e2e` e `npm run openapi:check` verdes.
