# WEB-20 — publicações reais na Home e no carrossel estadual

## Objetivo

Substituir exemplos estáticos por publicações oficiais reais já coletadas e expostas pela API pública aprovada.

## Contrato utilizado

Sem criar endpoint novo e sem ampliar o contrato público.

- `GET /public/v1/publications?limit=4` para o card **Agora no radar**.
- `GET /public/v1/publications?uf=<UF>&jurisdiction=STATE&limit=3` para o card de cada UF no carrossel.

Campos exibidos no site público:
- título;
- data;
- órgão;
- link oficial.

Esses campos respeitam a exposição pública já aprovada para o Acervo.

## Estados

### Consulta concluída com publicações
Renderizar somente os itens retornados pela API.

### Consulta concluída sem publicações
Exibir **Em implementação**.

### API indisponível ou erro de consulta
Exibir **Dados indisponíveis**.

A aplicação não deve transformar falha de API em ausência de publicação e não deve preencher lacunas com conteúdo fictício.

## Regras

- Não manter exemplos como “substituir pelo feed real”.
- O título usa `officialUrl` quando presente.
- O card global usa os itens mais recentes conforme a ordenação vigente do endpoint público.
- Cada mudança de UF dispara/recupera uma consulta própria, com cache do TanStack Query.
- O carrossel visual e a rotação de UFs permanecem independentes da disponibilidade das publicações.

## Validação

A entrega deve preservar:
- typecheck;
- testes unitários;
- build;
- Playwright nos viewports configurados;
- ausência de chamadas privadas no modo demonstração;
- diferenciação entre **Em implementação** e **Dados indisponíveis**.


## Transporte

No navegador, o cliente usa caminhos same-origin `/public/...`. O Vite Preview encaminha `/public` ao backend configurado em `VITE_API_BASE`.

Isso evita que a exibição pública dependa de CORS entre o domínio do site e o domínio do backend.
