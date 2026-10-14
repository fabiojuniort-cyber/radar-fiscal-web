# Reaplicar filtro ao acervo — F3-SIMPL-01

O botão administrativo é `Reaplicar filtro ao acervo`. A prévia mostra uma única linha `X não passam no filtro atual / Y protegidas`, quantidades e amostras identificadas por tipo. Usa os endpoints existentes `/out-of-scope/preview` e `/out-of-scope/confirm`, cujo novo backend decide exclusivamente pelo motor F3 da coleta.

Prévia e confirmação permanecem separadas. Cancelar não grava regras nem exclui publicações. Proteções de empresa e outra origem, tokens, pausa/continuação e ausência de retry automático em falha ambígua continuam preservados. O fluxo exclui fisicamente publicações somente após confirmação explícita; publicação de taxonomia e edição de regras são fluxos separados.

Backend deve ser incorporado antes da web quando houver autorização de implantação. Estes PRs não autorizam merge, deploy ou execução em produção. Vitest/Playwright cobrem total único, amostras por tipo, consulta sem confirmação e regressões de lotes/pausa/retomada.
