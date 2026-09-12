# Access control

Pacote dono de roles, grants, assignments e, na composição multitenant, tenants e
memberships. Um DataSource nomeado `access-control` preserva atomicidade. O core
usa a porta `AccessStore`; TypeORM e SQL ficam em `persistence/`.

`AccessControlModule.forRoot("single" | "tenant")` instala proteção global com
default deny. `IdentityProvider` é uma capability separada: o fake mapeia tokens
conhecidos para subjects estáveis em development/test e OIDC falha fechado até o
adapter Ginga Identity estar disponível. Ambos os modos usam o mesmo
AuthorizationService e AccessService.
Cada modo tem entities/migrations próprias; mudar o modo de um banco existente
exige um projeto de migração de dados, não uma simples troca de variável.

Leia [o guia](../../../docs/authorization.md) e [a decisão arquitetural](../../../docs/decisions/001-authorization.md).
