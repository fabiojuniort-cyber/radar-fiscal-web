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

## Compatibilidade CONFAZ

`confaz-presentation.ts` continua sendo o normalizador/fallback legado para
Ato COTEPE, Ajuste e Protocolo. A introdução de `CONVENIO_ICMS` não muda
esses documentos. Quando outra família for homologada, ela recebe novo ID,
versão, seletor inequívoco, CSS próprio, referências de auditoria e testes.

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
