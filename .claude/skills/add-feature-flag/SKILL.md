---
name: add-feature-flag
description: Gate new or risky API behavior behind a typed feature flag. Use when releasing an endpoint or behavior gradually or per environment.
---

# Nova feature flag

1. Registre em `src/feature-flags.ts` com `default` seguro, `description`, `owner`, `removeBy`.
2. Rota: `@FeatureFlag("nome")` (desligada → 404 antes da autenticação). Variação de comportamento: `FeatureFlags.isEnabled("nome")` no service.
3. E2E nos dois estados (veja `shared/module/feature-flags/__test__`).
4. Registre a flag equivalente no frontend quando houver UI (`src/config/flags.ts` do nextjs-boilerplate).
5. Valores por ambiente em `FEATURE_FLAGS`; remova a flag e o ramo morto até `removeBy`.
