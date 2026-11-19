# AUTH-RESET Web — candidato de homologação sintética

Controle: [Issue9](https://github.com/fabiojuniort-cyber/tribusca-control/issues/9).
Base Web: `8c246ede102ce89c678986c4e25a5082575b83df`.
Contrato Backend315: `5f5592813d4638f69aa356b0588d0876d2446f43`,
`docs/auth-password-reset-zoho.md`. Backend e produção não são alterados.

## Fluxo e isolamento do token

O modal solicita a recuperação por POST same-origin `/auth/password/forgot` e
mostra somente a mensagem neutra após202. 400 valida o pedido; 429 respeita
Retry-After; 503 e demais falhas recebem mensagens públicas genéricas.

`/nova-senha` reutiliza o desenho dos modais e campos de senha existentes,
`getPasswordChecks` e a política vigente. O módulo de captura é a primeira
importação de `main.tsx`: remove fragmento/query por replaceState antes de
parsear/renderizar e guarda o token de43 caracteres somente em memória. Não há
token em storage, DOM, cache de queries, logs ou telemetria. GET não confirma
reset; somente o envio voluntário faz POST `/auth/password/reset`.

204 limpa token/senhas e abre um documento novo `/?entrar=1`, mostrando o login
existente. Isso também encerra a CSP específica do documento de reset antes de
abrir o shell público. 400 inválido/expirado/usado usa uma mensagem única e
descarta o token. O fluxo não verifica e-mail nem muda a regra de trial.

## Headers reais no ponto que serve a homologação

O servidor atual da aplicação é Vite preview (`npm run build` seguido de
`npm run preview`). O middleware versionado em `vite.config.ts` serve os
headers abaixo para `/nova-senha` e `/nova-senha/`, antes do fallback da SPA:

```http
Referrer-Policy: no-referrer
Cache-Control: no-store
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'
```

O contrato não fixa uma string de CSP; esta implementação permite somente
scripts/conexões/fontes locais, sem frames/objetos/terceiros. A exceção de
estilos inline preserva o comportamento da biblioteca visual existente; não
permite script inline ou eval. Não se inclui analytics/pixels nessa rota.
O HTML também declara referrer no-referrer como defesa antes da aplicação.

Essa prova se refere ao preview local do build, não ao servidor de desenvolvimento
HMR nem a um ambiente implantado. Se a homologação futura usar outro servidor,
o responsável deverá comprovar os mesmos headers no documento real antes de
usar qualquer link emitido. Nenhuma configuração de infraestrutura foi alterada.

## Cenários1–3 — testes isolados

Cliente e UI cobrem202 neutro, validação, Retry-After, 503/500 genéricos,
token inválido/expirado/usado, política de senha e204→login.
`e2e/password-reset.spec.ts` cobre solicitação, abertura GET sem consumo com
fragmento limpo/headers reais e redefinição voluntária com204. Contas e tokens
são sintéticos; APIs são interceptadas e tráfego externo é recusado no teste.
Esses cenários não comprovam entrega de e-mail nem revogação no backend real.

## Cenário4 — somente roteiro, NÃO EXECUTADO

1. COORD fixa os SHAs Web e do candidato Backend atualizado sobre a main,
   reconcilia o delta de315 e autoriza o ambiente isolado com dados sintéticos.
2. Preparar conta controlada `conta@example.test`, senha antiga sintética e uma
   sessão de acesso/refresh sintética. Usar transporte de e-mail simulado;
   nenhuma credencial ou envio Zoho real.
3. Enviar solicitação neutra pelo Web; no transporte simulado, capturar o link
   apenas em memória do teste. Confirmar que a abertura GET não consome token.
4. Submeter senha nova e confirmação; esperar204 e retorno ao login. Confirmar
   no mesmo ambiente o login com a nova senha e a recusa da senha antiga.
5. Confirmar recusa da sessão/JWT/refresh anteriores e do reuso do link; registrar
   apenas resultado agregado, SHAs e evidência sanitizada, sem token/link/senhas.

O roteiro exige candidato Backend atualizado e autorização própria de homologação;
não se declara cenário4 PASS por mocks Web ou pelo CI histórico do315.

## Gates

PR deve permanecer Draft. Revisão independente, homologação conjunta e condições
operacionais de ativação da Issue9 continuam pendentes. Sem merge/deploy,
ativação, envio real, secrets, flags ou operação produtiva. F2 permanece28%(14/50)
até aceite formal. Nenhum prazo produtivo é criado por este documento.
