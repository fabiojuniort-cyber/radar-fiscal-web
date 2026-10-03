# Padrões visuais de dispositivos legais

## Objetivo

O leitor interno aplica um contrato visual compartilhado por família jurídica.
O contrato pertence ao frontend e não é copiado para cada publicação. Assim,
uma correção aprovada no padrão passa a valer para todos os documentos daquela
família na próxima renderização, sem alterar o conteúdo ou criar uma nova
versão jurídica.

A seleção fica centralizada em `src/legal-presentation.ts`. Tipos ainda não
homologados continuam no fallback existente.

## Regras de segurança e fidelidade

- `SANITIZED_HTML` é o único HTML aceito no caminho de HTML; a sanitização
  continua sendo responsabilidade do backend.
- `PRESERVED_TEXT` continua texto e não é interpretado como marcação.
- O tipo do ato escolhe a família. Órgão/origem CONFAZ, sozinhos, não podem
  transformar Ato COTEPE, Ajuste SINIEF ou Protocolo em Convênio ICMS.
- Classes/estrutura oficiais preservadas têm precedência sobre inferência.
- Inferência visual é identificada por `data-inferred-structure`.
- Cor é papel de apresentação da fonte, não situação jurídica. O frontend não
  infere vigência, revogação ou efeito legal a partir de vermelho/verde/preto.
- Versão visual do template é independente da versão/hash do conteúdo.
- Inteligência TriBusca permanece fora do corpo oficial.

## CONVENIO_ICMS — versão 1.0.0

Referências de homologação inicial definidas pelo Product Owner:

1. Convênio ICMS 114/2026 — ato atual/simples;
2. Convênio ICMS 22/02 — estrutura antiga com anexo;
3. Convênio ICMS 100/97 — consolidado histórico extenso.

Referências oficiais:

- https://www.confaz.fazenda.gov.br/legislacao/convenios/2002/CV022_02
- https://www.confaz.fazenda.gov.br/legislacao/convenios/1997/CV100_97

O template usa variantes estruturais, nunca ano, número ou ID da publicação:

| Variante | Sinal | Papel |
| --- | --- | --- |
| `standard` | caso normal | composição de ato atual/simples |
| `annex-structured` | tabela + cabeçalho isolado de cláusula + ausência de classe oficial `Ementa` | preserva composição de anexo e ementa em largura integral |
| `consolidated` | classes de remissão/redação histórica | histórico vermelho/verde, links e recuos da fonte |
| `preserved-text` | conteúdo recebido como texto | degradação fiel, sem inferência de HTML |

O predicado `annex-structured` é uma heurística de apresentação baseada na
referência visual do 22/02. Ele deve ser revalidado quando houver fixture do
HTML sanitizado real; tabela isolada não seleciona a variante.

O CSS canônico fica em `src/convenio-icms-presentation.css`. Mudanças
aprovadas pelo Product Owner devem ser feitas nesse arquivo e acompanhadas de
teste de regressão, em vez de criar exceções por publicationId.

## ATO_COTEPE_ICMS — versão 1.0.0

Referências de homologação inicial fornecidas pelo Product Owner:

1. ATO COTEPE/ICMS nº 100/2026 — composição moderna com Anexo Único/tabela;
2. ATO COTEPE/ICMS 68/19 — composição moderna textual;
3. ATO COTEPE/ICM nº 05/87 — apresentação histórica declaratória.

O template é selecionado exclusivamente pelos tipos normalizados
\`ATO_COTEPE_ICMS\` e \`ATO_COTEPE_ICM\`. O alias histórico ICM preserva a
grafia original do conteúdo; não reescreve a identidade jurídica.

Variantes:

| Variante | Sinal estrutural | Papel |
| --- | --- | --- |
| \`standard\` | ato moderno sem tabela | título, DOU, ementa à direita, texto e artigos |
| \`annex-structured\` | tabela HTML real | preserva anexo/tabulação sem reconstruir grade a partir de texto |
| \`historical-declaration\` | cabeçalho ICM e/ou \`DECLARA\` isolado | composição histórica com DOU preto junto ao título e ementa integral |
| \`preserved-text\` | conteúdo recebido como texto | degradação segura, sem interpretar texto como HTML |

A marcação local distingue cabeçalhos de UF de anexos modernos (por exemplo
\`SÃO PAULO\`, centralizado) de \`.TabelaTitulo\` legado (por exemplo
\`Unidade Federada: SÃO PAULO\`, mantido à esquerda). A regra compartilhada
do fallback CONFAZ não é alterada.

Na apresentação histórica, uma nota \`(DOU ...)\` já presente junto ao título
impede síntese de uma segunda nota de publicação. \`DECLARA\` e o DOU inline
são tratados apenas dentro deste template, sem ampliar o normalizador global.

## AJUSTE_SINIEF — versão 1.0.0

Referências de homologação inicial fornecidas pelo Product Owner:

1. Ajuste SINIEF nº 33/2026 — composição moderna;
2. Ajuste SINIEF 01/19 — consolidado com histórico de redações;
3. Ajuste SINIEF nº 28/2024 — composição moderna.

O template é selecionado pelo tipo `AJUSTE_SINIEF` (incluindo a forma
estruturada com número no actType), nunca por menção no corpo do ato.

| Variante | Sinal estrutural | Papel |
| --- | --- | --- |
| `standard` | ausência de redações históricas fortes | título, notas editoriais, ementa à direita e cláusulas |
| `consolidated` | classes de redação anterior/original (`RemissoAnt`/`RedaoAnt` e aliases) | mantém redação vigente e histórica expandida |
| `preserved-text` | conteúdo recebido como texto | degradação segura, sem interpretar marcação |

Uma simples remissão vermelha (`Remisso`) ou várias notas editoriais no topo
não tornam o ato consolidado. A nota histórica `Exclusão de ...` observada na
referência 01/19 é protegida localmente durante a inferência para não ocupar o
papel da ementa; o texto e links originais são reinseridos na mesma posição.

Links normais e visitados usam a mesma cor canônica do padrão. As diferenças
magenta vistas em navegação local são estado do navegador, não papel jurídico.
Da mesma forma, vermelho/verde reproduzem edição da fonte e nunca inferem
vigência ou status.

## ATO_COTEPE_PMPF — versão 1.0.0

Referência inicial de homologação: ATO COTEPE/PMPF nº 26, de 24 de
setembro de 2026, confrontado com a publicação oficial do CONFAZ.

O template é selecionado exclusivamente pelo tipo `ATO COTEPE/PMPF`. Ele não
altera `ATO COTEPE/ICMS`. Quando a apresentação oficial já contém
`<table>`, a estrutura é preservada e apenas recebe o contrato visual da
família.

Capturas legadas anteriores à preservação de HTML do DOU podem ter a tabela
achatada em texto. Nesse caso, a projeção visual só reconstrói a grade quando
encontra o cabeçalho PMPF e valida a sequência completa de 27 itens/UFs
(1 AC ... 27 TO), com exatamente seis valores por linha. Se qualquer elemento
não fechar, a tabela não é inventada e o texto permanece no fallback da
família. Todo conteúdo é criado por nós de texto do DOM; `PRESERVED_TEXT`
nunca é interpretado como HTML de origem.

A variante `pmpf-table` identifica a grade preservada ou restaurada. O
template também remove a linha editorial “Secretaria Executiva” somente no
caso legado em que ela ficou colada imediatamente ao título
`ATO COTEPE/PMPF`.

As regras CSS ficam isoladas por
`data-legal-template='ATO_COTEPE_PMPF'` em
`src/publication-detail-page.css`. Tabelas largas rolam dentro do próprio
bloco, sem criar overflow na página.

## Compatibilidade CONFAZ

`confaz-presentation.ts` continua sendo o normalizador compartilhado e o
fallback legado para famílias ainda não homologadas. Convênio ICMS, Ato
COTEPE/ICMS, Ato COTEPE/PMPF e Ajuste SINIEF usam templates próprios.
Protocolo ICMS será promovido em sua PR própria; tipos COTEPE não homologados
continuam no fallback. Cada nova família recebe ID, versão, seletor inequívoco,
CSS próprio, referências de auditoria e testes.

## Auditoria de uma alteração do padrão

1. alterar o template compartilhado, nunca uma publicação individual;
2. exercitar pelo menos um fixture de cada variante afetada;
3. rodar typecheck, testes, build e Playwright aplicável;
4. comparar visualmente com a fonte/referência aprovada;
5. revisar se texto, links, ordem, `rowspan`/`colspan` e conteúdo histórico
   continuam intactos;
6. incrementar a versão do template quando a mudança visual homologada for
   relevante para auditoria;
7. incorporar somente após os gates da Issue correspondente.

Uma mudança apenas visual não altera `content_hash`, data, vigência ou
versionamento da publicação.
