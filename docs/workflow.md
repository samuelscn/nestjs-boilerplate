# Fluxo de trabalho

Trunk-Based Development com histórias no Linear. O passo a passo diário (para pessoas e agentes) está na skill `.claude/skills/story-workflow/SKILL.md`; este documento é o setup feito uma vez.

## Regras

- `main` é o único tronco: protegida, sempre verde e implantável. Não existe `develop`.
- Toda história do Linear gera uma branch curta `<tipo>/<ID>-<slug>` (ex.: `feat/GIN-42-lista-usuarios-mobile`) e um PR para `main`.
- O PR é aberto pela conta bot; o `CODEOWNERS` pede a revisão do dono; o merge é squash, um commit por história.
- Trabalho incompleto entra atrás de feature flag (skill `add-feature-flag`), não em branch longa.

## Setup único

1. **GitHub CLI**: instale o `gh` (`sudo apt install gh` ou o pacote oficial em cli.github.com).
2. **Linear MCP** (por usuário): `claude mcp add --transport http --scope user linear https://mcp.linear.app/mcp` e autentique com `/mcp` no Claude Code.
3. **Integração GitHub do Linear**: Linear → Settings → Integrations → GitHub, conecte o repositório. Nas automações do time: PR aberto → *In Review*, merge → *Done*. O ID na branch, no título ou `Closes <ID>` no corpo liga o PR à issue.
4. **Conta bot** (ex.: `ginga-bot`, conta de máquina):
   - colaboradora do repositório com permissão *Write*;
   - token **classic** com escopo `repo` (tokens fine-grained só acessam repositórios do próprio dono do token ou de uma organização; vale o fine-grained se o repo estiver em `ginga-software` e o bot for membro);
   - exporte `GINGA_BOT_TOKEN` no ambiente da sua máquina (perfil do shell ou gerenciador de segredos). Nunca em `.env` nem no repositório.
5. **Ruleset da `main`** (Settings → Rules → Rulesets, alvo `main`):
   - exigir pull request com 1 aprovação, revisão de Code Owners e descarte de aprovações antigas a cada novo push;
   - exigir os checks `Quality`, `Database tests` e `Security` (`docs/github-actions.md`) e branch atualizada antes do merge;
   - exigir histórico linear; bloquear force-push e exclusão; sem bypass (ou só o dono, para emergência);
   - em Settings → General: permitir apenas *squash merge* e marcar *Automatically delete head branches*.
6. **CODEOWNERS**: `.github/CODEOWNERS` aponta o revisor padrão. Projetos criados a partir deste template trocam pelo dono/time do projeto.
