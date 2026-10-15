# Classificação sobre todo o Acervo

F2-CLASS-ALL / tribusca-control#114. A seção de Classificação automática informa que o conjunto contém todas as publicações visíveis no Acervo, incluindo DOU e DOE-SP. Não oferece configuração de exclusões por fonte. Novas publicações entram nesse conjunto automaticamente; o botão de ativação global continua disponível e a classificação usa a última taxonomia publicada.

Depende do backend radar-fiscal-backend#231 para o contador, a seleção do worker e o pré-requisito NCM compartilharem a visibilidade do Acervo. A interface usa o progresso retornado pelo backend, sem números fixos ou estimativas. Não altera a publicação de taxonomia ou os rascunhos.

Teste de regressão em `src/taxonomy.test.tsx` cobre a seção mesmo recebendo configurações antigas de exclusão: a explicação é de Acervo integral e a interface não oferece a lista editável. Os totais do Acervo podem refletir o cache agregado, enquanto o progresso é recalculado por GET; isso não representa diferença de critérios.
