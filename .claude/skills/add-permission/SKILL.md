---
name: add-permission
description: Add a permission to the RBAC catalog and protect endpoints with it. Use when a new resource or action needs authorization.
---

# Nova permissão

Guia: `docs/authorization.md`.

1. Adicione a ação em `definePermissions` (`shared/module/authorization/permissions.ts`).
2. Crie migration que insira a permission no catálogo do banco (catálogo SQL congelado por versão; siga `security-v1.ts`, sem importar o catálogo vivo).
3. Decida se roles de sistema recebem a permission (`SYSTEM_ROLES`) e cubra em teste de integração.
4. Proteja handlers com `@RequirePermission` e verifique default deny em E2E (sem permission → 403).
5. `npm run openapi:export` (enum `Permission`) e avise o frontend: `api:sync` + rótulos `backoffice.permissions.<recurso>.<ação>`.
