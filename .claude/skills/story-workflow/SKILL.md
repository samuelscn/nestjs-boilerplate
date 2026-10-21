---
name: story-workflow
description: Trunk-based flow for every Linear story - branch from main named after the issue, Conventional commits, push and a PR opened by the bot account so the code owner is asked to review. Use when starting work on a Linear issue (ID like GIN-42, a Linear link or "história"), creating a branch, committing, or opening a PR/MR.
---

# Fluxo de história (Linear + Trunk-Based Development)

`main` é o tronco: sempre verde e implantável. **1 história do Linear = 1 branch curta = 1 PR = 1 commit squash na `main`.** Setup único (MCP, bot, ruleset): `docs/workflow.md`.

## 1. Início

1. Leia a issue pelo MCP do Linear: título, descrição, critérios de aceite e ID (`<TIME>-<n>`). Sem MCP ou sem ID: peça o ID; não invente nem trabalhe sem issue.
2. Mova a issue para **In Progress** (atribuída a quem pediu, se estiver sem dono).
3. Branch a partir do tronco atualizado; árvore suja ou branch já existente → pare e relate:
   `git switch main && git pull --ff-only && git switch -c <tipo>/<ID>-<slug>`
   - `tipo`: feat, fix, refactor, perf, docs, test, chore (Conventional Commits).
   - ID como no Linear, slug curto kebab-case sem acento: `feat/GIN-42-lista-usuarios-mobile`. O ID no nome liga branch e PR à issue.

## 2. Desenvolvimento

- Branch vive no máximo ~2 dias. História maior: proponha sub-issues no Linear em vez de acumular.
- Trabalho incompleto que precisa entrar: atrás de feature flag (skill `add-feature-flag`), nunca branch longa.
- Commits Conventional em português (`feat(users): ...`), com o rodapé de coautoria. Use as skills do repo para cada tipo de tarefa.
- Antes do PR: `git fetch origin && git rebase origin/main` e os checks do repo verdes (`AGENTS.md`). Não abra PR com falha conhecida.

## 3. Pull request

O dono definiu este fluxo: faça push e abra o PR sem pedir confirmação. Nunca faça merge.

1. `git push -u origin <branch>`.
2. Abra pela **conta bot** (PR do próprio dono não gera pedido de revisão do CODEOWNERS):
   `GH_TOKEN="$GINGA_BOT_TOKEN" gh pr create --base main --head <branch> --title "<título>" --body-file <arquivo>`
   - Título = commit squash na `main`: `<tipo>(<escopo>): <resumo> [<ID>]`, até 72 caracteres.
   - Corpo: `.github/pull_request_template.md` preenchido, `Closes <ID>` no topo (o Linear fecha a issue no merge) e no fim `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - Sem `gh` ou sem `GINGA_BOT_TOKEN`: **não** abra com a conta do dono; faça o push e entregue `https://github.com/<owner>/<repo>/compare/main...<branch>` com título e corpo prontos.
3. Issue para **In Review** com o link do PR em comentário (se a integração GitHub do Linear já não tiver feito).
4. Relate: link do PR, checks rodados localmente e o que não foi verificado.

## 4. Revisão e merge

- Ajustes pedidos: novos commits na mesma branch; não reescreva o que já foi revisado. CI vermelho: corrija na branch.
- Merge é do dono (squash). Depois: `git switch main && git pull --ff-only && git branch -d <branch>`.
- Nunca: push direto ou force-push na `main`, aprovar o próprio PR, contornar checks.
