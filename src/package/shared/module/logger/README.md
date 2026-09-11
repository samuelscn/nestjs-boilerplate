# Logger

Configura `nestjs-pino`, disponibiliza `AppLogger` e registra metadados em JSON.
Em desenvolvimento, `pino-pretty` melhora leitura; produção mantém JSON.

`LoggingInterceptor` cria/propaga correlation ID, registra método, rota, status e
duração e sanitiza campos sensíveis conhecidos. O Pino também censura headers de
autorização/cookie e campos comuns de segredo. Evite enviar bodies completos:
a sanitização é defesa adicional, não autorização para registrar PII.

`LOG_RULES` usa segmentos separados por `/`, por exemplo
`context=*;level=info/context=Database;level=debug`.
