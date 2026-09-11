# NestJS Modular Boilerplate

Base reutilizável para APIs NestJS com monólito modular, TypeORM, PostgreSQL,
logs estruturados, Docker e testes por camada.

## Início rápido

Pré-requisitos: Node.js 24+, npm 11+ e Docker.

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run migration:run
npm run start:dev
```

A API de exemplo oferece `POST /examples` e `GET /examples`.

## Estrutura

```text
src/
├── app.module.ts             # composição da aplicação
├── main.ts                   # bootstrap e concerns globais
└── package/
    ├── example/              # pacote de referência substituível
    │   ├── core/             # casos de uso e regras
    │   ├── http/             # controllers e DTOs
    │   ├── persistence/      # TypeORM, repositories e migrations
    │   └── __test__/         # unit, integration e e2e
    └── shared/module/        # infraestrutura sem regra de negócio
```

Cada pacote possui um README local. Comece por
[`src/package/example/README.md`](src/package/example/README.md) e consulte
[`docs/CODING-PATTERNS.md`](docs/CODING-PATTERNS.md) antes de criar um módulo.

## Comandos

| Comando                      | Finalidade                          |
| ---------------------------- | ----------------------------------- |
| `npm run start:dev`          | desenvolvimento com reload          |
| `npm run lint`               | ESLint e regras arquiteturais       |
| `npm run build`              | compilação TypeScript/Nest          |
| `npm run test:unit`          | regras isoladas e rápidas           |
| `npm run test:integration`   | TypeORM com PostgreSQL real         |
| `npm run test:e2e`           | contrato HTTP completo              |
| `npm run check`              | lint, build e testes unitários      |
| `npm run security:audit`     | exige zero vulnerabilidades         |
| `npm run migration:generate` | gera migration do pacote de exemplo |
| `npm run migration:run`      | aplica migrations                   |

Testes de integração e E2E criam seu próprio PostgreSQL com Testcontainers;
não dependem do banco local. Veja [`jest/README.md`](jest/README.md).

## Usando como boilerplate

1. Renomeie `example` para o primeiro contexto de negócio.
2. Atualize o nome da classe, conexão, tabela e scripts de migration.
3. Registre o novo módulo em `app.module.ts`.
4. Preserve as fronteiras demonstradas no exemplo.
5. Execute `npm run check` e a suíte de banco/HTTP pertinente.

Não copie autenticação, filas ou clientes externos para a base antes de o
produto precisar deles. Integrações opcionais devem entrar como adapters.

## Colaboração

- Hooks: Husky roda lint e unitários antes do commit.
- Merge requests: `.gitlab/merge_request_templates/Default.md`.
- Agentes: `AGENTS.md` é o mapa de execução e `docs/agent-harness/` contém os detalhes.
- Contribuição humana: `CONTRIBUTING.md`.
- Docker: `docs/docker.md`.
- CI: `.gitlab-ci.yml` verifica cada MR.
- GitHub Actions: `docs/github-actions.md` descreve os checks obrigatórios.
