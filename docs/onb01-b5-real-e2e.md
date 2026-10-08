# ONB-01-B5 — real browser -> Fastify -> disposable PostgreSQL 18

Governance: [#99](https://github.com/fabiojuniort-cyber/tribusca-control/issues/99), parent [#96](https://github.com/fabiojuniort-cyber/tribusca-control/issues/96).

**Status:** Implementação de harness de teste; não constitui evidência de execução ou aprovação. Nenhum deploy, merge, alteração de Railway ou produção.

## Baselines imutáveis

- Backend PR #190, `a42f11bf2b928ce9ec48bf41b8069f998f26af95`.
- Frontend baseline PR #83, `b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a`; the profile-selection correction from `fa21ec4f46943186a2928384ee82ac1f61402f85` is also present in this harness branch.
- After preparation, the runner executes four backend registration suites against this same disposable PG18 before the browser scenario. The registration responses must agree with GET and SQL, including preserved reactivation fields and canonical CNAE descriptions. Results are recorded in `REGISTRATION_TESTS.txt`.
- Código B5 em branch separada `test/onb01-b5-real-browser-pg18-20261008`; não editar heads congelados.

## Segurança

- Executar apenas em PostgreSQL 18 descartável, DB `radar_fiscal_onb01_b5`, servidor local 127.0.0.1; verificações rígidas no runner **antes de migrations**.
- Backend original importado do commit imutável. Sem tokens no repositório/logs. No Actions usar `ONB01_B5_BACKEND_READ_TOKEN` (fine-grained, apenas backend privado, Contents: read). `GITHUB_TOKEN` do frontend NÃO serve como garantia de leitura do backend privado. Se o secret não existir, o workflow falha fechado antes do checkout.
- `outbound-shim.mjs` é carregado **somente** pelo processo Fastify em `NODE_ENV=test`; responde HTTP 503 apenas às chamadas outbound de CNPJ nos hosts oficiais de registro e bloqueia outros fetches externos inesperados. Não altera nem intercepta endpoints internos `/auth`, `/api`, `/public`.
- **Egress do Chromium:** como `auth-session.tsx` tenta `lookupBrasilApiFromBrowser` após 502/503, o spec agora registra antes de navegar uma rota Playwright **apenas para URLs HTTP(S) que não sejam `http://127.0.0.1:4173`**, abortando-as (`blockedbyclient`), e bloqueia service workers. A mesma proteção é instalada no segundo tenant/contexto. Nenhuma resposta `/auth/*`, `/api/*` ou `/public/*` é mockada; o spec exige ao menos uma tentativa BrasilAPI bloqueada e anexa somente origens e contagens, sem CNPJs. **Essa proteção de rota não substitui um firewall/sandbox de rede do sistema operacional**; executar em runner isolado continua obrigatório.
- Fixtures CNAE são sintéticas e inseridas apenas na edição CURRENT criada no PostgreSQL efêmero. CNPJs com dígitos verificadores válidos e usuários `@example.test`. Sem sintéticos em bases reais.

## Uso (opt-in)

**Workflow CI não instalado:** a tentativa de adicionar `.github/workflows/onb01-b5-optin.yml` foi bloqueada pela camada de autorização/segurança da integração GitHub. Não contornar a restrição nem assumir existência de workflow ou run_id. A execução disponível nesta branch é somente o runner opt-in local com repositórios privados já obtidos por um operador autorizado e PostgreSQL 18 descartável. A prova E2E permanece PENDENTE até executar e guardar artifacts, sem mover os PRs ONB.

Para a execução local autônoma, o operador autorizado deve obter ambos os repositórios **privados** (sem torná-los públicos): frontend na branch isolada B5 e backend no SHA imutável sob `backend/`. Pré-requisitos locais: Docker funcional, Node 24, `openssl`, `psql`/`pg_isready` (cliente PostgreSQL), Chromium/Playwright e acesso de leitura aos repositórios. Preparar `npm ci && npm run build` no backend e `npm ci && npx playwright install --with-deps chromium` no frontend. Então executar na raiz do frontend:

```sh
bash scripts/onb01-b5-run-disposable-docker.sh
```

O wrapper cria seu **próprio** PostgreSQL `postgres:18-bookworm` em container com nonce e labels privados da execução, porta dinâmica publicada **somente** em `127.0.0.1`, credenciais sintéticas e URL vinculada à porta publicada. O runner interno exige correspondência exata de **ID + nonce + imagem + labels + versão + banco + porta + ausência de bind mounts** *antes* de migrações. O trap do wrapper destrói o container e seus volumes anônimos após sucesso ou erro. **Não apontar manualmente para containers existentes, PostgreSQL local do operador, Railway ou um túnel de produção.** A execução deve ocorrer em WSL2/Linux ou runner descartável de rede controlada. Não publicar passwords, JWTs ou traces não sanitizados.

A chamada direta ao runner inferior só é permitida quando essas garantias de container/nonce já foram provisionadas por um executor confiável; ela **recusa** um banco apenas nomeado como `radar_fiscal_onb01_b5`.

### Requisitos para executar com segurança

- Os dois repositórios privados devem ser clonados por **um operador já autorizado**; no computador local, isso não exige um novo token cross-repo de CI.
- O wrapper exige **daemon Docker local via Unix socket** (WSL2/Linux); contextos remotos/SSH/TCP são recusados. Banco é criado em container nomeado e rotulado para esta execução, com porta de PostgreSQL escolhida pelo Docker no loopback.
- O runner testa que **127.0.0.1:3000 e 127.0.0.1:4173 estão livres** antes de subir Fastify/Vite; Playwright é executado com `CI=1` para **não reutilizar** um servidor Vite já existente.
- As URLs e senhas de PostgreSQL, senhas do runtime e segredo JWT são **gerados automaticamente por execução**; não copiar credenciais de outros ambientes. O nome esperado do banco é `radar_fiscal_onb01_b5`.
- Um resultado `FAILURE` no CI do PR draft reflete o gate `draft-fast-only`: **não é teste real E2E**. Não promover a PR a ready ou rodar full regression apenas para mascarar essa falta.

## Evidência exigida e limitações

Teste real `e2e/onb01-b5.real.spec.ts` cobre:
1. Signup e consentimento no browser -> auth real -> login/token.
2. UI Empresas -> CNPJ sintético -> `/companies/from-cnpj` real responde 503 gerado pelo outbound shim no backend.
3. Modal manual -> pesquisa catálogo `CURRENT` real -> CNAE oficial sintético `6201501` -> POST real e navegação Perfil Tributário.
4. API `/account` autenticada, tentativa de CNAE fictício `9999999` retornando 400.
5. Segundo usuário/tenant em contexto Chromium independente -> cross-tenant 403.
6. SELECT real via psql antes/depois: usuário, tenant, matriz, estabelecimento, vínculo CNAE, raiz de CNPJ, descrição global preservada, CNAE inválido ausente e segundo tenant sem empresa.
7. Playwright report, `HEADS.txt`, contagens por origem externa abortada e verificações SQL guardados como evidência sanitizada. **Traces Playwright brutos podem incluir cookies, JWTs e corpo das requisições: não publicar traces nem `backend.log` sem revisão e sanitização.**

**Limitações:** provedor CNPJ é simulado somente no outbound; não é um teste da disponibilidade real BrasilAPI/Sintegra; só um viewport desktop; não cobre carga/concurrency, dados antigos de produção ou o bloco 2. O runner precisa de credencial read-only entre repositórios e de execução manual efetiva. O revisor independente R3 deve confrontar SHA, run_id, logs e SQL; o executor não atribui PASS.

## Continuidade no Windows / hardening de preparação

No Windows, instalar primeiro Docker Desktop com WSL2 e uma distribuição Linux com integração Docker habilitada. Node.js 24, Git, `openssl`, `curl`, cliente PostgreSQL (`psql`/`pg_isready`) e Chromium/Playwright devem estar disponíveis **dentro do Linux**. O instalador PostgreSQL do Windows não substitui esses clientes Linux. Usar checkouts e `npm ci` próprios do Linux; não reutilizar `node_modules` compilado no Windows. Os scripts B5 são versionados com LF. O daemon via named pipe do Windows continua recusado; não remover a guarda Unix socket.

Para checkouts irmãos, exportar `ONB01_B5_BACKEND_DIR` com o caminho Linux absoluto do backend imutável antes de executar o wrapper. Não é necessário criar token de CI quando o operador já possui acesso Git privado local autorizado.

O wrapper também recusa arquivos dotenv locais e entradas de código/migrations não rastreadas ou ignoradas fora do manifesto Git. Limpa URLs de banco, passwords de runtime, configurações libpq/dotenv e preloads herdados antes do build; somente as credenciais sintéticas criadas pelo runner são fornecidas à aplicação.

Após o runner, verificar **ambos** `RUN_RESULT.txt` e `TEARDOWN.json`: o primeiro indica que a suíte passou, o segundo confirma ausência do container e do volume anônimo. Falha de acesso ao daemon ou teardown não verificável retorna BLOCK/exit 2. INT/TERM seguem o cleanup; SIGKILL/interrupção do sistema requer inspeção posterior pelo operador. Não tratar somente a existência de um relatório antigo como prova de uma execução nova.

O spec reforçado inclui consentimento persistido sem empresa/CNPJ, rollback SQL para o CNPJ rejeitado, POST com header de outro tenant, POST com `companyId` alheio sob o próprio tenant e igualdade do estado SQL antes/depois dessas tentativas (hash dos campos de empresa, estabelecimentos e vínculos CNAE). Essas verificações continuam **não executadas** até uma execução real B5.

`node --test e2e/onb01-b5/runner-safety.unit.mjs` executa cinco testes de subprocesso Bash com CLIs Docker/psql/npm **fictícias**: neutralização de ambiente, dotenv/entrada SQL extra recusados antes do build, cleanup confirmado, daemon indisponível e recurso retido. Nenhum banco/container é criado nesses testes; não constituem B5. No Windows pode ser necessário definir `ONB01_B5_TEST_BASH` para o executável Git Bash. A evidência real fica em diretório próprio por nonce em `playwright-artifacts/onb01-b5/`.
