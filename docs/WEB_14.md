# WEB-14 — acesso temporário ao painel em modo demonstração

## Objetivo

Disponibilizar uma área visual temporária do produto sem autenticação real e sem qualquer acesso a dados privados.

## Feature flag

A superfície demo usa `VITE_ENABLE_DEMO_ACCESS` e só é habilitada quando o valor é exatamente:

```
true
```

Valores ausentes, `false`, `TRUE`, `1` ou qualquer outra string permanecem desabilitados.

Com a flag desabilitada:
- o botão **Entrar em modo demonstração** não é renderizado;
- acesso direto a `/painel-demo` redireciona para `/`.

## Isolamento

A rota `/painel-demo`:
- usa apenas estado React e conteúdo mock local;
- não chama `POST /auth/login`;
- não chama endpoints autenticados;
- não cria JWT, cookie, sessão falsa ou token em `localStorage`;
- não consulta tenant, empresa, usuário, CNPJ privado, matching ou configurações reais.

A ação **Sair da demonstração** navega apenas para `/`; não chama logout e não altera cookies reais.

## Login real

O fluxo existente continua independente:
- `POST /auth/login`;
- `VITE_API_BASE`;
- `credentials: include`;
- nenhum token em `localStorage`;
- falha de login real não ativa o modo demonstração.

## Validação

Os testes cobrem:
- parsing estrito da feature flag;
- botão ausente e rota bloqueada com flag desligada;
- entrada demo sem chamadas de rede;
- badge e aviso de dados demonstrativos;
- shell de navegação inicial;
- refresh direto em `/painel-demo` no build demo-enabled do Playwright;
- saída para o site público;
- regressões existentes de login, D-054, foco/Escape e viewports.

A CI valida o build padrão e, antes do Playwright, gera um segundo build com
`VITE_ENABLE_DEMO_ACCESS=true` exclusivamente para exercitar o fluxo demonstrativo no navegador.

## Desativação

Remover a variável do ambiente de build do frontend Railway ou defini-la com qualquer valor diferente do literal `true`. Um novo build/deploy do frontend deixa de renderizar o botão e bloqueia funcionalmente a rota demo.
