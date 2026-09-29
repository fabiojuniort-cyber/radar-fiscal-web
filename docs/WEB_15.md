# WEB-15 — painel pós-login alinhado ao HTML de referência

## Origem

A WEB-15 parte do artefato `TriBusca Pos-Login (offline).html` fornecido pelo responsável do produto em 28/09/2026 como referência visual e funcional do ambiente pós-login.

O artefato foi usado como referência de composição e linguagem visual. O bundle offline não é executado nem incorporado ao frontend de produção.

## Escopo

- `/painel`: painel autenticado real, preservando os contratos de autenticação existentes.
- `/painel-demo`: mesma linguagem visual, mantendo o isolamento do modo demonstração.
- shell com identidade TriBusca, seletor de empresa/estabelecimento, busca global, conta, usuário e navegação horizontal;
- superfícies: Início, Publicações, Acervo, Reforma Tributária, Central de Monitoramento, Fontes Oficiais, Empresas, Estabelecimentos, Perfil Tributário, Configurações e Assinatura;
- adaptação responsiva para desktop, tablet e celular.

## Segurança e dados

A mudança é de experiência visual. Ela não cria endpoints nem altera o contrato de autenticação:

- `POST /auth/login` permanece o login real;
- `/auth/me`, `/auth/refresh` e `/auth/logout` permanecem os contratos de sessão;
- não há token em `localStorage`;
- o painel demo continua sem chamadas autenticadas;
- CNPJ, empresas, estabelecimentos, publicações, afinidades e métricas do protótipo são usados somente em modo demonstração;
- no painel autenticado, campos ainda não integrados são exibidos como `—` ou com estado explícito de integração pendente;
- as chamadas diretas do protótipo a BrasilAPI, Minha Receita e IBGE não são incorporadas.

## Fidelidade visual

A implementação reaproveita a estrutura do produto React atual e reproduz os elementos centrais do protótipo: fundo azul muito claro, cabeçalho branco, azul marinho institucional, azul de ação, ciano, navegação por abas, cartões, busca no Acervo, listas de publicações, trilha da Reforma Tributária e estados operacionais das fontes.

## Gate

Mudança classificada como R2. Merge somente após CI verde e revisão independente do SHA exato do PR.