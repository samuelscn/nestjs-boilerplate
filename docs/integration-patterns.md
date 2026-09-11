# Padrões de integração

Integrações não pertencem ao `shared` por padrão. O pacote consumidor define
um contrato com linguagem de negócio e um adapter implementa HTTP/SDK.

## Cliente externo

O cliente é responsável por URL, autenticação, timeout, retry seguro, formato
do fornecedor e tradução de erros. O service conhece somente operações como
`authorizePayment()` ou `sendNotification()`.

Defina timeout sempre. Faça retry apenas para falhas transitórias e operações
idempotentes, com backoff e limite. Circuit breaker só é necessário quando há
volume/criticidade que justifique sua complexidade.

## Logs

Use `AppLogger` e campos estruturados (`context`, `action`, `correlationId`,
identificadores técnicos e duração). Nunca registre senhas, tokens, cookies,
documentos ou payloads pessoais completos. O interceptor sanitiza chaves comuns,
mas isso não substitui seleção cuidadosa dos metadados.

## Observabilidade

- Log: diagnóstico contextual.
- Métrica: volume, latência e erro agregados.
- Trace: caminho entre processos.
- Health check: capacidade atual de atender, sem executar regra destrutiva.

Adicione cada sinal por uma pergunta operacional real; não instrumente por
decoração.

## Teste

Mocke o contrato externo em unitários. Em integração, teste o adapter contra um
fake controlado ou sandbox. E2E deve provar apenas os fluxos críticos, evitando
depender de fornecedor real.
