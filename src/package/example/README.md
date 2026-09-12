# Pacote `example`

Exemplo descartável de um pacote de negócio completo. Ele existe para mostrar
fronteiras, não para impor o nome “example” aos produtos derivados.

## Caminho

1. `ExampleController` valida DTOs e mapeia respostas.
   Seus endpoints exigem `Permission.example.create/read` via guard global.
2. `ExampleService` executa o caso de uso.
3. `ExampleItemRepository` expressa consultas e encapsula TypeORM.
4. `ExampleItemEntity` pertence exclusivamente a este pacote.
5. `ExamplePersistenceModule` configura o DataSource nomeado `example`.

O módulo exporta apenas o service. Se outro pacote precisar integrá-lo, prefira
um contrato/facade explícito em `public-api/`; nunca exporte o repository.

Este exemplo tem dados globais e só entra na composição `single`. Para um produto
multitenant, adapte a entity, o repository e sua unidade de trabalho conforme
[o guia de isolamento](../../../docs/authorization.md) antes de registrar o módulo.
Migrations são aplicadas no deployment, nunca automaticamente pelo runtime.

## Adaptando

Renomeie pasta, módulo, DataSource, entidade/tabela e scripts de migration.
Substitua `name` por dados reais, adicione regras ao service e mantenha DTOs
separados das entities.

## Testes

- Unit: decisões do service com repository mockado.
- Integration: queries reais em PostgreSQL efêmero.
- E2E: validação e contrato HTTP pelo Nest completo.

Não teste decorators ou getters triviais isoladamente. Teste comportamento que
poderia quebrar sem o teste.
