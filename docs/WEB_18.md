# WEB-18 — alinhamento do site público ao design de trabalho

## Objetivo

Alinhar a experiência pública real da TriBusca ao design de trabalho validado pelo Product Owner, preservando contratos, autenticação, rotas, dados factuais e decisões já congeladas.

## Escopo implementado

- Home
  - “Agora no radar” no layout do design, sem inventar publicações;
  - carrossel estadual com pills de UF, pausa/reprodução, crédito fotográfico, link para Cobertura e rodapé explicativo;
  - status “Verificando…” durante o loading da cobertura federal;
  - ordem visual dos cards do Portfólio;
  - controles e progresso da Norma Clara;
  - selo de exemplo ilustrativo na relevância;
  - CTA com legenda sob as ações.
- Portfólio
  - hero atualizado;
  - barra de âncoras dos seis recursos;
  - textos detalhados;
  - estados visuais do Decodifica;
  - CTA sem botão “Entrar”.
- Cobertura
  - prefixo “Coleta” nos estados dos cards;
  - copies do design;
  - mensagem de indisponibilidade sem confundir falha de fonte com ausência de publicações.
- Como funciona
  - textos dos passos alinhados;
  - copy e selo de relevância;
  - transparência factual/Inteligência TriBusca/IA.
- Reforma Tributária
  - hero, linha do tempo e nota alinhados ao design;
  - dois documentos técnicos acrescentados à lista ilustrativa.

## Decisões preservadas

- `GET /public/v1/sources` continua sendo o contrato real de cobertura pública.
- Sem contrato público aprovado de publicações, o site mantém placeholders `—` e não inventa “últimas publicações”.
- Cadastro, login e recuperação permanecem na implementação real de `App.tsx`.
- `Acervo` e `Central de Monitoramento` continuam como **Em desenvolvimento**. O protótipo que os marcava como “Disponível” não foi promovido a verdade do produto.
- Termos e Privacidade continuam como links reais.
- `prefers-reduced-motion` interrompe autoplay por padrão; reprodução só inicia após ação explícita do usuário.

## Autorização de publicação

Em 30/09/2026 o Product Owner autorizou que ajustes validados desta frente sejam publicados incrementalmente para revisão visual no próprio site.

Isso substitui, para esta frente visual, a contenção anterior de manter o trabalho indefinidamente fora da branch publicada. O fluxo continua exigindo validação automatizada antes do merge/deploy.

## Validação obrigatória antes da publicação

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e` nos quatro viewports configurados
- ausência de overflow horizontal nas rotas públicas
- confirmação do deploy Railway e do SHA implantado

## Diferenças aceitas entre design e implementação

1. Termos de Uso e Política de Privacidade permanecem links ativos, apesar de o design antigo dizer “em elaboração”.
2. Acervo e Central permanecem “Em desenvolvimento” até comprovação operacional.
3. O protótipo contém composições e mocks; o runtime usa apenas contratos e estados reais.
4. Dados de publicações públicas continuam em placeholder enquanto não houver endpoint público aprovado.
