# Authentication

## Responsabilidade

Esta API NestJS é um Resource Server. O Ginga Identity autentica usuários e emite
tokens; o Next.js BFF encaminha o access token no header Authorization. A API não
faz login, não recebe senha, não troca authorization code, não guarda refresh
token e não chama UserInfo/introspection para autenticar cada request.

O adapter HTTP exige exatamente um header `Authorization: Bearer <token>`, sem
espaços extras, com até 4096 caracteres de token. Query/body/cookies não são
fontes de autenticação. O contrato `IdentityProvider.authenticate` recebe essas
credenciais e retorna `{ userId } | null`. `userId` vem exclusivamente de `sub`.

## Configuração

| Variável            | Regra                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `IDENTITY_PROVIDER` | `fake` (padrão fora de produção) ou `oidc`                                |
| `OIDC_ISSUER`       | Obrigatória em OIDC, URL exata do emissor, sem credenciais/query/fragment |
| `OIDC_AUDIENCE`     | Obrigatória em OIDC; identificador do recurso/API solicitado pelo BFF     |

Zod valida antes do bootstrap. Produção recusa fake, inclusive quando selecionado
explicitamente na factory. URLs OIDC usam HTTPS; HTTP é permitido apenas para
loopback fora de produção. Não há fallback para fake ou outro issuer.

`FakeIdentityProvider` continua disponível para testes isolados e desenvolvimento.
Use `IDENTITY_PROVIDER=fake` e, por exemplo, `Bearer fake-token-admin`.
O subject resultante `usr_fake_admin` ainda precisa das permissões locais.

## Contrato verificado do Ginga Identity

A implementação foi baseada em `ginga-identity/src/auth/auth.ts` e no emissor
OAuth instalado nesse projeto (`@better-auth/oauth-provider`): RS256,
issuer `${BETTER_AUTH_URL}/api/auth`, access JWT com header `typ: at+jwt` e `aud`
derivado do recurso OAuth solicitado. ID Tokens usam outro tipo e audience de
cliente; são rejeitados mesmo se apresentarem a mesma audience da API.

`jose.jwtVerify` valida assinatura, allowlist **RS256**, tipo **at+jwt**, issuer
exato, audience (string ou array que contenha o recurso), expiração e `nbf`.
`iss`, `aud`, `exp` e `sub` são obrigatórios. Subject vazio/branco ou maior que
255 caracteres é recusado. Tolerância de relógio: **5 segundos**.
Não se usam email, roles, permissions, tenant ou scopes para formar a identidade.

## Discovery, cache e disponibilidade

No bootstrap, a factory consulta `${OIDC_ISSUER}/.well-known/openid-configuration`
(removendo somente a barra final ao montar o caminho). Exige que o `issuer` do
documento seja exatamente o configurado e valida `jwks_uri`. Não segue redirects
de discovery. Endpoints de login/token não são necessários nem configurados.
Falha de discovery impede a inicialização; o operador deve restabelecer o Identity
e reiniciar a API. Não há chamada ao Identity em readiness.

Um único `createRemoteJWKSet` por provider/processo mantém as chaves em memória.
O primeiro token busca JWKS sob demanda. Requests concorrentes compartilham a
busca. Timeout de discovery e JWKS: **5 segundos por chamada**.

| Situação                            | Comportamento                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| Chave conhecida, cache fresco       | Validação local, sem rede                                                                 |
| Identity indisponível, cache fresco | Tokens das chaves conhecidas continuam válidos                                            |
| Cache com mais de 10 minutos        | Atualiza JWKS; falha da atualização resulta em 401                                        |
| `kid` desconhecido                  | Atualiza após cooldown de 30 segundos desde a última busca bem-sucedida; antes disso, 401 |
| Rotação A → A+B                     | B passa após atualização; A continua válida enquanto publicada/cacheada                   |
| Remoção de A no Identity            | A deixa de ser aceita quando o cache é atualizado sem A                                   |
| Reinício do processo                | Cache vazio; discovery e próxima busca de JWKS precisam funcionar                         |

Não há cache persistido, retry infinito nem uso de chaves além do TTL.
Publique novas chaves antes de usá-las e mantenha antigas durante a validade dos
tokens, conforme a política do Identity. Consulte a
[documentação de cache do jose](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md).

## Integração local

1. Inicie o Ginga Identity conforme seu README, em `http://localhost:4000`.
2. Cadastre o recurso `http://localhost:3000` no Identity (`OAUTH_RESOURCES`) e
   configure o BFF para solicitar esse `resource` no fluxo OAuth existente.
3. Configure a API:

   ```env
   IDENTITY_PROVIDER=oidc
   OIDC_ISSUER=http://localhost:4000/api/auth
   OIDC_AUDIENCE=http://localhost:3000
   ```

4. Prepare migrations/grants do boilerplate e inicie com `npm run start:dev`.
   Configure o OWNER local com o `sub` real via
   `AccessService.initializeSingleApplication(subject)` em provisionamento confiável.
5. Faça login pelo BFF e encaminhe seu **access token** a `/access/roles`.
   Com `role:read`, retorna 200; sem permissão local, retorna 403; sem autenticação
   válida, retorna 401 `AUTHENTICATION_REQUIRED`. Não use o ID Token.

O endpoint `/auth-test/me` existe apenas na fixture E2E. Não há endpoint de debug
na aplicação. Containers precisam alcançar o issuer exato; em produção use DNS e
HTTPS. `localhost` dentro do container aponta para o próprio container.

## Testes

`npm test` cobre configuração/fake. `npm run test:integration` inclui discovery e
JWKS via servidor HTTP local, keypairs RSA descartáveis, ataques, cache, outage e
rotação. `npm run test:e2e` prova o envelope 401, `sub` no RequestContext e RBAC
local com PostgreSQL real. As suítes de integração/E2E exigem Docker.

### Validação com o Identity real

Na implementação, também foi executado um smoke test usando o código do
`ginga-identity` disponível no workspace, suas fixtures de emissão OAuth e um
PostgreSQL descartável separado. O adapter consumiu discovery/JWKS por HTTP dessa
instância: aceitou o access token emitido, preservou `sub` e rejeitou o ID Token
e uma audience diferente. O banco foi encerrado ao final. As suítes permanentes
do boilerplate continuam independentes do checkout do Identity.
