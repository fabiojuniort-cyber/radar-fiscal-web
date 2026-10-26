# ONB-03 — Etapa 1 / web #127
Depende do backend #247 e da atualização CNPJ/Acervo #124. Este PR é empilhado sobre #124:
validar/revisar #124, então #127; após incorporação autorizada de #124, retarget #127 para main.
Não integrar #125 em paralelo.

As unidades ativas têm regime, conceitos e NCMs independentes. Unidade ausente na lista
salva inicia NAO_INFORMADO e listas vazias. Não há cópia automática nem preenchimento em lote.
Dados de empresa já salvos permanecem no contrato legado e não são migrados por este PR.
As duas áreas são regiões acessíveis distintas, para evitar confundir seleções globais e da unidade.
O banner de boas-vindas existente é transitório; popup por card, autosave/retomada e frases do CSV
são a etapa 3, dependente das sugestões aprovadas/publicadas na etapa 2.
Não se afirma implementação do assistente completo nesta etapa.
Sem SQL produtivo, merge/deploy ou alteração automática de perfis existentes.
