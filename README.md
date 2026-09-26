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
- portfólio com Acervo, Central de Monitoramento, Sonar, Revela, Decodifica e Perfil Tributário;
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

1. confirmação do Gerente sobre **Acervo e Central de Monitoramento = Disponível**;
2. ratificação de Branding para **Sonar: Alta vermelho / Média amarelo / Baixa verde**;
3. CI verde;
4. revisão visual/funcional.

Sem merge e sem deploy nesta frente.
