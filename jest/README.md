# Estratégia de testes

## Unitários

Use para ramificações e regras no service. Mocke somente portas de saída. Devem
ser rápidos, determinísticos e não subir Nest/banco. Rode `npm run test:unit`.

## Integração

Use para repositories, mappings e comportamento específico do PostgreSQL.
Testcontainers fornece banco real e isolado. Não repita regras já cobertas nos
unitários. Rode `npm run test:integration` com Docker ativo.

## E2E

Use para poucos fluxos HTTP importantes: pipes, DTOs, status, serialização e
integração das camadas. Cubra o caminho feliz e uma falha relevante, sem tentar
enumerar toda regra de negócio. Rode `npm run test:e2e` com Docker ativo.

Cobertura é separada por responsabilidade. Uma porcentagem única sobre arquivos
sem comportamento costuma gerar testes frágeis; por isso modules, DTOs e entities
não entram artificialmente na meta unitária.

## Segurança e compatibilidade

RBAC usa migrations reais, roles PostgreSQL separadas e bancos isolados por suíte.
Os testes usam runtime sem BYPASSRLS/superuser e também verificam FORCE no owner.
Pool de uma conexão cobre vazamento após commit/rollback; concorrência cobre
ownership, revogação e bootstrap. Veja `access-control/__test__`.

O Jest deste projeto executa CommonJS. `uuid` é ESM-only; um transform restrito a
esse pacote transpila sua implementação real com TypeScript. Não há mock de UUID,
nem alteração das dependências ou do formato de build da aplicação.
