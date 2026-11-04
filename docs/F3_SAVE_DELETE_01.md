# F3-SAVE-DELETE-01

Fábio solicitou em 14/10/2026 que salvar um modo Excluir também exclua o histórico elegível. Governança: https://github.com/fabiojuniort-cyber/tribusca-control/issues/113.

O modal mantém prévia e confirmação explícita em “Salvar e excluir N publicações”. EXCLUDE_ALWAYS e EXCLUDE_UNLESS_STRONG usam /direct-rule/confirm; os modos Manter usam /direct-rule/save. A seleção, avaliação F3, proteção de empresa/match/outra origem, locks e auditoria continuam no backend existente. Nenhum ID de publicação é enviado pelo cliente.

Cada confirmação envia expectedCount, previewToken, confirmationToken e policyRevision. Lotes subsequentes usam uma nova prévia e resume=true sem regravar a regra. Mudança de revisão/contagem, falha HTTP/rede e falta de progresso interrompem o fluxo e exigem nova prévia/ação do usuário. Cancelar/fechar interrompe após o lote em andamento; um lote já confirmado pode terminar. A interface informa a quantidade efetivamente apagada e bloqueia a edição da regra durante a execução/retomada.

Esta mudança não altera backend, migration ou o comando global Apagar fora do escopo. Não executa limpeza automática ao selecionar o modo: o clique explícito para salvar e excluir confirma o efeito mostrado na prévia. Prévia sem capacidade F3 válida continua bloqueada.

Validação local inicial: 15 testes focados PASS (inclui 9 novos testes para ambos modos Excluir, lotes, revisão/contagem divergentes, capacidade inválida no confirm, rede, progresso zero, zero candidatos e cancelamento). CI integral e revisão independente são gates antes de merge. Preparação de código não é evidência de deploy ou de exclusão produtiva.


## Retomada Frente 2 — 04/11/2026

Porta o comportamento de web #111 para main 3489453c5f991d02e053a5e9eaec5717cc21b5e3 em branch isolada. Preserva DOE-SP, queueBasis (fila exige escolha explícita do modo), actName, apresentação de amostras e onApplied(saved), sem aguardar refresh de inventário depois de salvar. Nenhum código backend, migration ou operação produtiva incluído. Controle: tribusca-control#124; autorização funcional original: #113. O PR antigo permanece intacto. Revisão independente do novo HEAD obrigatória.

## Validação complementar em 04/11/2026

Aplicação completa montada a partir da main e do delta do PR #141, sem stubs de componentes. Testes locais não-ANAT: 285 PASS; os quatro testes de importação passaram após materializar os bytes originais do JSON de 1,4 MB pelo blob (Contents não fornecia o arquivo). Typecheck/build da aplicação PASS. Browser Firefox: 16/16 casos da grade PASS em 1440, 1920, 390 e 360, incluindo os dois modos Excluir, confirmação explícita, KEEP seguro e rejeição de revisão antiga. Os testes corrigem a escolha KEEP do cenário para usar KEEP_IF_TAX_TERM (KEEP_ALWAYS já é edição direta existente) e aceitam campos extras preservados, como helpText, no payload.

As capturas foram inspecionadas e vinculadas na #113/#124 com o ZIP visual. Dados sintéticos e API interceptada; nenhuma exclusão produtiva. Firefox não substitui o CI integral do GitHub/Chromium: os runs conhecidos terminaram startup_failure antes de criar jobs e a causa detalhada depende de Summary/Annotations da conta autenticada. Sem rerun manual. Revisão independente e integração permanecem gates distintos.

