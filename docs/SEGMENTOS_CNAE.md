# Segmentos e CNAE 2.3

A curadoria da dimensão `sector` apresenta Segmento, Subsegmento, CNAE,
Descrição do CNAE e Sinônimos. O código precede a descrição. Produtos e
demais dimensões preservam seus próprios cabeçalhos.

`ops/segments/trifaros-cnae-2.3.json` deriva da planilha
`TriFaros_Segmentos_CNAE_Empresas_Brasil.xlsx`: 1.332 subclasses, 32 segmentos
e 137 subsegmentos presentes no mapeamento CNAE. As descrições são as da
planilha, inclusive diferenças ortográficas entre o arquivo CONCLA e a API.
Os outros 34 subsegmentos da planilha só aparecem nas empresas da amostra;
não se inventa um vínculo CNAE para incluí-los nesta carga.

Os 17.671 sinônimos são descrições e descritores positivos da API oficial
https://servicodados.ibge.gov.br/api/v2/cnae/subclasses. Descritores invertidos
como `ARROZ; CULTIVO DE` tornam-se `cultivo de arroz`. Qualificadores são
preservados; notas de exclusão não são sinônimos. A normalização remove
duplicatas de caixa, acentos e espaços. Não gera palavras genéricas pela
remoção de qualificadores. A API de curadoria aceita até 200 sinônimos por
item; quatro subclasses excedem esse limite (2019399, 2029100, 2110600 e
2121101), ficando com a descrição e os 199 descritores mais curtos. O conjunto
é vocabulário de associação textual, sem declaração de incidência tributária.

Importar na tabela Segmento pelo botão de carga massiva (JSON). O arquivo é
integralmente validado antes da escrita. O frontend usa apenas os contratos
existentes, com autenticação, justificativa e auditoria de curadoria: cria
segmentos canônicos `sector.trifaros_<id>`, subsegmentos vinculados e lotes
transacionais de 40 atividades. Cada atividade contém um CNAE de sete dígitos
como texto; códigos com zeros à esquerda são preservados.

A carga altera somente o rascunho aberto. Mantém conceitos legados, outras
dimensões, releases publicadas, perfis e histórico. Não publica a taxonomia,
não altera a classificação automática, não executa SQL ou migration. CNAEs
exatos já existentes são atualizados pelo código canônico; sinônimos destes
itens passam a refletir o arquivo importado. Mapeamentos ambíguos são recusados.
Após cada lote, eventual interrupção conserva as transações anteriores;
reimportar o mesmo arquivo retoma por CNAE sem duplicar. A conferência final
verifica descrições, grupos, segmentos e todos os sinônimos gravados.

A grade abre as atividades por CNAE e pagina em blocos de 50. O seletor
permite consultar segmentos gerais e itens legados, ou todos os itens. Filtros
e ordenação abrangem todo o conjunto; a seleção em massa abrange a página.
Sinônimos só produzirão novas classificações após publicação e ativação pelo
fluxo normal do produto. CSV legado continua usando `Grupo` e `Item` para
compatibilidade com o backend existente.

Reversão: a versão publicada continua intacta. Alterações do rascunho podem
ser corrigidas pelas tabelas de curadoria. A carga usa `retire: []` e nunca
remove conceitos. Não publicar a release como mecanismo de rollback.
## Entrada por texto

Na tabela Segmento, “Importar segmentos por texto” aceita o conteúdo JSON do mesmo pacote de importação. Esta entrada usa a mesma validação, auditoria, gravação por lotes e conferência final, sem depender de acesso da extensão do navegador aos arquivos locais. O conteúdo é limpo somente depois da conferência bem-sucedida; em falha parcial, permanece disponível para retomar a carga.
