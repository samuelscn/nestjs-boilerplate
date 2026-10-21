# Problem

Contrato público de erros da API: [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
(`application/problem+json`) com as extensões Ginga `code`, `params`, `errors`,
`traceId` e `timestamp`. `ProblemModule.forRoot()` instala o filtro global e o
único `ValidationPipe` da aplicação; não registre outros.

```jsonc
{
  "type": "urn:ginga:problem:last-owner-required", // PROBLEM_TYPE_BASE + code
  "title": "Last Owner Required",   // por tipo, inglês, para desenvolvedores
  "status": 409,
  "detail": "…",                    // opcional, inglês, nunca em 5xx
  "instance": "/access/members/…",  // path sem query string
  "code": "LAST_OWNER_REQUIRED",    // identidade estável: clientes decidem e traduzem por ele
  "params": { "max": 32 },          // valores para a mensagem traduzida (só primitivos)
  "errors": [{ "field": "email", "code": "IS_EMAIL" }], // só em validação
  "traceId": "…",                   // == header x-correlation-id e log
  "timestamp": "2026-10-20T21:00:00.000Z"
}
```

## Como lançar

Service lança `DomainError(kind, code, { params, detail })`; não importa HTTP.
O `kind` define o status no filtro:

| kind              | status | code genérico             |
| ----------------- | ------ | ------------------------- |
| `validation`      | 400    | `VALIDATION_ERROR`        |
| `unauthenticated` | 401    | `AUTHENTICATION_REQUIRED` |
| `forbidden`       | 403    | `AUTHORIZATION_FORBIDDEN` |
| `not_found`       | 404    | `RESOURCE_NOT_FOUND`      |
| `conflict`        | 409    | `RESOURCE_CONFLICT`       |
| `rule`            | 422    | `DOMAIN_RULE_VIOLATION`   |
| `rate_limit`      | 429    | `RATE_LIMIT_EXCEEDED`     |
| `unavailable`     | 503    | `SERVICE_UNAVAILABLE`     |

Use um código específico (`CATEGORY_FULL`) quando o cliente precisar distinguir a
condição; caso contrário, o genérico. Declare códigos específicos no `core/model`
do pacote (veja `AccessProblem`). Códigos publicados não são renomeados nem
reutilizados. Todo código novo precisa de tradução no frontend.

`AccessError` (autorização) é convertido pelo mesmo filtro; o segundo argumento
opcional define o código específico.

## Validação

DTOs com class-validator viram `errors[]`: `field` com caminho (`items[0].name`) e
`code` derivado da constraint (`isEmail` → `IS_EMAIL`, propriedade não permitida
→ `UNKNOWN_FIELD`). Para params, use `context`:
`@Min(18, { context: { params: { min: 18 } } })`.

## Segurança

Erro desconhecido vira 500 `INTERNAL_SERVER_ERROR` sem `detail`/`params`; stack e
mensagem vão para o log com o `traceId`. Nunca coloque segredos, SQL ou PII em
`detail` ou `params`. 401 inclui `WWW-Authenticate: Bearer`; `retryAfterSeconds`
gera `Retry-After`.

## Contrato publicado

`contracts/problem-fixtures.json` é verificado pelo E2E deste módulo e consumido
pelos testes de contrato do frontend. Alterou o formato? Atualize os dois lados.
