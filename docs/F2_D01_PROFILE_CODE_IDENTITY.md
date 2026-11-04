## Checkpoint vigente — 04/11/2026
Frente 2: **10% — 5/50 entregas aceitas**, denominador fixo; +0 neste complemento. Aceite técnico não equivale a integração/liberação.
#143 @61b086c80bfaed8743702972d5009e4c1395b59e: APPROVED técnico incremental pelo COORD. CI combinado [41930862808](https://github.com/fabiojuniort-cyber/radar-fiscal-web/actions/runs/41930862808) SUCCESS:314 unidades,204 browser PASS/24 ignorados, typecheck/builds. [ZIP combinado](https://chatgpt.com/library?file_id=libfile_94afcfbbf654819188057c75ccf8f188&account_id=personal), SHA256 6910e56eb32517f02de7cbb2d7504c7908f7a95da4127a2834f9c84bad37ee61. Este complemento altera somente três documentos; não atribuir o CI anterior ao novo SHA documental.
Railway: a consulta nativa anterior concluiu status com serviço web05-preview, projeto tribusca-web-preview-web05, ambiente19ba8e37-8c3f-4538-8e7f-45d250165ff2, repositório radar-fiscal-web, último deploy48f2557d-b050-4ace-8122-35f5f781970b SUCCESS, commit3489453c/main e domínio www.trifaros.com.br. Isso descreve o deploy observado, não comprova branch binding atual ou regra checkSuites/autodeploy.
Na nova leitura de environment config, o CLI retornou “Environment ... not found” no contexto local vinculado; também advertiu falha ao persistir refresh OAuth (acesso negado). Nenhuma configuração/autenticação foi alterada. Regra atual de publicação permanece NOT_PROVEN; não presumir que CI impede publicação após merge.


# Estado atual — integração F2 em branch isolada — 04/11/2026

#142 @3b34075193f11c54b8dafc1bb34588956a9b1cd7 recebeu APPROVED técnico independente em [6642909571](https://github.com/fabiojuniort-cyber/radar-fiscal-web/pull/142#issuecomment-6642909571), incluindo5/5 testes focados independentes. CI41908172089 SUCCESS:302 unidades,196 browser passaram/24 ignorados. [ZIP visual](https://chatgpt.com/library?file_id=libfile_0cba723f4a648191a4ffe0fc38df805f&account_id=personal), SHA2567c307591b77a22376651e784c69b6dc45aaac35a116d1b8f1a57adb5ac9898b6.

A prova de códigos distintos vem das asserções DOM/testes; o ZIP mostra rótulos, contador33 e legado. Integração preparada com #141 por merges normais sobre main3489453c em branch isolada. Sem conflitos de arquivos, sem mudanças funcionais adicionais; preservar tenant/versão/gravação explícita. CI combinado concluído conforme checkpoint vigente acima. Nenhuma migration/backfill/taxonomia/produção. As referências históricas abaixo a browser/ZIP/CI/revisão pendentes não descrevem o estado atual.

## Histórico preservado

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
