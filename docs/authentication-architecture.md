# Arquitetura de autenticação

```mermaid
flowchart TD
  BFF[Next.js BFF] -->|Bearer Access Token| API[NestJS API / PermissionGuard]
  API --> HTTP[Extração de IdentityCredentials]
  HTTP --> Provider[IdentityProvider: OidcIdentityProvider]
  Provider -->|Assinatura RS256 / claims / at+jwt| JOSE[jose.jwtVerify]
  JOSE --> Cache[JWKS cache por processo]
  Cache -.->|Busca inicial / rotação / TTL| JWKS[Ginga Identity JWKS]
  Discovery[OIDC Discovery no bootstrap] -->|jwks_uri| Cache
  JOSE --> Subject[sub → AuthenticatedIdentity.userId]
  Subject --> Access[AccessService: Tenant / Membership / RBAC local]
  Access --> Context[RequestContext]
  Context --> Domain[Controller / Service / Domain]
```

O guard já existente extrai credenciais e depende exclusivamente de
`IdentityProvider`. Uma factory assíncrona Nest seleciona Fake/OIDC pelo
ConfigService validado. Discovery termina antes de o Nest atender requests.
O provider somente autentica. A resolução de tenant, roles e permissions continua
no AccessService e nas transações existentes. O RequestContext mantém a identidade
e a autorização local imutáveis, sem propagar claims arbitrários do JWT.
