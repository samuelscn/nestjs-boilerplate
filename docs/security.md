# Segurança de autenticação

| Ameaça                                   | Controle                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| Token forjado/adulterado                 | Verificação criptográfica real pelo jose e chaves públicas JWKS          |
| Issuer arbitrário                        | `iss` e issuer do discovery iguais ao único `OIDC_ISSUER` configurado    |
| Token destinado a outra API              | `aud` validado contra `OIDC_AUDIENCE`                                    |
| Token expirado ou antecipado             | `exp` obrigatório e `nbf` quando presente; tolerância de 5 segundos      |
| Algorithm confusion / `none` / HMAC      | Allowlist fixa RS256, independente do algoritmo alegado pelo token       |
| ID Token usado como acesso               | `typ: at+jwt` obrigatório e audience do recurso                          |
| Bearer malformado ou ambíguo             | Um único header, scheme Bearer, token não vazio, limite de tamanho       |
| Uso de email/roles/tenant não confiáveis | Somente `sub` vira identidade; autorização é local                       |
| Identity outage                          | Cache JWKS de 10 minutos permite validação local enquanto fresco         |
| Key rotation / abuso de `kid`            | Refresh de chave desconhecida com cooldown de 30 segundos e timeout      |
| Discovery adulterado                     | HTTPS em produção, issuer exato, URL validada e redirects recusados      |
| Fake em produção                         | Validação de configuração, factory e construtor do fake recusam produção |

Todas as falhas de autenticação retornam o mesmo Problem Details (RFC 9457):
status 401, `code: AUTHENTICATION_REQUIRED`, `traceId`, timestamp ISO e
`instance` sem query string. O filtro adiciona `WWW-Authenticate: Bearer` e o
`x-correlation-id` igual ao `traceId`. Causas internas não são serializadas.

JWTs nunca devem ser logados. Também não registre Authorization, refresh tokens,
client secrets ou cookies. O provider não registra tokens nem exceções do jose.
O log automático do Pino omite headers, bodies e query. O interceptor registra
query, params, body e user-agent com sanitização recursiva de campos sensíveis e
JWTs compactos reconhecíveis em texto; a URL não inclui query bruta.
Ele não aceita um JWT como correlation ID. A lista de campos sensíveis não cobre
dados pessoais ou segredos arbitrários: novos payloads precisam de revisão dos
campos permitidos para log. Qualquer log de produto
deve seguir a mesma regra, incluindo configuração de proxies/BFF/APM.

Validação local não fornece revogação imediata de JWTs: um access token pode
continuar válido até `exp` (mais tolerância), e uma chave removida pode continuar
no cache até atualização. Revogação de permissões/membership continua local.
Mantenha access tokens curtos e relógios sincronizados. Após expirar o cache,
indisponibilidade do JWKS causa 401; nenhuma validação de assinatura é ignorada.

Veja [comportamento operacional e integração local](authentication.md).
