# TAX-11 — Curadoria da Taxonomia no site

Issue: fabiojuniort-cyber/tribusca-control#61 · Backend: fabiojuniort-cyber/radar-fiscal-backend#129

## Telas

- **`/admin/taxonomia`** (`src/taxonomy-admin.tsx`) — só para usuários com o papel de
  plataforma `TAXONOMY_CURATOR` (`GET /api/v1/admin/me`). Atalho no menu do usuário do
  painel. Abas:
  - **Tabelas**: uma tabela por dimensão (Grupo · Item · Código oficial · Sinônimos ·
    No perfil · Classificar pelo nome · Ordem), edição em linha, detalhes do item,
    grupos (com segmentos atendidos), configuração da tabela, exportar/importar CSV.
  - **Revisar e publicar**: diferenças contra a versão publicada, bloqueios/alertas e
    publicação com notas da versão.
  - **Catálogos oficiais**: NCM e CNAE (conferir → carregar) e cClassTrib (upload do CSV
    oficial).
  - **Classificação automática**: interruptor (nasce desligado), progresso do acervo e
    fontes excluídas (DOE-SP).
  - Toda escrita exige o "motivo das alterações", gravado na auditoria.
- **Página da legislação** (`src/publication-taxonomy.tsx`): "Tags identificadas nesta
  legislação" por seção; hover/foco mostra o motivo; clique abre o Acervo filtrado pela
  tag. Curador remove/restaura/acrescenta tags com justificativa.
- **Acervo**: filtro `tag` vindo da página da legislação, com chip "Remover tag".
- **Perfil Tributário**: dimensões e itens conforme a curadoria (ordem, ajuda, grupos
  recolhíveis com "marcar o grupo inteiro"), sem código técnico; segmentos sugeridos
  pelo CNAE (o principal pré-marca enquanto o perfil nunca foi salvo); seleções de itens
  ocultos são preservadas ao salvar.

## Contrato usado

`/api/v1/admin/me`, `/api/v1/admin/taxonomy/*`, `/api/v1/publications/:id/taxonomy`,
`/api/v1/companies/:id/taxonomy-suggestions`, `/api/v2/archive?tag=` e o
`/api/v1/taxonomy/profile-options` estendido (`helpText`, `profileOrder`, `groups`,
`groupCode`, `conceptCodes`). Respostas antigas sem esses campos continuam funcionando.

## Verificação

- Vitest: `src/taxonomy.test.tsx` (acesso negado, tabela editável, tags, Acervo por tag).
- Execução real local contra o backend da TAX-11 com a release v1.1.0 de produção
  reproduzida: criação do rascunho v1.2.0, publicação, classificação, tags, Acervo e
  Perfil Tributário verificados no navegador (desktop e 390 px).
