# AUTH-01 — login real e painel autenticado

## Contrato

O formulário usa `POST /auth/login` do backend com e-mail, senha e `credentials: include`. O access token JWT fica **somente na memória React**. A sessão sobrevive a recarga por `POST /auth/refresh` com cookie HttpOnly e `x-csrf-protection: 1`; o backend roda rotação e detecção de reuse. `GET /auth/me` valida a identidade e lista apenas os tenants autorizados via RLS. `POST /auth/logout` revoga a sessão no backend antes de limpar a memória do navegador. Falha de login ou refresh não abre `/painel` nem ativa o modo demonstração.

`/painel` é uma rota protegida: mostra somente o usuário autenticado e os vínculos de tenant retornados pelo backend. Não apresenta números simulados nem libera funcionalidades ainda não aprovadas. `/painel-demo` continua uma rota separada, com dados locais de demonstração e sem consulta autenticada. Cadastro/recuperação permanecem “Em breve” sob a D-054/Issue #9; o primeiro administrador é provisionado pelo backend, fora do site público.

## Mesmo domínio para autenticação

O cookie de refresh existente é `HttpOnly`, `SameSite=Strict`, sem `Domain` e com `Path=/auth`. O navegador, portanto, deve chamar `/auth/*` no **mesmo domínio do site**. Para o serviço atual que usa Vite preview, `vite.config.ts` encaminha `/auth/*` ao backend definido por `AUTH_PROXY_TARGET`, com fallback para `VITE_API_BASE` já configurado no serviço. O frontend nunca envia access token ao armazenamento local.

Antes de habilitar produção, verificar por requisição real que `/auth/login`, `/auth/refresh`, `/auth/me` e `/auth/logout` atravessam o proxy e que `Set-Cookie` retorna ao domínio do site com as flags corretas. Se o servidor estático for substituído, configurar o mesmo encaminhamento na nova borda. `VITE_API_BASE` continua para a API pública; CORS público não é um substituto para o proxy autenticado.

## Dependência de branches e gate

O PR #3 de demonstração foi incorporado na `main` como `e0513ea25441e09c06ac757a9004b75b8712d0de`. A branch AUTH-01 foi alinhada a esse commit; seu diff contém somente a autenticação real. Revalidar os refs e o CI no head antes do merge. O responsável dispensou expressamente a revisão independente nesta sessão; a confirmação do proxy e o provisionamento produtivo continuam gates operacionais separados.
