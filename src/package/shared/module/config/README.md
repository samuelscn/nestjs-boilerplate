# Configuração

Wrapper global do `@nestjs/config` com retorno tipado e factories validadas por
Zod. `sharedConfigFactory` define ambiente e regras de log; `src/config.ts`
define porta, PostgreSQL, seleção de identidade e issuer/audience OIDC.
OIDC exige URLs HTTPS (loopback HTTP fora de produção) e audience não vazia.
Fake é proibido em produção. Veja [autenticação](../../../../../docs/authentication.md).

Adicione configurações por namespace, valide no bootstrap e inclua a variável
em `.env.example`. Valores secretos nunca devem ter default de produção nem ser
expostos por endpoints/logs.
