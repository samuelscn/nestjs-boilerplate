# Configuração

Wrapper global do `@nestjs/config` com retorno tipado e factories validadas por
Zod. `sharedConfigFactory` define ambiente e regras de log; `src/config.ts`
define porta e PostgreSQL.

Adicione configurações por namespace, valide no bootstrap e inclua a variável
em `.env.example`. Valores secretos nunca devem ter default de produção nem ser
expostos por endpoints/logs.
