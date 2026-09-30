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


## Publicação incremental para revisão visual

Quando o Product Owner autorizar explicitamente revisão olhando o site publicado, mudanças desta frente podem ser entregues de forma incremental no ambiente publicado, sem esperar um pacote visual maior.

Fluxo obrigatório para cada incremento:
1. implementar em branch de trabalho;
2. preservar contratos reais, autenticação, rotas, dados factuais e decisões congeladas;
3. executar typecheck, testes, build e Playwright aplicável;
4. corrigir regressões causadas pela mudança;
5. abrir PR e registrar o handoff;
6. após validação automatizada, incorporar à branch publicada e confirmar o deploy no Railway;
7. informar ao Product Owner o SHA efetivamente implantado.

A autorização para publicação incremental não autoriza inventar dados, contornar gates de segurança, alterar arquitetura congelada ou promover funcionalidades ainda não comprovadas como disponíveis. Status de produto continuam factuais.

## Fidelidade por screenshot

Quando o Product Owner fornecer screenshots explícitos de uma página, esses screenshots passam a ser a referência visual dominante daquela página, inclusive para hierarquia, espaçamento, proporções, posição dos componentes e tratamento tipográfico.

Isso não substitui contratos reais, autenticação, dados factuais, segurança ou estados efetivamente disponíveis. Onde o screenshot contiver dados de exemplo, a implementação deve mantê-los claramente identificados como ilustrativos até existir contrato real aprovado.

Para o Sonar, a referência aprovada inclui radar animado:
- raio parte do centro e gira continuamente;
- três detecções são exibidas sequencialmente, uma por volta;
- distância é sorteada no carregamento entre perto, média e longe, podendo repetir categoria;
- perto usa vermelho, média usa amarelo e longe usa verde;
- prefers-reduced-motion deve desativar a rotação e manter os sinais legíveis.

## Dados reais no site público

Cards e carrosséis que representam publicações oficiais não podem usar exemplos fictícios quando houver contrato público aprovado para a informação.

Para a Home e o carrossel estadual:
- consumir `GET /public/v1/publications` para listar publicações reais;
- no site público, exibir somente campos aprovados para exposição pública: título, data, órgão e link oficial;
- quando a consulta retornar com sucesso e sem publicações para a UF, exibir `Em implementação`;
- quando a API falhar ou ficar indisponível, exibir `Dados indisponíveis`, sem confundir falha de fonte/API com ausência de publicações;
- nunca preencher lacunas com títulos, datas, atos ou capturas inventadas.

### Transporte da API pública

No runtime Railway/Vite Preview, chamadas públicas devem usar o mesmo domínio do frontend (`/public/...`). O `vite.config.ts` encaminha `/public` para o backend configurado em `VITE_API_BASE`.

Motivo: evitar dependência de CORS do navegador entre o domínio público do site e o domínio do backend. Não reintroduzir `VITE_API_BASE` diretamente no cliente de `public-api.ts` sem uma decisão explícita de arquitetura.
