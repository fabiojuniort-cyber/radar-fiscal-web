# OPS-DL-01 — Homologação Web

Candidato Web sobre `2c9733101d76df6e0b149df24cfb6e6f91110ad6`, com [Backend #329](https://github.com/fabiojuniort-cyber/radar-fiscal-backend/pull/329) fixado em `57e827a1b79266d45ad83a13fc4fe8f5d3425a55`. Controle na [Issue #103](https://github.com/fabiojuniort-cyber/tribusca-control/issues/103).

Em `/admin/administradores`, o painel consulta `GET /api/v1/admin/platform/dou-download-limits`. Quando o Backend retorna `editable=false`, os campos e o botão ficam desabilitados. O `PUT` envia os quatro limites inteiros em MiB e a tela confirma o salvamento após receber do Backend a configuração correspondente. O limite de PDF permanece reservado à atestação seletiva. A coleta regular usa XML.

O workflow `OPS-DL-01 Web and Backend disposable homologation` compila os dois SHAs, prepara um PostgreSQL vazio com as migrations do Backend e executa o navegador contra o Web preview e o Backend locais. O ensaio verifica a barreira `PLATFORM_ADMIN`, a edição desativada e a persistência após recarregar a página. Uma consulta à fixture comprova a configuração, o evento tipado com UUID da fonte e o consumo de um nonce na mesma gravação. A indisponibilidade real do gateway é induzida revogando `EXECUTE` apenas no banco descartável.

As duas rejeições adicionais no navegador são simuladas. A prova de duplicidade, integridade da assinatura e revogação ocorre no [CI do Backend](https://github.com/fabiojuniort-cyber/radar-fiscal-backend/actions/runs/44653555379). O workflow Web registra resultados por cenário e SHAs. A prontidão em produção exige decisão própria.
