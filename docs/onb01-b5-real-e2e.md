# ONB-01-B5 — real browser -> Fastify -> disposable PostgreSQL 18

Governance: [#99](https://github.com/fabiojuniort-cyber/tribusca-control/issues/99), parent [#96](https://github.com/fabiojuniort-cyber/tribusca-control/issues/96).

**Status:** Implementação de harness de teste; não constitui evidência de execução ou aprovação. Nenhum deploy, merge, alteração de Railway ou produção.

## Baselines imutáveis

- Backend PR #190, `532006508aebdb8dd1f384da14b3f7cdcd2a8aa5`.
- Frontend PR #83, `b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a`.
- Código B5 em branch separada `test/onb01-b5-real-browser-pg18-20261008`; não editar heads congelados.

## Segurança

- Executar apenas em PostgreSQL 18 descartável, DB `radar_fiscal_onb01_b5`, servidor local 127.0.0.1; verificações rígidas no runner **antes de migrations**.
- Backend original importado do commit imutável. Sem tokens no repositório/logs. No Actions usar `ONB01_B5_BACKEND_READ_TOKEN` (fine-grained, apenas backend privado, Contents: read). `GITHUB_TOKEN` do frontend NÃO serve como garantia de leitura do backend privado. Se o secret não existir, o workflow falha fechado antes do checkout.
- `outbound-shim.mjs` é carregado **somente** pelo processo Fastify em `NODE_ENV=test`; responde HTTP 503 apenas às chamadas outbound de CNPJ nos hosts oficiais de registro e bloqueia outros fetches externos inesperados. Não altera nem intercepta endpoints internos `/auth`, `/api`, `/public`.
- Fixtures CNAE são sintéticas e inseridas apenas na edição CURRENT criada no PostgreSQL efêmero. CNPJs com dígitos verificadores válidos e usuários `@example.test`. Sem sintéticos em bases reais.

## Uso (opt-in)

Workflow: `.github/workflows/onb01-b5-optin.yml` com `workflow_dispatch`, sem ganchos para PR/push genéricos. GitHub normalmente exige que o workflow exista na branch default para aceitar workflow_dispatch: enquanto proibido o merge, executar localmente com os dois checkouts e PostgreSQL 18 efêmero ou disponibilizar runner de revisão isolado, **sem mover os PRs ONB**. Não afirmar que CI executou enquanto não houver `run_id`.

Para execução local autônoma, preparar PostgreSQL 18 em Docker com DB `radar_fiscal_onb01_b5` e credenciais descartáveis (nunca Railway), clonar frontend na branch isolada e backend no SHA fixo dentro da pasta `backend/`. Fazer `npm ci && npm run build` no backend; `npm ci && npx playwright install --with-deps chromium` no frontend. Exportar:
```sh
export NODE_ENV=test ONB01_B5_RUNNER_MODE=isolated-postgres-service
export DATABASE_ADMIN_URL='postgresql://postgres:postgres@127.0.0.1:5432/radar_fiscal_onb01_b5'
export DATABASE_URL='postgresql://radar_app_runtime:ci-runtime-password-with-at-least-32-chars@127.0.0.1:5432/radar_fiscal_onb01_b5'
export DB_RUNTIME_PASSWORD='ci-runtime-password-with-at-least-32-chars'
export DB_CURATOR_RUNTIME_PASSWORD='ci-curator-password-with-at-least-32-chars'
export JWT_ACCESS_SECRET='ci-jwt-secret-with-at-least-32-characters'
export AUTH_REFRESH_COOKIE_NAME=radar_refresh_token
export PUBLIC_API_ALLOWED_ORIGINS='http://127.0.0.1:4173'
bash scripts/onb01-b5-run-local.sh
```

## Evidência exigida e limitações

Teste real `e2e/onb01-b5.real.spec.ts` cobre:
1. Signup e consentimento no browser -> auth real -> login/token.
2. UI Empresas -> CNPJ sintético -> `/companies/from-cnpj` real responde 503 gerado pelo outbound shim no backend.
3. Modal manual -> pesquisa catálogo `CURRENT` real -> CNAE oficial sintético `6201501` -> POST real e navegação Perfil Tributário.
4. API `/account` autenticada, tentativa de CNAE fictício `9999999` retornando 400.
5. Segundo usuário/tenant em contexto Chromium independente -> cross-tenant 403.
6. SELECT real via psql antes/depois: usuário, tenant, matriz, estabelecimento, vínculo CNAE, raiz de CNPJ, descrição global preservada, CNAE inválido ausente e segundo tenant sem empresa.
7. Playwright traces/logs e `HEADS.txt` guardados no artifact, sem expor passwords/tokens.

**Limitações:** provedor CNPJ é simulado somente no outbound; não é um teste da disponibilidade real BrasilAPI/Sintegra; só um viewport desktop; não cobre carga/concurrency, dados antigos de produção ou o bloco 2. O runner precisa de credencial read-only entre repositórios e de execução manual efetiva. O revisor independente R3 deve confrontar SHA, run_id, logs e SQL; o executor não atribui PASS.
