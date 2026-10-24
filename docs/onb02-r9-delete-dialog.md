# ONB-02 R9 — exclusão e auditoria na interface

O popup de exclusão de empresa deixa de pedir a digitação da razão social.
Exibe “Excluir definitivamente. Esta ação não pode ser desfeita.”, com os botões
Cancelar e Excluir. Durante a requisição, as ações ficam desabilitadas.

A requisição DELETE continua usando X-Company-Delete-Intent: permanent-v1.
O backend vigente exige esse header e autorização administrativa, sem exigir
nome no corpo; não foi necessário alterar seu contrato.

A seção Histórico de auditoria foi removida da tela de empresas, assim como
seu componente de consulta e invalidações de cache. O web não chama mais
GET /api/v1/company-audit-history. O endpoint backend e audit_log são preservados.

Testes cobrem popup sem digitação, cancelamento sem DELETE, bloqueio durante
requisição, confirmação única com o header e ausência de chamadas de auditoria.
Escopo autorizado: implementação/testes/PR e registro na Issue #118; sem merge,
deploy, revisão independente ou exclusão de auditoria.
