# DATE-01 — régua temporal do Acervo

- Modo padrão: data única com régua de dias e seleção clicável.
- A data selecionada é recentralizada com animação; `prefers-reduced-motion` usa movimento imediato.
- Datas futuras permanecem visíveis como contexto, porém desabilitadas.
- Toggle `Intervalo` troca para campos lado a lado `De` e `Até`.
- Apagar somente `De` preserva `Até`; apagar somente `Até` preserva `De`. O intervalo aberto continua aplicado na URL e na consulta à API.
- `Limpar data` e `Limpar filtros` apagam os dois limites e qualquer data única previamente selecionada.
- A régua muda entre dias, meses e anos conforme a amplitude.
- Períodos de borda recebem preenchimento azul proporcional à fração coberta; períodos integralmente no intervalo recebem preenchimento total.
- Em modo intervalo a régua edita o endpoint ativo (`De` ou `Até`).
- A seleção deve combinar com os demais filtros, permanecer na paginação e ser refletida na URL.

## Regressões B1/B2

- `src/archive-date-bridge.test.tsx`: limpeza independente de cada limite, persistência na URL/sessionStorage e limpeza completa pelas duas ações explícitas.
- `e2e/date-01.spec.ts`: navegação autenticada até o Acervo, seleção pelo campo e pela régua, URL e requests reais do frontend a `/api/v2/archive`, combinação com busca, reset da página 2 para 1, detalhe/retorno preservando data única e intervalo na página 2, intervalos abertos nos dois sentidos e limpeza.
- O E2E fixa o relógio na virada UTC/Brasília e verifica limite e botões futuros desabilitados. Cenários separados deixam data única/intervalo ativos ao abrir Publicações e verificam ausência de `publishedOn`, `publishedFrom` e `publishedTo` nos requests.
- Os cenários executam nos quatro viewports do Playwright existente. As respostas de autenticação/API são fixtures interceptadas; a semântica de filtragem do servidor permanece coberta pelo backend PR #127, sem alteração do backend nesta correção.
