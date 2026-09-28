# TriBusca — frontend definitivo

Frontend oficial do TriBusca. A WEB-02 alinha o site público ao design aprovado e mantém o PR #1 em **draft** até os gates de revisão.

## Rotas públicas

- `/` — Home
- `/cobertura`
- `/portfolio`
- `/como-funciona`
- `/reforma-tributaria`

O menu público expõe **Cobertura · Portfólio · Como funciona · Reforma Tributária**.

## WEB-02

- header com assinatura horizontal oficial e ações **Entrar** / **Criar conta**;
- autenticação pública em modal;
- login usa somente o contrato existente `POST /auth/login`;
- cadastro, recuperação e nova senha têm UX definida, porém **não chamam endpoint fictício**;
- validação de senha em tempo real;
- Home com carrossel de 5 UFs, SP fixo em primeiro e 4 sorteadas por carregamento;
- portfólio com Acervo, Central de Monitoramento, Sonar, Revela, Decodifica e Perfil Tributário, **todos marcados como Em desenvolvimento** até comprovação operacional e autorização de publicação;
- Sonar com proximidade + rótulo textual; cores semânticas do draft: Alta vermelho, Média amarelo, Baixa verde;
- Revela com exemplo de boletim diário distinguindo Alta afinidade e Menção direta;
- Decodifica com carrossel de cinco exemplos Texto oficial × Leitura auxiliar;
- Cobertura com serviços federais + 27 UFs; **status e métricas** ficam em `—` até a API pública estar integrada;
- Reforma Tributária separa Publicação / Vigência / Marco previsto em lei sem inventar datas;
- `prefers-reduced-motion` respeitado.

## API

A URL-base é configurável por:

```bash
VITE_API_BASE=https://api.exemplo.com
```

Sem `VITE_API_BASE`, o frontend usa a mesma origem e chama `/auth/login`.

O backend atual usa refresh cookie `SameSite=Strict`, portanto a arquitetura produtiva deve preferir mesma origem/site ou proxy apropriado para preservar o fluxo de sessão. O access token retornado pelo login **não é persistido em localStorage** nesta frente.

Contratos ainda necessários:
- criar conta;
- solicitar recuperação de senha;
- definir nova senha;
- métricas/status dinâmicos da página Cobertura.

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

1. revisão independente final sobre as evidências WEB-07;
2. Issue #10 permanece aberta até esse parecer;
3. Issue #9 continua gate de lançamento do cadastro.

Sem merge e sem deploy nesta frente.


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
