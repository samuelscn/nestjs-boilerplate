# Feature flags

Flags tipadas por ambiente. O registro do produto fica em `src/feature-flags.ts`
(bootstrap): cada flag tem descrição, dono, data de remoção e um padrão seguro.
`FEATURE_FLAGS=nome=true,outra=false` é validado em `src/config.ts`; nome ou valor
desconhecido falha no boot.

- `@FeatureFlag("nome")` em controller/handler: desligada, a rota responde 404
  `RESOURCE_NOT_FOUND` antes da autenticação, como se não existisse.
- `FeatureFlags.isEnabled("nome")` em services, para variações de comportamento.

`FeatureFlagsModule.forRoot(valores)` deve ser importado antes dos módulos que
registram guards. Flag decide **se** a funcionalidade existe; permissão decide
**quem** pode usá-la. Remova a flag e o código morto até `removeBy`. O frontend
tem um registro equivalente (`src/config/flags.ts` do nextjs-boilerplate).
