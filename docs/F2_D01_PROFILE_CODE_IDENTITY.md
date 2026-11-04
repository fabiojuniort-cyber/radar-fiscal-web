# F2-D01 / #123 — identidade do Perfil legado

Aprovado expressamente pelo Fábio em 04/11/2026. Registro da instrução: tribusca-control#123, comentário 6630980325; controle da Frente 2: #124.

## AS IS e TO BE

Antes, a tela transformava códigos em rótulos e deduplicava os rótulos. Dois produtos de códigos distintos com o mesmo nome viravam um chip. Depois, cada item conserva identidade e rótulo separados: código canônico define identidade/deduplicação/key, nome serve apenas para apresentação. Códigos repetidos contam uma vez; homônimos distintos permanecem selecionados e visíveis separadamente.

A tela aplica esse contrato a conceitos atuais, conceitos de versões anteriores, segmentos e NCMs. Campos antigos de texto livre não têm código canônico: sua identidade local é composta por campo e valor, sem inventar um conceito taxonômico nem fundi-los a um conceito só por coincidência de nome. O regime declarado também conserva sua identidade própria. Nada disso altera a taxonomia ou converte dados no carregamento.

O editor clona o perfil e deduplica códigos do rascunho. Remover uma opção remove somente aquele código; nome compartilhado não remove outro produto. O perfil recebido permanece intacto; persistência segue apenas a ação explícita de salvar no fluxo existente, com os contratos de versão e tenant inalterados.

## Validação

Testes da tela: homônimos de códigos diferentes (atual e histórico), repetição do mesmo código, texto legado de mesmo nome, contagem, expansão e ação Editar. Testes do editor: códigos homônimos independentes, deduplicação e salvamento explícito sem mutar o perfil recebido, NCMs/regime/textos preservados.

O cenário real de navegação e onboarding em launch-authenticated.spec.ts passa a exigir 33 chips no Perfil legado, incluindo os dois data-code distintos com rótulo igual. Injeta repetição dos códigos no payload mockado de perfil existente para provar que a contagem não infla. O mesmo fluxo exerce edição posterior de perfil e correção de escolha histórica. Dados sintéticos/fixtures e API interceptada; não é sessão produtiva.

Browser local: Firefox, desktop 1440x900 e mobile 390x844. Chromium permanece indisponível neste ambiente por erro de socket; CI integral do GitHub deve validar o HEAD final separadamente. Nenhum green antigo será reutilizado como CI deste pacote. Evidências/ZIP e resultados finais são vinculados na #123 e #124.

Sem migration, backfill, alteração da taxonomia, merge, deploy ou escrita em perfis produtivos. PR isolado; revisão independente obrigatória, sem autoaprovação.

## Resultado final local

5 testes focados PASS. Regressão local fora da ANAT: 275 testes passaram em 46 arquivos; os 4 testes restantes de importação passaram após recuperar o JSON original pelo blob (arquivo maior que 1 MB, indisponível via Contents). Total local não-ANAT: 279 testes / 47 arquivos PASS, sem alteração do JSON versionado. Typecheck e build da aplicação PASS.

Fluxo completo Firefox em 1440x900 e 390x844: 2/2 PASS, incluindo os códigos duplicados no payload do Perfil legado, 33 chips únicos, dois homônimos com data-code distintos, navegação e edição histórica explícita. As capturas de viewport separam contador e homônimos para manter a leitura com o cabeçalho sticky; não alteram o CSS para capturar. O ZIP conserva hashes, fontes dos arquivos e limites da evidência. CI integral do HEAD final e revisão independente continuam pendentes; não houve merge/deploy.


## Retomada após recriação do ambiente

A captura de viewport usa scroll instantâneo e aguarda dois frames, evitando registrar uma animação de scroll ainda em andamento. O código do produto não muda neste ajuste do ensaio.

Após a recriação do ambiente, os testes locais fora da ANAT passaram novamente (279 testes/47 arquivos) e typecheck PASS. As execuções Firefox anteriores (2/2) são históricas: os PNGs não ficaram disponíveis após a interrupção, e o ambiente novo não iniciou Firefox (Could not find profile folder), inclusive com diretório persistente. Chromium também falhou no startup por socket não permitido. O navegador conectado não estava disponível e a alternativa bloqueou arquivo local por política de URL. Nenhum desses erros equivale a regressão demonstrada do produto.

ZIP visual continua pendente: não afirmar capturas finais entregues ou substituir esse gate por logs/unidades. CI integral também continua pendente de diagnóstico do startup_failure. O novo ajuste de captura ainda exige execução de browser no HEAD final; somente os testes de lógica/typecheck foram reconfirmados nesta retomada.
