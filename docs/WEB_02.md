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

Nenhum endpoint foi inventado. Sem contrato público, métricas exibem `—`. Status estáticos do draft são conservadores: federais em **Em validação**, SP em **Em validação** e demais UFs em **Em implantação**, sem promover fonte a Online sem evidência.

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

O header usa a assinatura horizontal oficial. No branch WEB-02 foi reaproveitado o asset horizontal já usado pelo protótipo oficial anterior, sem redesenho do símbolo/wordmark. A fonte canônica de marca continua sendo o Brand Kit registrado no `tribusca-control`.

## Testes mínimos WEB-02

- modal Entrar;
- requisitos de senha em tempo real;
- seleção do carrossel com SP fixo em primeiro;
- 27 cards estaduais na Cobertura;
- placeholders sem API;
- presença do carrossel Decodifica.

## Pendências

- gate do Gerente para claims “Disponível”;
- gate Branding para cores do Sonar;
- contratos backend de cadastro/reset/cobertura;
- revisão visual contra Design Components;
- CI final do head.
