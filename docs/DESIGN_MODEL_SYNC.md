# Sincronização de modelos visuais com o site publicado

## Objetivo

Evitar que protótipos, prompts de design ou pacotes Claude Design sejam tratados como se já representassem o produto em produção.

## Fonte de verdade

Para uma sincronização do tipo “atualize o modelo para o que publicamos”, a ordem de evidência é:

1. serviço efetivamente implantado;
2. commit/SHA informado pelo deploy;
3. código daquele SHA no repositório;
4. contratos reais de API e autenticação;
5. protótipos e prompts apenas como referência de comparação.

Um prompt descreve intenção. Uma branch descreve trabalho em andamento. Somente um commit incorporado à branch publicada e confirmado por deploy bem-sucedido representa o estado publicado.

## Procedimento

1. Identificar projeto, ambiente e serviço Railway relevantes.
2. Ler o último deploy bem-sucedido e congelar o `commitHash`.
3. Conferir no GitHub os arquivos de UI, rotas, contratos e documentação naquele SHA.
4. Comparar o protótipo/modelo contra esse estado.
5. Atualizar o modelo sem:
   - inventar dados privados ou operacionais;
   - substituir falhas por mocks;
   - regredir autenticação ou contratos reais;
   - incorporar scripts de protótipo ao runtime do produto;
   - promover uma mudança não implantada a “publicada”.
6. Registrar divergências relevantes entre protótipo desejado e estado publicado.

## Snapshot de referência — 30/09/2026

Na sincronização realizada em 30/09/2026:

- repositório: `fabiojuniort-cyber/radar-fiscal-web`;
- branch implantada: `main`;
- Railway: projeto `tribusca-web-preview-web05`, serviço `web05-preview`;
- commit implantado observado: `8abac9bd0d6e8ec216c216812949e25312b14764`;
- status do deploy observado: `SUCCESS`.

Esse SHA é histórico. Em sincronizações futuras, deve-se consultar novamente o deploy vivo e usar o novo SHA correspondente.

## Regra de manutenção

Quando o contrato visual ou funcional publicado mudar materialmente, atualizar a documentação técnica pertinente no mesmo ciclo da mudança. Este documento define o método; não deve ser usado como substituto para a verificação do estado vivo.
