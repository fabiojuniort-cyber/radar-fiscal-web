# ACT-SCOPE-02 — interface administrativa

Controle: tribusca-control#94. Base de implementação e deploy observado: `72e9259c63f818711252e186194edaf6924af06e`. Incremento exclusivamente frontend; não altera motor, banco, política ativa ou operações históricas.

## Tabelas e origens

Tipos e Termos usam grades densas com cabeçalho fixo, ordenação, paginação de 50 linhas e filtros por coluna com busca e checkboxes. A seleção só entra em vigor em Aplicar filtro; fechar o popup cancela a seleção. Filtros de colunas se combinam. A exportação considera todos os registros filtrados, além da página atual.

Fonte e Tipo são listas de dados reais: facets e navigation do Acervo, regras persistidas, rascunho e fila de novos tipos. Tipo depende da fonte. As consultas atualizam a cada 60 segundos e no retorno de foco, dentro do QueryClient privado da sessão. Falhas mostram aviso e preservam opções de dados já conhecidos. Fontes `doe-sp` e `doe-sp-legado` aparecem desabilitadas, conforme exclusão vigente no contrato do backend.

Os controles contextWindowWords, weakScoreThreshold e locationWeights deixam de aparecer. Seus valores continuam no documento e são preservados ao salvar. Se não existe DRAFT, a edição começa no documento APPROVED; os padrões só são usados quando nenhuma política existe. Leitura pendente ou com erro impede edição/salvamento até carregar a política real.

## CSV

CSV UTF-8 com BOM, separador ponto e vírgula, campos entre aspas e proteção de fórmulas ao exportar. Importação também aceita vírgula. Use um CSV exportado como modelo e mantenha exatamente os cabeçalhos:

| Tabela | Cabeçalhos |
|---|---|
| Tipos | sourceCode;section;canonicalType;mode;helpText |
| Termos | text;strength;sourceCode;section;canonicalType;locationScope |

Limites: 2 MB, 10.000 registros, 2.000 caracteres por campo. Todo o arquivo é validado antes de alterar qualquer linha: estrutura, enums, fonte real, vínculo fonte/tipo, duplicidade normalizada e termos positivos proibidos pelo filtro. Erro em qualquer registro invalida o arquivo inteiro.

A prévia informa inclusões/substituições. Aplicar ao rascunho mescla pelas chaves de escopo, preserva registros ausentes e mantém aliases e parâmetros internos. Não faz PUT/POST, simulação, aprovação ou mudança na política ativa. O fluxo obrigatório permanece Salvar → Simular → Aprovar.

## Ações e ajuda

Ajuda, Classificar, Mesclar e Criar termo abrem diálogos com X, Escape, contenção de foco e retorno ao botão de origem (ou aba ativa quando a linha desaparece).

- Classificar registra o nome canônico e status RESOLVED na fila, somente depois de confirmação. Não publica regra de coleta.
- Mesclar registra MERGED e o tipo de destino da mesma fonte/seção, escolhido entre regras do rascunho. Para aplicar equivalência no filtro, configurar também o alias e seguir o fluxo de aprovação.
- Criar termo adiciona ao rascunho local com fonte/tipo do item; não resolve a fila nem publica a política.

Erros da API ficam visíveis no popup, sem fechamento automático. Cancelar/X não executam mutations. Termos duplicados mantêm o texto para correção.

## Verificação

Testes de unidade cobrem CSV reversível, arquivos inválidos, escopos, termos proibidos, merge sem perda, preservação de critérios aprovados não padrão, state pendente/erro, ações confirmadas e isolamento de sessão. Playwright cobre filtro/ordenação/exportação/importação atômica, critérios ocultos preservados, atualização automática de origens e popups em 1440×900, 1920×1080, 390×844 e 360×800. CI completo no head e revisão independente são obrigatórios antes de merge.
