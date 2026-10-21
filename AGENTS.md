# Codex Harness

## Operação

- Humanos definem objetivo e critérios; agentes implementam e verificam.
- Leia somente a documentação relevante antes de alterar código.
- Preserve a arquitetura, mudanças do usuário e o escopo solicitado.
- Explique antes de editar e use `rg`/`rg --files` para descoberta.

## Mapa do repositório

- Aplicação: `src/`
- Pacotes de negócio: `src/package/<package>`
- Infraestrutura compartilhada: `src/package/shared/module/<module>`
- Exemplo completo: `src/package/example/README.md`
- Rotas de trabalho: `docs/agent-harness/task-routing.md`
- Verificação: `docs/agent-harness/verification.md`
- Padrões de código: `docs/CODING-PATTERNS.md`
- Integrações: `docs/integration-patterns.md`

## Regras essenciais

- Bootstrap apenas compõe; regra de negócio fica no pacote responsável.
- Controller chama service, nunca repository.
- Service não conhece HTTP nem detalhes do TypeORM.
- Repository encapsula queries e pertence ao pacote que possui os dados.
- Valide DTOs na fronteira; não registre segredos ou PII.
- Erros seguem RFC 9457 via `shared/module/problem`: lance `DomainError` com
  `code` estável; nunca responda erro manualmente nem crie filtros por pacote.
  Códigos publicados não mudam.
- Cada pacote e cada módulo compartilhado deve possuir `README.md`.
- Gere migrations com o script do projeto; não escreva SQL manual quando houver gerador.
- Não adicione dependência ou abstração sem necessidade demonstrada.

## Antes de concluir

Escolha a menor verificação que cobre o risco. Alterações TypeScript exigem
build; estrutura exige lint; lógica exige unitários; persistência exige
integração; contrato HTTP exige E2E.
