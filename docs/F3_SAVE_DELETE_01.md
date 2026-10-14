# F3-SAVE-DELETE-01

Fábio solicitou em 14/10/2026 que salvar um modo Excluir também exclua o histórico elegível. Governança: https://github.com/fabiojuniort-cyber/tribusca-control/issues/113.

O modal mantém prévia e confirmação explícita em “Salvar e excluir N publicações”. EXCLUDE_ALWAYS e EXCLUDE_UNLESS_STRONG usam /direct-rule/confirm; os modos Manter usam /direct-rule/save. A seleção, avaliação F3, proteção de empresa/match/outra origem, locks e auditoria continuam no backend existente. Nenhum ID de publicação é enviado pelo cliente.

Cada confirmação envia expectedCount, previewToken, confirmationToken e policyRevision. Lotes subsequentes usam uma nova prévia e resume=true sem regravar a regra. Mudança de revisão/contagem, falha HTTP/rede e falta de progresso interrompem o fluxo e exigem nova prévia/ação do usuário. Cancelar/fechar interrompe após o lote em andamento; um lote já confirmado pode terminar. A interface informa a quantidade efetivamente apagada e bloqueia a edição da regra durante a execução/retomada.

Esta mudança não altera backend, migration ou o comando global Apagar fora do escopo. Não executa limpeza automática ao selecionar o modo: o clique explícito para salvar e excluir confirma o efeito mostrado na prévia. Prévia sem capacidade F3 válida continua bloqueada.

Validação local inicial: 15 testes focados PASS (inclui 9 novos testes para ambos modos Excluir, lotes, revisão/contagem divergentes, capacidade inválida no confirm, rede, progresso zero, zero candidatos e cancelamento). CI integral e revisão independente são gates antes de merge. Preparação de código não é evidência de deploy ou de exclusão produtiva.
