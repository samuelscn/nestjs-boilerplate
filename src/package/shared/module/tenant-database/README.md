# Tenant database context

`TenantDatabase` liga AsyncLocalStorage ao EntityManager de uma transação real.
`runInTenantContext(tenantId, work)` usa `set_config(..., true)` parametrizado.
O manager só existe durante a transação; nesting só é permitido no mesmo tenant.
`runUnscoped` define contexto vazio: **não** desativa RLS e não acessa linhas de tenants.

Um job confiável pode abrir contexto explicitamente; isso dá isolamento de linhas,
não concede uma identidade nem permissions. Nunca passe um ID vindo de HTTP a um job
sem validar a associação no serviço responsável. Cada DataSource precisa de sua
própria instância; transações em conexões diferentes não são atomicamente coordenadas.
Não lance tarefas assíncronas sem await dentro de uma transação.

No bootstrap Nest, `onModuleInit` inspeciona toda entity com a propriedade `tenantId`:
UUID NOT NULL, índice/chave iniciado por tenantId, FORCE RLS, fence restritiva e
login sem ownership/bypass/TRUNCATE. Registre o wrapper como provider em cada pacote.
Em scripts sem Nest, execute `await database.onModuleInit()` antes de trabalhar.
