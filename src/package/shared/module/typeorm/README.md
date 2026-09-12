# TypeORM

Infraestrutura comum para DataSources nomeados e repositories encapsulados.

- `DefaultEntity`: UUID e timestamps comuns. A entity concreta aplica seus dados
  no próprio construtor depois de chamar `super()`.
- `DefaultTypeOrmRepository`: conjunto mínimo de operações protegido do domínio.
- `TypeOrmPersistenceModule`: registra conexão e transaction manager.

Cada pacote configura seu próprio DataSource em `persistence/`, possui suas
tabelas e gera suas migrations. Services não importam TypeORM e outros pacotes
não acessam repositories/entities diretamente.

Nunca habilite `synchronize` fora de testes. Para mudar schema, altere a entity,
suba PostgreSQL, execute `npm run migration:generate`, revise e teste a migration.

Para tabelas tenant-scoped, use o wrapper `TenantDatabase` por DataSource, conforme
o [guia de autorização](../../../../../docs/authorization.md). O manager global do
repository base não carrega contexto transacional/RLS: não o use para esse caso.
O `AccessRecord` de RBAC não herda o soft delete incompleto de `DefaultEntity`.
