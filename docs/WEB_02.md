# WEB-02 — contrato de frontend e integração

**Data:** 26/09/2026  
**Issue:** tribusca-control #8  
**Status:** draft / sem merge / sem deploy

## Contrato comprovado

### Login

`POST /auth/login`

Body:

```json
{
  "email": "usuario@empresa.com.br",
  "password": "senha"
}
```

Resposta de sucesso contém `accessToken`, `tokenType`, `expiresIn` e `user`. O backend também grava refresh token em cookie HttpOnly com `SameSite=Strict` e path `/auth`.

O frontend:
- usa `VITE_API_BASE` quando configurado;
- cai para same-origin quando vazio;
- envia `credentials: include`;
- não cria endpoint alternativo;
- não persiste o access token em `localStorage` nesta frente.

## Fluxos sem contrato comprovado

Os seguintes fluxos aparecem no design, porém não executam escrita remota:
- Criar conta;
- Recuperar senha;
- Nova senha.

A UX e a validação client-side podem ser demonstradas. Os botões de submissão permanecem inativos até existir contrato backend.

## Cobertura

A página reserva os campos:
- status da coleta;
- última atualização;
- importadas hoje;
- total no Acervo.

Nenhum endpoint foi inventado. Sem contrato público ativo no frontend, **status operacional e métricas exibem `—`**. Os rótulos permitidos quando a API estiver disponível são **Online / Em validação / Em implantação**.

## Sonar

A escala funcional continua **Alta / Média / Baixa afinidade**. A WEB-02 acrescenta:
- proximidade ao centro como metáfora;
- Alta = vermelho;
- Média = amarelo;
- Baixa = verde;
- rótulo textual obrigatório;
- `prefers-reduced-motion`.

A exceção cromática ainda depende de gate de Branding antes do merge.

## Assets

O header usa a assinatura horizontal oficial `tribusca-logo-horizontal-light.png`, derivada diretamente do arquivo canônico do Brand Kit para uso web sem redesenho do símbolo/wordmark. A fonte canônica de marca continua sendo o Brand Kit registrado no `tribusca-control`.

## Testes mínimos WEB-02

- modal Entrar;
- requisitos de senha em tempo real;
- seleção do carrossel com SP fixo em primeiro;
- 27 cards estaduais na Cobertura;
- status e métricas como placeholders sem API;
- presença do carrossel Decodifica.

## Pendências

- WEB-03 corrigiu o draft: Acervo, Central de Monitoramento, Sonar, Revela, Decodifica e Perfil Tributário ficam todos como **Em desenvolvimento**;
- gate Branding para cores do Sonar;
- contratos backend de cadastro/reset/cobertura;
- revisão visual contra Design Components;
- CI final do head.


## WEB-03 — correção de disponibilidade

**Data:** 26/09/2026  
**Origem:** decisão do Gerente.

A WEB-02 havia levado ao draft o claim **Disponível** para Acervo e Central de Monitoramento, condicionado a confirmação antes do merge. Esse gate foi resolvido na WEB-03 com decisão de **não publicar o claim**.

Estado vigente no site público:
- Acervo — **Em desenvolvimento**;
- Central de Monitoramento — **Em desenvolvimento**;
- Sonar — **Em desenvolvimento**;
- Revela — **Em desenvolvimento**;
- Decodifica — **Em desenvolvimento**;
- Perfil Tributário — **Em desenvolvimento**.

A D-043 permanece no histórico como proposta aplicada ao draft e não confirmada para publicação. Páginas e demonstrações com placeholders não equivalem a funcionalidade disponível.

**Impacto:** somente claims/status do site público e documentação. As cores do Sonar continuam no draft, sujeitas à Issue #10. Sem merge/deploy.


## WEB-05 — correções WEB-04

**Data:** 27/09/2026  
**Origem:** bloqueios da revisão independente WEB-04 / Issues #8 e #10.

### Acessibilidade

- controles de paginação do carrossel: alvo interativo `28×28px`, nomes individuais `Exibir <UF>` e foco visível;
- indicador inativo: `#607086` em branco, contraste aproximado **5.05:1**;
- indicador ativo: `#0057FF` em branco, contraste aproximado **5.52:1**;
- regras de senha pendentes: `#607086`, contraste aproximado **5.05:1** e ícone próprio de estado pendente;
- regras atendidas: `#237032`, contraste aproximado **6.11:1**;
- borda normal dos inputs: `#74859A`, contraste aproximado **3.77:1** em branco;
- foco de botões, links e inputs recebe outline azul institucional de 3px;
- `prefers-reduced-motion` permanece ativo.

### Sonar — ratificação com ajustes

A exceção semântica continua restrita ao componente Sonar e não amplia a paleta institucional:

- Alta: `#C92A2A` para rótulo/sinal — ~**5.46:1** em branco;
- Média: `#9A6900` para rótulo/sinal — ~**4.78:1** em branco e >3:1 como elemento gráfico;
- Baixa: rótulo `#237032` — ~**6.11:1**; ping `#2B8A3E` permanece como elemento gráfico >3:1.

Texto Alta/Média/Baixa e proximidade continuam obrigatórios; cor não é a única informação.

### Marca

- footer usa `/brand/tribusca-logo-horizontal-dark.png` e não aplica filtro/recoloração CSS;
- o arquivo web foi derivado exclusivamente do master oficial da Biblioteca TriBusca/Branding/v1, sem redesenho nem mudança cromática;
- master oficial de origem: SHA-256 `c541566c88a53d4dac0e473f430c4d9a26bb40c9ecaa47d96ae8a8998e37da99`;
- o checksum do arquivo efetivamente versionado no PR é apurado no CI WEB-05 e deve ser registrado no handoff.

### Tipografia

Inter é empacotada no build por `@fontsource/inter@5.3.0`, importando somente 400/700/800/900. O CSS mantém fallback `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Licença e uso: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Limites

- nenhum endpoint novo foi criado;
- Issue #9 continua gate para cadastro/recuperação/nova senha;
- preview WEB-05 é temporário e exclusivo de revisão;
- PR permanece draft, sem merge e sem publicação definitiva.
