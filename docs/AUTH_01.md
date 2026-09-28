# AUTH-01 — login real e painel autenticado

## Contrato

O formulário usa `POST /auth/login` do backend com e-mail, senha e `credentials: include`. O access token JWT fica **somente na memória React**. A sessão sobrevive a recarga por `POST /auth/refresh` com cookie HttpOnly e `x-csrf-protection: 1`; o backend roda rotação e detecção de reuse. `GET /auth/me` valida a identidade e lista apenas os tenants autorizados via RLS. `POST /auth/logout` revoga a sessão no backend antes de limpar a memória do navegador. Falha de login ou refresh não abre `/painel` nem ativa o modo demonstração.

`/painel` é uma rota protegida: mostra somente o usuário autenticado e os vínculos de tenant retornados pelo backend. Não apresenta números simulados nem libera funcionalidades ainda não aprovadas. `/painel-demo` continua uma rota separada, com dados locais de demonstração e sem consulta autenticada. Cadastro/recuperação permanecem “Em breve” sob a D-054/Issue #9; o primeiro administrador é provisionado pelo backend, fora do site público.

## Mesmo domínio para autenticação

O cookie de refresh existente é `HttpOnly`, `SameSite=Strict`, sem `Domain` e com `Path=/auth`. O navegador, portanto, deve chamar `/auth/*` no **mesmo domínio do site**. Para o serviço atual que usa Vite preview, `vite.config.ts` encaminha `/auth/*` ao backend definido por `AUTH_PROXY_TARGET`, com fallback para `VITE_API_BASE` já configurado no serviço. O frontend nunca envia access token ao armazenamento local.

Antes de habilitar produção, verificar por requisição real que `/auth/login`, `/auth/refresh`, `/auth/me` e `/auth/logout` atravessam o proxy e que `Set-Cookie` retorna ao domínio do site com as flags corretas. Se o servidor estático for substituído, configurar o mesmo encaminhamento na nova borda. `VITE_API_BASE` continua para a API pública; CORS público não é um substituto para o proxy autenticado.

## Dependência de branches e gate

Esta mudança frontend foi preparada sobre `feat/web-14-demo-access` (PR #3), pois a `main` consultada em 28/09/2026 ainda estava no commit `978a1a9b` e não continha o site, embora o PR #1 aparecesse como merged. O PR de AUTH-01 deve ser tratado como **stacked** até a base do site/demo estar incorporada e verificada na `main`; revalidar os refs antes de qualquer merge. Revisão independente R2, CI e confirmação do proxy são obrigatórios. O deploy e o provisionamento produtivo são um gate R3 separado.
