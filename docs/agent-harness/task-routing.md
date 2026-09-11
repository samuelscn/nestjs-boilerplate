# Roteamento de tarefas

## Código de negócio

Leia `docs/CODING-PATTERNS.md` e o README do pacote. Use `example` como referência
de forma, não como domínio a ser copiado literalmente.

## Banco de dados

Leia o README de TypeORM, o README do pacote e a configuração do DataSource.
Gere a migration, revise SQL e rode integração.

## Controller ou contrato HTTP

Leia o README do pacote e `jest/README.md`. Valide DTOs, mantenha o controller
fino e cubra sucesso mais uma falha relevante em E2E.

## Integração externa ou logs

Leia `docs/integration-patterns.md` e o README de logger. Encapsule fornecedor,
timeout, autenticação e tradução de erro no adapter.

## Estrutura/arquitetura

Leia `docs/CODING-PATTERNS.md` e `scripts/check-structure.mjs`. Atualize a regra
mecânica quando uma convenção obrigatória mudar.

## Testes

Leia `jest/README.md`. Escolha a camada pelo risco; não replique a mesma asserção
em todas as suítes.
