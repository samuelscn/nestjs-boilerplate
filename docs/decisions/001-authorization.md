# Decisão 001 — Authorization por permissions e tenancy opcional

Status: implementada. Data: 2026-09-12.

## Contexto investigado

NestJS 11, TypeORM 0.3, PostgreSQL 16, pacotes com DataSource e migrations próprios;
controller → service → repository. Jest/Testcontainers cobre unit, integration e
E2E. O repositório não tinha identidade, tenancy, RequestContext, ADRs ou event bus.
`DefaultEntity.deletedAt` é uma preparação incompleta, sem caso de uso de soft delete.

## Decisões e alternativas

| Questão             | Decisão e motivo                                                           | Alternativa considerada / impacto                                                                      |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Authentication      | Porta para IdP externo; adapter padrão nega                                | Implementar JWT/senhas locais misturaria capabilities e exigiria contrato inexistente                  |
| Permissões          | Catálogo literal resource:action em código, validado na fronteira          | Strings arbitrárias/permissions criadas por tenants permitiriam contratos incoerentes                  |
| RBAC                | Roles e grants no banco; união de múltiplas roles; sem DENY                | Role única no user/membership não atende produtos e confunde autorização com agrupamento               |
| Tenancy opcional    | Mesmo engine e serviço, schemas alternativos single/tenant                 | Uma tabela com tenantId nullable aumentaria o risco de grants globais acidentais                       |
| Ownership dos dados | Pacote access-control e um DataSource para o agregado RBAC/tenant          | Pacotes independentes para role e tenant exigiriam coordenação distribuída para bootstrap              |
| Custom roles        | Slug local e FKs tenantId+id; permissões limitadas ao catálogo e ao ator   | Só validação no código permitiria referências cross-tenant por erro no repository                      |
| System roles        | Linhas próprias por tenant, imutáveis na API; OWNER protegido              | ADMIN global compartilhado confundiria fronteiras e dificultaria auditoria                             |
| Ownership           | OWNER como role; mínimo um; transferência em duas operações seguras        | ownerId no tenant duplicaria fonte de verdade; remoções simultâneas exigem lock                        |
| Ausência de regra   | Guard global default deny; class e método somam requisitos                 | Guard opt-in permitiria endpoints esquecidos; override de metadata poderia enfraquecer classe          |
| Signup              | Identidade validada pode criar novo tenant sem acesso a tenants existentes | Provisionamento fechado depende da política comercial do produto; exceção explicitamente documentada   |
| Tenant desejado     | Resolver substituível; header UUID único como adapter inicial              | Acoplar engine a header/claim tornaria difícil substituir transporte e validar divergências            |
| RequestContext      | AsyncLocalStorage imutável; contexto HTTP interno em WeakMap               | Estado singleton mutável ou propriedades autodeclaradas no request arriscariam confused deputy         |
| RLS                 | ENABLE + FORCE, fence restritiva em USING/WITH CHECK; vazio nega           | Apenas WHERE tenantId não protege queries esquecidas; RLS sozinho não comprova membership              |
| Pool                | set_config parametrizado e local à transação, manager obrigatório          | SET de sessão exigiria cleanup frágil e permitiria vazamento entre requests                            |
| TOCTOU              | Reavaliação sob lock mantido até o commit; mesmo lock em mutações          | Cache/request snapshot sem revalidação autorizaria operações após revogação                            |
| Concorrência        | Serialização por tenant; singleton no modo simples                         | Locks granulares aumentariam paralelismo, mas exigiriam protocolo mais complexo para todas as escritas |
| Database users      | Migrator separado; runtime sem ownership, bypass, DDL ou TRUNCATE          | FORCE não limita superusers; migrar no processo HTTP ampliaria privilégios permanentes                 |
| Jobs                | Contexto técnico explícito ou runAuthorized para identidade com grants     | Bypass genérico permitiria operações cross-tenant acidentais                                           |
| Cache               | Nenhum cache nesta versão                                                  | Invalidação e chave por tenant seriam complexidade sem necessidade medida                              |
| Auditoria           | Registro transacional append-only pelo runtime; ponto de extensão no store | Event bus externo sem outbox poderia publicar eventos de operações revertidas                          |
| Soft delete         | Remoção física de custom roles/memberships, audit preservado               | Herdar deletedAt sem política de reativação e uniques parciais introduziria ambiguidades               |

## Consequências e limites

Produtos gerados podem excluir entities/migrations de tenant na composição simples.
Trocar uma instalação já populada de modo exige migração planejada de dados.
O exemplo global é composto somente no modo simples; os módulos de produto multitenant
precisam do padrão de entity/repository/transação descrito no guia.

Services de outros pacotes não importam entities/repositories de access-control.
Cada DataSource tem seu próprio contexto transacional; atomicidade entre DataSources
não é prometida. Políticas de domínio, convite via IdP/email, status de membership,
exclusão de tenant, health público e streaming não são implementados por este RBAC.

A serialização pode limitar throughput dentro de um tenant. A versão prioriza
invariantes demonstráveis; otimizações devem preservar a ordem entre decisão,
mutação e revogação. Nenhum ID UUID é tratado como prova de autorização.
O runtime não é uma sandbox contra SQL/código arbitrário executado com suas credenciais.

As policies/triggers usam SQL versionado porque o gerador TypeORM não modela esses
objetos. Tabelas, índices e FKs foram gerados pelo script do projeto. Snapshots de
catálogo em migrations são imutáveis, independentes do catálogo atual.

## Verificação de segurança

Os testes verificam escalada por delegação, ADMIN tentando atribuir OWNER, IDOR,
cross-tenant em código e SQL, headers duplicados/forjados, ausência de metadata,
pool reutilizando o mesmo backend, rollback do bootstrap e do handler, mínimo um
OWNER sob concorrência e reavaliação após revogação. As suítes incluem migração
up/down, checagem de drift e recusa de login/policies inseguros no bootstrap.

Referências: [guia de implementação](../authorization.md),
[PostgreSQL RLS](https://www.postgresql.org/docs/16/ddl-rowsecurity.html),
[TypeORM transactions](https://typeorm.io/docs/advanced-topics/transactions/).
