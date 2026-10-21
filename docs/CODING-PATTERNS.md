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

Erros de domínio não devem depender de classes HTTP. Services lançam
`DomainError(kind, code, { params })` e o `ProblemExceptionFilter` responde em
RFC 9457 (`application/problem+json`) com `code` estável, `params`, `errors[]` e
`traceId`. Clientes decidem e traduzem por `code`, nunca por texto. Não crie
filtros por pacote nem registre outro `ValidationPipe`. Detalhes em
[problem](../src/package/shared/module/problem/README.md). Delimite a transação no service quando uma operação
precisar de atomicidade e mantenha todas as escritas no mesmo DataSource.

## Contrato HTTP (OpenAPI)

`contracts/openapi.json` é o contrato publicado para o frontend, que gera seus
tipos a partir dele. Documente explicitamente: `@ApiProperty` nos DTOs de entrada
e saída, `@ApiOkResponse`/`@ApiCreatedResponse({ type })` nos handlers e
`@ApiTags` no controller. Não retorne entidades nem interfaces do core; mapeie
para um `*ResponseDto`. Respostas de erro (Problem Details) são adicionadas a
todas as operações por `src/openapi.ts`, que também publica o enum `ProblemCode`:
registre ali o catálogo de códigos específicos de um pacote novo.

Depois de mudar controller/DTO, rode `npm run openapi:export` e commite o JSON;
o CI falha (`openapi:check`) se ele estiver defasado. Fora de produção, a API
serve a documentação em `/docs`. O plugin CLI do Swagger não é usado: ele gera
imports quebrados em caminhos com caracteres não ASCII.

## Feature flags

Funcionalidade nova ou arriscada nasce atrás de uma flag registrada em
`src/feature-flags.ts` (padrão seguro, dono, `removeBy`). Use `@FeatureFlag()` no
handler (desligada responde 404) e `FeatureFlags.isEnabled()` para variações no
service. Veja [feature-flags](../src/package/shared/module/feature-flags/README.md).

## Imports entre pacotes

Exponha contratos mínimos pelo `index.ts` ou por `public-api/`. Não importe
repository/entity de outro pacote; integre por facade, contrato ou evento.
