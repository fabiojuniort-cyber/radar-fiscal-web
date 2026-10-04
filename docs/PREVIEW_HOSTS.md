# Hosts do Vite Preview

O serviço Railway `web05-preview`, projeto `tribusca-web-preview-web05`,
executa `npm run preview -- --host 0.0.0.0 --port $PORT` a partir de `main`.

`preview.allowedHosts` em `vite.config.ts` permite explicitamente:

- `web05-preview-production.up.railway.app`;
- `trifaros.com.br`;
- `www.trifaros.com.br`.

Não usar `allowedHosts: true` nem entradas iniciadas por ponto que liberem
subdomínios indiscriminadamente. Hosts externos não listados continuam bloqueados.
Os proxies `/auth`, `/api` e `/public` permanecem inalterados; esta correção
não exige alterações no backend, DNS ou SSL.

Para validar, executar typecheck, testes e build; iniciar o preview e consultar
`/` com o cabeçalho `Host` de cada domínio permitido (HTTP 200) e de um domínio
externo não autorizado (HTTP 403). Após o deploy, conferir os dois URLs HTTPS.
