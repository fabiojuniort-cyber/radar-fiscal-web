# ONB-01 — seleção segura após cadastro

Após cadastrar uma empresa, o painel seleciona o ID retornado e abre o Perfil Tributário. Enquanto a atualização da conta ainda não retornou esse ID, mostra `Carregando empresa selecionada…`, sem montar o editor nem oferecer ações do perfil anterior.

Uma seleção explícita nunca recai na primeira empresa da conta. A primeira empresa é usada como padrão somente quando ainda não existe seleção explícita. Se a atualização concluir sem a empresa selecionada, o painel mostra `Empresa selecionada indisponível`; o usuário pode voltar à aba Empresas e selecionar uma empresa disponível.

A regressão em `e2e/launch-authenticated.spec.ts` mantém uma primeira empresa com perfil salvo, cadastra uma segunda e retém a resposta de atualização da conta por uma promessa controlada. Verifica a ausência do editor e de campos/botões de gravação durante a espera, nenhuma escrita na primeira empresa e, ao liberar a resposta, o CNPJ correto da segunda empresa no editor.

Esse teste de interface usa contratos interceptados. A comprovação integrada B5 com PostgreSQL descartável permanece uma validação separada; não constitui autorização para merge ou deploy.
