# NestJS Modular Boilerplate

Base reutilizável para APIs NestJS com monólito modular, TypeORM, PostgreSQL,
logs estruturados, Docker e testes por camada.

## Início rápido

Pré-requisitos: Node.js 24+, npm 11+ e Docker.

```bash
cp .env.example .env
npm install
docker compose up -d postgres
DATABASE_USERNAME=ginga_migrator DATABASE_PASSWORD=ginga_migrator_dev npm run migration:access:run -- single
DATABASE_USERNAME=ginga_migrator DATABASE_PASSWORD=ginga_migrator_dev npm run database:access:grant -- single ginga_app
DATABASE_USERNAME=ginga_migrator DATABASE_PASSWORD=ginga_migrator_dev npm run migration:run
docker compose exec postgres psql -U postgres -d nestjs_boilerplate -c 'GRANT SELECT, INSERT, UPDATE, DELETE ON example_item TO ginga_app'
npm run start:dev
```

Em development/test, a API usa `IDENTITY_PROVIDER=fake`; por exemplo,
`Authorization: Bearer fake-token-admin` produz `usr_fake_admin`. O fake aceita
somente tokens documentados e não contém RBAC/tenancy. Em produção,
`IDENTITY_PROVIDER=fake` é recusado; configure o adapter OIDC do Ginga Identity.
No modo simples, o exemplo oferece `POST /examples` e `GET /examples`, protegidos
por permissions. Provisione o primeiro OWNER com
`AccessService.initializeSingleApplication(externalOwnerId)` em script confiável.
Consulte [o guia de autorização](docs/authorization.md) para integrar identidade,
habilitar multitenancy e configurar banco existente/produção. As senhas acima são
somente de desenvolvimento; o init do compose não altera volumes já existentes.

## Estrutura

```text
src/
├── app.module.ts             # composição da aplicação
├── main.ts                   # bootstrap e concerns globais
└── package/
    ├── access-control/       # roles, grants e tenancy opcional
    ├── example/              # pacote de referência substituível
    │   ├── core/             # casos de uso e regras
    │   ├── http/             # controllers e DTOs
    │   ├── persistence/      # TypeORM, repositories e migrations
    │   └── __test__/         # unit, integration e e2e
    └── shared/module/        # infraestrutura sem regra de negócio
```

Cada pacote possui um README local. Comece por
[`src/package/example/README.md`](src/package/example/README.md) e consulte
[`docs/CODING-PATTERNS.md`](docs/CODING-PATTERNS.md) antes de criar um módulo.

## Como funcionam identidade, RBAC e multitenancy

O boilerplate separa quatro decisões diferentes:

```text
Ginga Identity       quem é o usuário (authentication)
API                  o que ele pode fazer (authorization/RBAC)
Membership/Tenant    em qual tenant ele está operando
PostgreSQL RLS       quais linhas essa transação pode acessar
```

Authentication nunca é implementada localmente. A API recebe um Bearer Access
Token, entrega as credenciais ao `IdentityProvider` e usa somente o resultado
agnóstico `{ userId }`. O provider fake existe para desenvolvimento e testes;
o futuro provider OIDC validará assinatura/JWKS, issuer, audience e expiração,
retornando o claim `sub` como `userId`. Nenhum provider de identidade conhece
roles, permissions ou tenants.

Em development/test, configure `IDENTITY_PROVIDER=fake` e use um dos tokens
documentados em [`docs/authorization.md`](docs/authorization.md). O fake aceita
somente tokens conhecidos, como `fake-token-admin → usr_fake_admin`; ele não
transforma um valor arbitrário do header em usuário. Em produção, fake é
recusado no bootstrap. `IDENTITY_PROVIDER=oidc` falha explicitamente até o
adapter OIDC do Ginga Identity ser instalado, evitando autenticação simulada em
produção. A implementação pode ser trocada por `forRoot(..., { identity })`
sem alterar controllers, services, tenancy ou RBAC.

### Os dois modos de geração

Escolha `AUTHORIZATION_MODE` antes de criar o banco e mantenha o mesmo modo
durante toda a vida daquela instalação:

| Configuração | Modelo                                                       | Isolamento                              |
| ------------ | ------------------------------------------------------------ | --------------------------------------- |
| `single`     | identidade → várias roles → permissions                      | sem Tenant, Membership ou RLS           |
| `tenant`     | identidade → Membership → roles daquele tenant → permissions | tenant obrigatório, RLS e FKs compostas |

O motor de autorização é o mesmo nos dois casos. No modo `single`, uma identidade
pode ter várias roles globais. No modo `tenant`, a role nunca é global: cada
tenant possui suas próprias linhas OWNER, ADMIN, MEMBER e custom roles. O mesmo
usuário pode ser ADMIN no Tenant A e MEMBER no Tenant B porque são memberships e
assignments diferentes. `UNIQUE(tenantId, identityUserId)`, `UNIQUE(tenantId,
slug)` e FKs compostas impedem duplicação e relações cross-tenant no banco.

Quando um tenant é criado, uma única transação cria Tenant, roles de sistema,
permissions padrão, Membership do criador e assignment OWNER. Falhas fazem
rollback completo. Roles de sistema não podem ser editadas ou removidas pela
API; o último OWNER não pode sair nem perder a role sem transferência. Custom
roles podem combinar apenas permissions que o produto declarou em código.

### Permissions e endpoints

Permissions são identificadores literais `resource:action` definidos pelo produto:

```ts
export const Permission = definePermissions({
  project: ["read", "create", "update", "delete"],
  member: ["read", "invite", "remove"],
});

@RequirePermission(Permission.project.create)
createProject() {}
```

Use `@RequireAllPermissions(...)` quando todas forem necessárias ou
`@RequireAnyPermission(...)` quando uma delas bastar. O guard global aplica
default deny: endpoint sem metadata de permission, identity ausente, membership
inexistente ou permission desconhecida não concede acesso. Roles são apenas
agrupamentos; endpoints nunca são protegidos por `@Roles("admin")`.

As APIs de gerenciamento ficam no pacote `access-control`:

| Operação                           | Permission                       |
| ---------------------------------- | -------------------------------- |
| listar/criar/alterar/remover roles | `role:read/create/update/delete` |
| atribuir ou remover role           | `role:assign`                    |
| listar/convidar/remover members    | `member:read/invite/remove`      |

O ator também precisa possuir as permissions que está delegando. Portanto,
`role:assign` não permite conceder uma role mais poderosa que a do próprio ator.
As rotas nunca aceitam `tenantId`, `roleId` ou `userId` como prova de autorização;
esses valores são conferidos pelo contexto e pelo banco.

### RequestContext e tenant atual

Após autenticar, o guard resolve o tenant solicitado pelo `TenantResolver`
(por padrão, um único header UUID `x-tenant-id`). O resolver só identifica o
tenant desejado; a aplicação confirma que ele existe e que o usuário possui
Membership. Então `RequestContexts.current()` disponibiliza uma estrutura
imutável para toda a request:

```ts
{
  identity: { userId: "usr_123" },
  tenant: { id: "tenant-a", membershipId: "membership-1" }, // somente tenant
  authorization: {
    roleIds: ["role-1"],
    permissions: [Permission.project.read],
  },
}
```

Controllers e services não devem descobrir usuário, tenant ou permissions por
conta própria. O `AccessService` revalida membership e permissions dentro da
transação da operação, sob lock, para que uma revogação concorrente não deixe
uma decisão antiga autorizar uma escrita.

### RLS e repositories tenant-scoped

Toda entidade de negócio tenant-scoped precisa ter `tenantId UUID NOT NULL`,
índice iniciado por `tenantId`, unicidade local ao tenant e FKs compostas para
outros recursos tenant-scoped. A migration deve habilitar `ENABLE ROW LEVEL
SECURITY` e `FORCE ROW LEVEL SECURITY` com uma policy restritiva baseada em:

```sql
tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
```

O repository executa dentro de `TenantDatabase.runInTenantContext(tenantId,
work)`. Esse helper abre uma transação, usa `set_config(..., true)` parametrizado
e limpa o contexto ao fazer commit/rollback. Contexto ausente resulta em zero
linhas; não existe `disableRls()` ou `SET` global de sessão. RLS é uma segunda
camada: a aplicação ainda valida tenant e membership explicitamente.

O usuário runtime do PostgreSQL não pode ser superuser, owner das tabelas,
`BYPASSRLS`, `CREATEROLE`, `CREATEDB`, DDL, `TRUNCATE` ou alteração do catálogo.
Migrations usam uma role separada. O compose fornece roles locais de exemplo;
produção deve criá-las no gerenciador de segredos. Detalhes de grants, novas
tabelas e a estratégia de `FORCE` estão em [`docs/authorization.md`](docs/authorization.md).

### Jobs, auditoria e testes

Jobs e workers não possuem RequestContext automaticamente. Para executar uma
operação tenant-scoped, use `runInTenantContext(tenantId, work)`; isso fornece
isolamento de linhas, não uma identidade nem permissions. Para agir em nome de
uma identidade autorizada, use `AccessService.runAuthorized(...)` com uma
identity técnica que tenha Membership e roles. Operações administrativas
cross-tenant devem ser explícitas e separadas; não há bypass global.

Alterações importantes geram registros em `access_audit` na mesma transação:
criação de tenant/membership, criação/alteração/remoção de role e assignments.
O runtime pode inserir e ler auditoria, mas não alterá-la ou apagá-la.

As suítes verificam autorização, IDOR, payloads adulterados, roles cross-tenant,
RLS diretamente no PostgreSQL, inserts/updates/deletes indevidos, rollback,
revogação, concorrência de OWNER e vazamento de contexto em pool reutilizado.
Execute `npm run check`, `npm run test:integration` e `npm run test:e2e` antes de
publicar um produto derivado. O guia completo e as invariantes que não podem
ser quebradas estão em [`docs/authorization.md`](docs/authorization.md), e as
alternativas arquiteturais estão em [`docs/decisions/001-authorization.md`](docs/decisions/001-authorization.md).

## Comandos

| Comando                      | Finalidade                          |
| ---------------------------- | ----------------------------------- |
| `npm run start:dev`          | desenvolvimento com reload          |
| `npm run lint`               | ESLint e regras arquiteturais       |
| `npm run build`              | compilação TypeScript/Nest          |
| `npm run test:unit`          | regras isoladas e rápidas           |
| `npm run test:integration`   | TypeORM com PostgreSQL real         |
| `npm run test:e2e`           | contrato HTTP completo              |
| `npm run check`              | lint, build e testes unitários      |
| `npm run security:audit`     | exige zero vulnerabilidades         |
| `npm run migration:generate` | gera migration do pacote de exemplo |
| `npm run migration:run`      | aplica migrations                   |

Testes de integração e E2E criam seu próprio PostgreSQL com Testcontainers;
não dependem do banco local. Veja [`jest/README.md`](jest/README.md).

## Usando como boilerplate

1. Renomeie `example` para o primeiro contexto de negócio.
2. Atualize o nome da classe, conexão, tabela e scripts de migration.
3. Registre o novo módulo em `app.module.ts`.
4. Preserve as fronteiras demonstradas no exemplo.
5. Execute `npm run check` e a suíte de banco/HTTP pertinente.

Authentication pertence ao IdP externo e entra por adapter. Authorization pertence
à aplicação: [guia e exemplos](docs/authorization.md),
[decisão arquitetural](docs/decisions/001-authorization.md). Filas e clientes externos
continuam entrando somente quando necessários ao produto.

## Colaboração

- Hooks: Husky roda lint e unitários antes do commit.
- Merge requests: `.gitlab/merge_request_templates/Default.md`.
- Agentes: `AGENTS.md` é o mapa de execução e `docs/agent-harness/` contém os detalhes.
- Contribuição humana: `CONTRIBUTING.md`.
- Docker: `docs/docker.md`.
- CI: `.gitlab-ci.yml` verifica cada MR.
- GitHub Actions: `docs/github-actions.md` descreve os checks obrigatórios.
