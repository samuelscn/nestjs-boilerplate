# Health

`registerHealthRoutes(app, sources)` expõe `GET /health/live` (processo no ar) e
`GET /health/ready` (cada DataSource responde `SELECT 1`; senão 503). As rotas ficam
fora do roteamento do Nest, portanto sem guard de permissão nem autenticação, e não
revelam detalhes do erro. O `railway.json` usa `/health/ready` como healthcheck.
