# Contribuindo

Crie mudanças pequenas, com motivação explícita e testes proporcionais ao risco.

1. Instale dependências com `npm ci`.
2. Crie uma branch curta.
3. Implemente dentro do pacote dono da responsabilidade.
4. Execute `npm run check` e as suítes adicionais relevantes.
5. Abra a MR usando o template do repositório.

O hook Husky é instalado pelo script `prepare`. Ele executa lint e testes
unitários. Integração e E2E ficam fora do pre-commit porque sobem containers;
devem rodar na MR/CI quando a mudança tocar persistência ou HTTP.
