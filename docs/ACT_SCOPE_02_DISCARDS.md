# ACT-SCOPE-02 — Desconsiderados e alertas

As abas Desconsiderados e Alertas de descarte integram o Filtro de Coleta existente (`/admin/filtro-coleta`). As consultas operacionais só começam após confirmação de PLATFORM_ADMIN e seleção da respectiva aba. O backend mantém autorização e RLS; não há mutation nesta entrega.

## Contratos verificados

Backend de referência: `ac818d609b4c0c8963642ff1f5470b1865d984bd`, migration 041.

- `GET /api/v1/admin/collection-filter/discarded`: `sourceCode`, `limit`, `offset`; resposta `{items}`. Fonte é filtrada no servidor. Cada página mostra 50 registros e solicita 51, usando o último somente como sentinela para habilitar Próxima; offset avança em 50. Não há total fictício, busca parcial local nem filtro por parâmetros inexistentes.
- `GET /api/v1/admin/collection-filter/discard-alerts`: `status` opcional (`OPEN`/`ACKNOWLEDGED`), `limit`; resposta `{items}`. Mostra até 500 alertas recentes, com limite explícito quando atingido. Não há suporte de offset ou reconhecimento pela API atual, portanto não são fabricados controles para essas operações.

Desconsiderados mostram título/ato, tipo original/canônico, fonte/seção/coletor, data, link oficial, código do motivo, termo decisivo, versão/revisão, descarte e expiração. Sem texto integral ou resumo. URLs só são acionáveis para protocolos HTTP/HTTPS. Datas civis preservam o dia oficial; horários são exibidos em Brasília.

Alertas mostram taxa de descarte, baseline, limiar, contagens, status, datas e execução. Valores NUMERIC podem chegar como string e são formatados como percentuais. Carregamento, falha e ausência de registros são estados separados, com atualização manual.

## Validação

- npm ci com o lockfile incorporado por CI-COST-01, sem alterar dependências.
- Typecheck, 179 testes unitários e build local aprovados.
- 9 regressões adicionais: contratos, acesso, carregamento sob demanda, sentinela/paginação, reset do filtro, erro/vazio/recuperação, URL não executável, percentuais e limite de alertas.
- Playwright adicional: acesso admin/não-admin, fonte, datas, política, alertas e overflow nos quatro viewports existentes. A prova do navegador completo será registrada no CI do SHA congelado; download local do Chromium foi bloqueado/inválido neste ambiente.

## Gates restantes

Revisão independente material, CI verde, merge e deploy frontend; depois smoke produtivo KEEP/DISCARD/FILTERED_OUT, política 1/revisão 5, retenção e exclusão do enforcement DOE-SP; depois Stage 7 SUPPRESS/RESTORE exclusivamente pelo mecanismo existente, com evidências e fechamento da governança. Não existe exclusão física, mudança de política ou alteração DOE-SP neste PR.
