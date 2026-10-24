# ONB-02 R8 — cadastro legado bloqueado

Empresa permanece ativa até exclusão definitiva, com confirmação existente.
Não há ação de desativar ou reativar empresa na interface. O backend conserva o
campo isActive por compatibilidade e passa a impedir empresas inativas no banco.

O 409 company_inactive_requires_deletion, no cadastro automático ou manual,
mostra: "Este CNPJ está bloqueado por um cadastro antigo. Contate o suporte."
Não oferece reativação nem purga automática. O contrato dos estabelecimentos
é separado e permanece inalterado.

Testes de comportamento exercitam os dois fluxos com resposta 409, mensagem
visível e nenhuma conclusão falsa de cadastro; o fluxo automático verifica
uma única chamada POST. A confirmação de exclusão definitiva mantém seus testes.
Parte B da Issue #118; PR sem merge/deploy.
