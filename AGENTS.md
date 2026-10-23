# TriFaros — instruções de continuidade do frontend

Antes de qualquer implementação, leia o contexto durável em:
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/contexts/WEB.md
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/CONTEXT.md
- https://github.com/fabiojuniort-cyber/tribusca-control/blob/main/AGENTS.md
- a Issue atribuída no `tribusca-control`.

A Issue define escopo, autorização e critérios. Revalide o estado vivo deste repositório, a API real do backend e as decisões antes de escrever código. Não tratar protótipo como frontend definitivo nem iniciar trabalho por conta de um cartão no Projects.

A cada marco relevante, registre PR, testes, limitações e handoff na Issue; atualize documentação técnica neste repositório no mesmo PR quando comportamento/contrato mudar. O Gerente Geral audita e atualiza os contextos gerenciais no `tribusca-control`. Não afirmar sincronização automática entre chats.

## Identidade vigente

BRAND-02 (tribusca-control#64) define **TriFaros** como a identidade comercial vigente e prevalece sobre referências de marca da identidade v1. Decisões históricas, nomes reais de infraestrutura e identificadores legados não devem ser reescritos retroativamente. Consulte `docs/BRAND_02.md`.

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
- existem 25 combinações possíveis por carregamento;
- cada combinação contém de 1 a 10 alvos;
- quantidade, posição e distância variam entre as combinações;
- perto usa vermelho, média usa amarelo e longe usa verde;
- o alvo só acende quando o feixe cruza seu ângulo;
- após a detecção, o alvo perde intensidade gradualmente e desaparece ao completar 180° de afastamento do feixe;
- a combinação seguinte entra a cada nova volta, mantendo apenas o rastro residual necessário da combinação anterior;
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

## Cadastro empresarial e Perfil Tributário

A experiência autenticada de Empresas segue estas regras:
- o fluxo principal é `CNPJ -> consultar -> cadastrar`, sem exigir que o usuário digite novamente razão social, endereço ou CNAEs;
- mostrar CNAE principal e todos os secundários retornados/persistidos;
- permitir edição manual de nome, endereço e CNAEs, mantendo o CNPJ bloqueado como identidade cadastral;
- `Consulta API` atualiza novamente os dados cadastrais do estabelecimento;
- o Perfil Tributário deve separar visualmente `Contexto cadastral automático`, `Contexto fiscal declarado` e `Taxonomia TriFaros`;
- opções taxonômicas vêm do backend e de release publicada; salvar códigos canônicos, não labels inventados no frontend;
- quando não houver release publicada, mostrar estado transparente de indisponibilidade e não fabricar opções.


### Inscrição Estadual

- Exibir IE como dado estadual separado do cadastro CNPJ/RFB.
- Quando o backend confirmar a IE por fonte oficial estadual, mostrar o valor e o estado da consulta.
- Diferenciar visualmente IE confirmada, não localizada, fonte indisponível e UF ainda não automatizada.
- Permitir edição manual da IE, deixando claro que o valor manual não equivale a confirmação automática pela SEFAZ/SINTEGRA.
- O botão de atualização cadastral pode reconsultar RFB + fonte estadual suportada; não chamar isso apenas de consulta à Receita quando houver enriquecimento estadual.

## Confirmações destrutivas

Ações destrutivas no painel autenticado não devem depender de `window.confirm()`.

Use confirmação própria da interface, com:
- `role="dialog"` e `aria-modal="true"`;
- texto explícito sobre o efeito da ação;
- botões Cancelar e Confirmar;
- estado de carregamento durante a mutation;
- mensagem de erro visível quando a API falhar;
- comportamento consistente em Safari/iPhone e desktop.

A exclusão de empresa é definitiva: a confirmação deve dizer “Excluir definitivamente. Esta ação não pode ser desfeita”, exigir o nome completo da empresa digitado e explicar que perfis/unidades são removidos e o recadastro começa vazio. A auditoria é retida de forma minimizada. Enviar X-Company-Delete-Intent: permanent-v1 somente pelo fluxo novo; clientes antigos são bloqueados pelo backend.

## Sonar visual

O componente demonstrativo de Sonar deve se comportar como uma varredura real:
- estrutura do radar monocromática, usando a cor de interface aprovada;
- somente os alvos detectados usam cores de severidade/afinidade;
- o feixe gira continuamente a partir do centro;
- cada alvo permanece oculto até o feixe cruzar seu ângulo;
- a animação do alvo deve usar a mesma duração da varredura e um delay derivado do ângulo do alvo;
- o alvo acende forte na detecção e desaparece gradualmente até 180° depois;
- gerar 25 combinações possíveis por carregamento, cada uma com 1 a 10 alvos;
- quantidade, posições e distâncias são variadas aleatoriamente nas combinações;
- a primeira combinação inicia com 1 alvo; as seguintes são escolhidas aleatoriamente, evitando repetição imediata da mesma combinação;
- a combinação anterior pode permanecer somente como rastro residual até concluir o fade de meia volta;
- `prefers-reduced-motion` deve continuar desabilitando a rotação para acessibilidade.


### Local Negócio

- Exibir `Local Negócio` como campo manual no cadastro/edição da empresa e dos estabelecimentos.
- No cadastro de empresa, o campo representa o código interno da matriz.
- No cadastro de estabelecimento, representa o código interno daquela filial/unidade.
- Não preencher esse campo a partir da RFB, CNAE, SEFAZ ou qualquer outra fonte automática.
- Reconsultas de CNPJ/RFB/IE não devem sobrescrever o valor manual.
- Exibir o código no resumo da empresa e na tabela de estabelecimentos quando informado.
- O campo `Nome fantasia` não faz parte da edição da empresa na experiência atual; a razão social permanece o identificador textual principal exibido.
- Erros técnicos de integração como `cnpj_provider_unavailable` não devem ser apresentados crus ao usuário; mapear para mensagens compreensíveis.

## CI com custo controlado

Durante implementação, trabalhe em PR **draft** e envie blocos coerentes de commits. O draft roda checks rápidos e termina com `DRAFT_FAST_ONLY`: aviso intencional de regressão completa pendente, não uma falha do produto. **Não rerodar esse CI nem criar commits só para eliminar o aviso.**

Quando estiver pronto, marque **Ready for review** para disparar todos os gates completos; cada atualização posterior do head também roda a regressão completa. Só faça merge com CI completo verde no head atual e revisão exigida pela governança. Main mantém a regressão completa. Procedimento, seleção PG18 e rollback: `docs/ci-cost-02.md`.

## Histórico de auditoria R7

Buscar nome atual por ID/tenant no endpoint de histórico; nunca ler snapshot de nome
ou CNPJ da auditoria/onboarding. Empresa excluída exige evidência COMPANY_PURGED
no mesmo tenant. Erro HTTP/consulta ou ausência sem evidência = Indisponível.
O deploy e o backfill produtivo têm autorizações separadas; a exclusão fica
temporariamente indisponível enquanto houver legado pendente.
