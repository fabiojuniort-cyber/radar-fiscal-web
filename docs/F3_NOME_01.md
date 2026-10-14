# F3-NOME-01 — integração do Nome do ato

Governança: tribusca-control#108. Base: afafa1e17b87cd899cd2ff42ff1271ac5241aedb.

O backend fornece o Nome do ato. Removidos o extrator local e os rádios de prefixos da amostra do #109. Classificar apresenta um campo editável preenchido com `act_name`, e a contagem da fila é a contagem integral de publicações do grupo devolvida pelo backend. Tipos, termos, variações de grafia, prévias e reaplicação exibem os nomes do mesmo contrato; não há uma segunda implementação da normalização no web.

`state.actNames` alimenta as opções de Nome do ato, sem buscar tipos oficiais no catálogo para esse fim. As identidades persistidas das regras continuam nos payloads de edição; `actName` é a apresentação calculada pelo backend. Grupos `queue_basis=ARCHIVE_ACT_NAME` têm ID somente de apresentação: o web não envia o ID sintético como `newTypeId`; classifica por regra e mescla via ALIAS_PUT. O modo continua exigindo escolha ao abrir um novo grupo.

Salvar permanece não destrutivo em `/direct-rule/save`; o #111 não foi incorporado ou modificado. Nenhuma consulta de prévia confirma exclusão. Backend deve ser publicado primeiro; antes disso, campos opcionais têm fallback apenas para dados já fornecidos pela API, sem inventar nomes ou contagens.

Sem merge/deploy até OK do COORD no SHA aprovado. Smoke produtivo somente abrir Classificar, consultar prévia e Cancelar; Reaplicar somente prévia e Cancelar. Preservar as proibições de salvar regras, confirmar exclusões, apagar publicações e publicar taxonomia.
