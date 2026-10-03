# TriFaros — frontend definitivo

Frontend oficial do TriFaros. A WEB-02 alinha o site público ao design aprovado e mantém o PR #1 em **draft** até os gates de revisão.

Identidade vigente: **TriFaros**, conforme BRAND-02 (tribusca-control#64). TriBusca é a denominação anterior. Nomes de repositório, pacote e identificadores internos legados permanecem por compatibilidade; consulte [BRAND-02](docs/BRAND_02.md).

## Rotas públicas

- `/` — Home
- `/cobertura`
- `/portfolio`
- `/como-funciona`
- `/reforma-tributaria`

O menu público expõe **Cobertura · Portfólio · Como funciona · Reforma Tributária**.

## WEB-02

- header com assinatura horizontal oficial e ação **Entrar**; enquanto a Issue #9 está aberta, cadastro aparece apenas como **Em breve** e não é acionável;
- autenticação pública em modal;
- login usa somente o contrato existente `POST /auth/login`;
- cadastro, recuperação e nova senha permanecem sem ação pública enquanto a Issue #9 estiver aberta; nenhum endpoint fictício é chamado;
- Home com carrossel de 5 UFs, SP fixo em primeiro e 4 sorteadas por carregamento;
- portfólio com Acervo, Central de Monitoramento, Sonar, Revela, Decodifica e Perfil Tributário, **todos marcados como Em desenvolvimento** até comprovação operacional e autorização de publicação;
- Sonar com proximidade + rótulo textual; cores semânticas do draft: Alta vermelho, Média amarelo, Baixa verde;
- Revela com exemplo de boletim diário distinguindo Alta afinidade e Menção direta;
- Decodifica com carrossel de cinco exemplos Texto oficial × Leitura auxiliar;
- Cobertura com serviços federais + 27 UFs integrada a `GET /public/v1/sources`; loading/falha permanecem em `—` e fonte prevista ausente em resposta válida aparece como **Em implantação**;
- Reforma Tributária separa Publicação / Vigência / Marco previsto em lei sem inventar datas;
- `prefers-reduced-motion` respeitado.

## API

A URL-base é configurável por:

```bash
VITE_API_BASE=https://api.exemplo.com
```

Sem `VITE_API_BASE`, o frontend usa a mesma origem. Com a variável configurada, login e API pública usam essa base.

O backend atual usa refresh cookie `SameSite=Strict`, portanto a arquitetura produtiva deve preferir mesma origem/site ou proxy apropriado para preservar o fluxo de sessão. O access token retornado pelo login **não é persistido em localStorage** nesta frente.

Contratos ainda necessários:
- criar conta;
- solicitar recuperação de senha;
- definir nova senha.

A Cobertura usa o contrato público D-050 já existente.

## AUTH-02 — cadastro público real (branch)

A branch `feat/auth-02-public-signup` conecta a experiência de **Criar conta** ao contrato backend real `POST /auth/register`.

- envia nome, e-mail, empresa, CNPJ opcional, senha/confirmação e aceite;
- mantém a política de senha já exibida na UI;
- só mostra sucesso após HTTP 201 confirmado;
- em sucesso, abre o login com o e-mail recém-criado preenchido;
- trata e-mail já cadastrado, senha/dados inválidos, rate limit, falha de rede e erro inesperado;
- não persiste JWT em `localStorage`;
- não altera `/painel`, `/painel-demo`, refresh HttpOnly ou o contrato atual de login/logout;
- confirmação de e-mail permanece evolução futura; nenhum endpoint fictício foi criado.

Este trabalho é R3 / Issue `tribusca-control#37` e **não pode ser mergeado ou publicado antes de revisão independente**.

## Stack

React + TypeScript + Vite + React Router + TanStack Query + Tailwind CSS + Radix UI, com componentes compatíveis com a direção shadcn/ui e ícones Lucide.

## Desenvolvimento

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Governança

- Issue: https://github.com/fabiojuniort-cyber/tribusca-control/issues/8
- Registro WEB-02: `tribusca-control/docs/WEB_02_DESIGN_ALIGNMENT.md`
- Produto: https://github.com/fabiojuniort-cyber/tribusca-control/issues/7
- Manual de Marca: `tribusca-control/docs/BRAND_MANUAL_V1.md`

### Gates antes de merge

1. revisão independente do release candidate WEB-11;
2. Issue #10 permanece **CLOSED/COMPLETED**;
3. Issue #9 continua aberta, mas D-054 já está aplicada ao release candidate;
4. CORS do backend precisa incluir a origem pública efetiva antes de a Cobertura poder exibir dados reais no navegador.

Sem merge e sem publicação definitiva nesta frente.


## WEB-05

Correções aplicadas após a revisão independente WEB-04:

- alvos do carrossel ≥24px, foco visível e indicadores com contraste suficiente;
- regras de senha e limites de input corrigidos para WCAG;
- Sonar: Alta `#C92A2A`, Média `#9A6900`, Baixa texto `#237032` e ping `#2B8A3E`; exceção restrita ao Sonar;
- footer usa a assinatura oficial para fundo escuro, sem filtros CSS;
- Inter é self-hosted via `@fontsource/inter@5.3.0`, pesos 400/700/800/900;
- licença: `docs/THIRD_PARTY_NOTICES.md`.

O ambiente WEB-05, quando ativo, é apenas um **preview temporário de revisão do draft**. Não representa publicação definitiva. A Issue #9 continua sendo gate para ativar cadastro, recuperação e nova senha.


## WEB-07

A WEB-07 corrige o bloqueio BRAND-SONAR-01 e adiciona validação reproduzível em Chromium no CI.

- `.password-rules .rule-ok` usa o azul institucional escuro `var(--navy)` / `#08306B`, contraste aproximado **12,76:1** em branco;
- os quatro valores ratificados do Sonar permanecem inalterados e são verificados para não vazar a outros componentes;
- Playwright executa o build local do mesmo commit do PR nos viewports:
  - 1440×900;
  - 1920×1080;
  - 390×844;
  - 360×800;
- cobre as cinco rotas públicas, overflow horizontal, menu mobile, carrossel, Tab/Shift+Tab, foco visível, abertura/contenção/Escape/retorno de foco dos modais, estados de senha/input, Inter, footer, Sonar, claims públicos, Cobertura e `prefers-reduced-motion`;
- screenshots, traces de falha, relatório HTML e metadados de head/runtime/viewports são publicados como artifact do GitHub Actions por 14 dias.

O teste browser usa **Chromium + Vite preview local do build do próprio runner**, não o domínio Railway. O preview Railway é atualizado separadamente para o mesmo head e continua sendo o alvo de inspeção independente humana.

Sem merge e sem publicação definitiva.


## WEB-11 — release candidate

WEB-11 transforma o draft aprovado na WEB-10 em release candidate:

- aplica D-054 enquanto a Issue #9 estiver aberta:
  - nenhum CTA público ativo de `Criar conta`;
  - header, mobile, hero e modal informam `Cadastro em breve`;
  - claim de trial de 7 dias removido;
  - recuperação de senha pública substituída por `Recuperação de senha em breve`;
  - código interno dos fluxos futuros permanece sem superfície pública e sem endpoint fictício;
- preserva o login real `POST /auth/login`, `credentials: include`, `VITE_API_BASE` e fallback same-origin; nenhum token é persistido em `localStorage`;
- integra a página Cobertura somente com `GET /public/v1/sources` via TanStack Query;
- federais são relacionados por `code` estável; estaduais priorizam `jurisdictionLevel=STATE` + `uf`;
- usa `lastSuccessAt`, `importedToday` e `totalPublications`;
- não usa `lastAttemptAt` como última atualização;
- traduz a apresentação sem alterar o status backend:
  - `ONLINE → Online`;
  - `UNSTABLE/UNAVAILABLE → Em validação`;
  - `NOT_CONSULTED → Em implantação`;
- loading, refetch e erro não reutilizam dados como atuais: mostram `—`;
- fonte prevista ausente de uma resposta válida fica `Em implantação`.

### CORS

Base backend conhecida:
`https://radar-fiscal-backend-production.up.railway.app`

Preview WEB:
`https://web05-preview-production.up.railway.app`

Na inspeção read-only da WEB-11, `PUBLIC_API_ALLOWED_ORIGINS` não estava configurada no serviço backend. Portanto o preview cross-origin pode compilar/deployar corretamente, mas a API pública será bloqueada pelo browser até que essa origem seja autorizada em gate separado de backend/deploy.

WEB-11 não altera backend, SQL, migrations, D-053 ou Issue #10.
