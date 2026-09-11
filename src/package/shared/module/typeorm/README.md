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
