# BRAND-02 — identidade TriFaros

## Governança

Implementação vinculada a fabiojuniort-cyber/tribusca-control#64. Esta frente sucede a identidade comercial TriBusca para a apresentação atual do produto. Decisões, evidências e ativos históricos permanecem preservados. A alteração não dispensa revisão independente, CI, PR ou gates de publicação.

## Nome e significado

Grafia oficial: **TriFaros**, com T e F maiúsculos. “Tri” remete ao território tributário; “Faros” remete a Pharos, o Farol de Alexandria. A Biblioteca de Alexandria inspira o acervo organizado, a pesquisa e a preservação do conhecimento. Essas referências são simbólicas, não uma alegação de vínculo institucional.

Descriptor: **Monitoramento e Inteligência Tributária**.

Território verbal preservado: **Encontre o que importa no meio do ruído.**

## Assinatura oficial no produto

O master aprovado pelo Product Owner em 03/10/2026 é a fonte de verdade para a assinatura TriFaros: `public/brand/trifaros-logo-horizontal.png`, PNG RGBA 2048×682.

SHA-256: `a9e4dab1392861c1927629bd181a60c462c32514e9427cc2ef8e3da0e2a64b4f`.

O master já contém símbolo, farol, livro, feixe de luz e wordmark. Não reconstruir o wordmark com fonte, não redesenhar a silhueta, não espelhar, não recolorir por filtro CSS e não adicionar efeitos ao PNG. O componente compartilhado `BrandMark` apenas dimensiona o master e fornece o nome acessível.

Sobre superfícies claras, usar o PNG transparente diretamente. Sobre superfícies escuras, o produto pode usar uma placa clara neutra atrás do mesmo master para preservar a assinatura sem alterar seus pixels.

O arquivo `public/brand/trifaros-icon.png` foi preservado como artefato anterior desta frente, mas não é a fonte de verdade da assinatura oficial e não deve substituir o master horizontal sem nova aprovação.

## Direção visual

Preservar a paleta: navy #08306B, azul #0057FF, ciano #00D4FF, teal #00E6D6 e azul-claro #E6F4FF. Navy estrutura a interface; a luz teal é um acento, não fundo indiscriminado de texto. Estados semânticos existentes não mudam nesta frente.

Farol e biblioteca aparecem com sobriedade: feixes discretos, alinhamento arquitetônico, estrutura editorial e acervo legível. Evitar cenários épicos, excesso de colunas/arcos, livros decorativos e ornamentos por trás de texto legal. Evidência, fonte oficial e dados reais continuam protagonistas.

## Compatibilidade preservada

A marca pública muda; contratos e históricos não. Permanecem `tribusca.panel.state`, `tribusca.archive.date`, `tribusca.curation.justification`, `tribusca.taxonomy.curated`, classe `is-tribusca`, animações `tribuscaRadarSweep`/`tribuscaRadarBlip`, pacote `tribusca-web`, slugs/hosts de fixtures, nomes reais dos repositórios e serviços.

Na tabela, o rótulo é “Código TriFaros”; o cabeçalho de importação/exportação continua sendo “Código TriBusca” até uma mudança de contrato própria. Não transformar payloads recebidos da API para apagar nomes históricos, conteúdo editorial ou denominações reais de contas.

O rebrand não modifica atos oficiais, HTML jurídico, formatter CONFAZ, datas, cláusulas, contratos de API, consentimento ou backend. Termos e privacidade versionados preservam a denominação da versão publicada, acompanhados por uma nota de transição de marca.

## Verificação

O teste de integridade do PNG valida dimensões, estrutura, CRC/IEND e SHA-256 do master oficial. Manter também testes de truncamento/corrupção dos PNGs legados enquanto esses ativos permanecerem no repositório.

Validar typecheck, unitários, build, browser e acessibilidade. Verificar nome acessível, proporção, contraste, mobile e ausência de referências ativas aos logos antigos. Ocorrências de TriBusca são aceitas apenas quando forem legadas, históricas, jurídicas ou parte de dados recebidos da API.
