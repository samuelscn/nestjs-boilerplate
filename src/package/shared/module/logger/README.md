# Logger

Configura `nestjs-pino`, disponibiliza `AppLogger` e registra metadados em JSON.
Em desenvolvimento, `pino-pretty` melhora leitura; produção mantém JSON.

`LoggingInterceptor` usa `correlationIdOf` (compartilhado com o filtro de erros,
que roda também quando um guard falha antes do interceptor) para criar/propagar
o correlation ID, registra método, rota, status e
duração, além de query, params, body e user-agent sanitizados. A URL registrada
não inclui query string. A sanitização é recursiva, preserva o payload original e
oculta campos sensíveis em camelCase, snake_case e kebab-case, além de JWTs
compactos reconhecíveis em valores de texto. Correlation IDs recebidos precisam ter formato
UUID. O Pino também censura campos comuns de segredo como defesa adicional.
Nunca envie JWTs, cookies, credenciais ou PII em logs de produto.

A lista de campos sensíveis não identifica todo segredo ou dado pessoal possível.
Ao adicionar payloads com dados pessoais, defina os campos permitidos para log e
adapte a política antes de expô-los. O log automático do Pino permanece limitado
a metadados, sem headers/body/query; os payloads sanitizados vêm do interceptor.

`LOG_RULES` usa segmentos separados por `/`, por exemplo
`context=*;level=info/context=Database;level=debug`.
