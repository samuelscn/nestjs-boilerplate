# Padrões de implementação

## Fluxo de uma requisição

`controller → service → repository → TypeORM/PostgreSQL`

- Controller valida entrada, chama um caso de uso e mapeia a resposta.
- Service concentra regra e orquestração, sem imports de HTTP ou TypeORM.
- Repository oferece métodos com intenção de negócio e esconde queries.
- Entity e DataSource permanecem em `persistence/`.

O pacote `example` é a implementação executável deste documento.

## Layout de pacote

```text
<package>/
├── README.md
├── index.ts
├── <package>.module.ts
├── core/{service,model,error,contract}/
├── http/rest/{controller,dto}/
├── persistence/{entity,repository,migration}/
└── __test__/{unit,integration,e2e}/
```

Crie apenas diretórios usados. `npm run lint:structure` exige os arquivos de
entrada e impede alguns acoplamentos mecânicos.

## Persistência

- Um pacote é dono das próprias tabelas, repositories e migrations.
- Use DataSource nomeado com o nome do pacote.
- Prefixe tabelas com o pacote (`example_item`) para evitar colisões.
- Não exponha `Repository`, `QueryBuilder` ou opções TypeORM ao service.
- Use nomes como `findActiveByOwner`, não `findWithWhereAndRelations`.
- `synchronize` é permitido somente em testes.
- Gere mudanças com `npm run migration:generate` e revise o resultado.

## Configuração

Variáveis de ambiente entram em factories Zod e são lidas pelo `ConfigService`
tipado. Falhe no bootstrap para configuração ausente ou inválida. Nunca leia
segredos diretamente em regras de negócio.

## Erros e transações

Erros de domínio não devem depender de classes HTTP. A camada HTTP traduz o
erro quando necessário. Delimite a transação no service quando uma operação
precisar de atomicidade e mantenha todas as escritas no mesmo DataSource.

## Imports entre pacotes

Exponha contratos mínimos pelo `index.ts` ou por `public-api/`. Não importe
repository/entity de outro pacote; integre por facade, contrato ou evento.
