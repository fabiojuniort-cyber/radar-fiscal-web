# DATE-01 — régua temporal do Acervo

- Modo padrão: data única com régua de dias e seleção clicável.
- A data selecionada é recentralizada com animação; `prefers-reduced-motion` usa movimento imediato.
- Datas futuras permanecem visíveis como contexto, porém desabilitadas.
- Toggle `Intervalo` troca para campos lado a lado `De` e `Até`.
- A régua muda entre dias, meses e anos conforme a amplitude.
- Períodos de borda recebem preenchimento azul proporcional à fração coberta; períodos integralmente no intervalo recebem preenchimento total.
- Em modo intervalo a régua edita o endpoint ativo (`De` ou `Até`).
- A seleção deve combinar com os demais filtros, permanecer na paginação e ser refletida na URL.
