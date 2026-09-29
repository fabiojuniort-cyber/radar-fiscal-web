# WEB-16 — pré-login alinhado ao pacote de referência

## Origem

A WEB-16 usa o pacote `TriBusca.zip` enviado pelo responsável do produto como referência visual/funcional das páginas públicas:

- Home v2;
- Cobertura;
- Portfólio;
- Como funciona;
- Reforma Tributária.

Os HTMLs servem como referência de composição e linguagem visual; os bundles/scripts do protótipo não são incorporados ao runtime React.

## Decisão de cadastro

Em 28/09/2026 o responsável do produto decidiu manter **Criar conta ativo** nas superfícies pré-login.

O frontend pode abrir o formulário completo de cadastro. O backend atual, porém, ainda não expõe endpoint de signup/register. Portanto a WEB-16 não inventa endpoint nem afirma criação de conta quando o envio não puder ser efetivado.

## Preservações

- `POST /auth/login` permanece o login real;
- pós-login WEB-15 permanece isolado;
- Cobertura continua consumindo somente `GET /public/v1/sources`;
- dados atuais indisponíveis são mostrados como `—`;
- mocks do pacote não são convertidos em dados produtivos;
- estados de produto seguem o estado factual do projeto.

## Estratégia de branch

A WEB-16 é empilhada sobre o SHA validado da WEB-15 enquanto o PR #5 estiver aberto. O PR da WEB-16 deve ter a branch `feat/web-15-post-login-reference` como base para expor somente o delta pré-login.

## Gate

R2: CI verde + revisão independente do SHA exato antes de merge.