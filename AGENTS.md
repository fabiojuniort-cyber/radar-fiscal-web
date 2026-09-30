# TriBusca — instruções de continuidade do frontend

Antes de qualquer implementação, leia o contexto durável em:
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/contexts/WEB.md
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/CONTEXT.md
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/AGENTS.md
- a Issue atribuída no `tribusca-control`.

A Issue define escopo, autorização e critérios. Revalide o estado vivo deste repositório, a API real do backend e as decisões antes de escrever código. Não tratar protótipo como frontend definitivo nem iniciar trabalho por conta de um cartão no Projects.

A cada marco relevante, registre PR, testes, limitações e handoff na Issue; atualize documentação técnica neste repositório no mesmo PR quando comportamento/contrato mudar. O Gerente Geral audita e atualiza os contextos gerenciais no `tribusca-control`. Não afirmar sincronização automática entre chats.

## Modelos visuais e estado publicado

Arquivos de protótipo, pacotes Claude Design, HTMLs `.dc.html`, screenshots e prompts de design são referências derivadas; não são fonte de verdade do produto publicado.

Ao sincronizar um modelo visual com o site publicado:
- identifique primeiro o commit exato efetivamente implantado no Railway;
- derive o modelo desse SHA, e não de um prompt, branch ou protótipo ainda não implantado;
- considere uma mudança “publicada” somente após estar em `main` e existir deploy bem-sucedido correspondente;
- preserve contratos reais, autenticação, rotas, estados factuais e regras de não inventar dados;
- quando o protótipo divergir da produção, documente a divergência em vez de silenciosamente promover o protótipo a fonte de verdade.

Procedimento detalhado: `docs/DESIGN_MODEL_SYNC.md`.
