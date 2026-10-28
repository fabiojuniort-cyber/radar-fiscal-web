# ANAT-CONFIG-01 — Anatomia dos atos (configuração acessível)

Issue: tribusca-control#116. Backend: radar-fiscal-backend `/api/v1/admin/anatomy-config` (migration 081).

## O que a tela faz
- Rota `/admin/anatomia`, link "Anatomia dos atos" no menu administrativo. Só existe com `VITE_ENABLE_ANAT_CONFIG=true` (padrão: desligada). Com a flag ligada, `/admin/anatomia-regras` (dupla aprovação) redireciona para a nova tela.
- Ato e estrutura lado a lado e ligados: clicar num trecho no texto ou na árvore seleciona o mesmo trecho.
- Para cada trecho, três dimensões separadas: **estrutura**, **natureza** (dispositivo, redação anterior, nota editorial, texto que altera outro ato, elemento estrutural, a conferir) e **vigência** (notas e estilos não decidem vigência). Leitura da IA com evidência, ambiguidade e segunda conferência.
- **Corrigir só este trecho** (alcance documento) é separado de **Criar regra para trechos semelhantes** (alcance fonte, padrão geral ou família).
  - A correção exige motivo e fica vinculada à versão exata do documento (hash do conteúdo) e à identidade do trecho.
  - Nas novas análises ela é **aplicada** sobre o resultado do motor. A tela mostra separadamente o resultado do motor e a correção aplicada, com motivo, autor e versão da configuração.
  - Ela não se estende a outro documento. Se o documento mudar, a correção aparece como **desatualizada** e não é aplicada.
- **Nova análise deste documento** é o consumidor real. Usa o mesmo serviço de análise da prévia, com a configuração em uso (perfis e correções).
  - Cada análise fica registrada com documento, versão, configuração e correções aplicadas ou desatualizadas.
  - As análises anteriores são mantidas e listadas.
- Proposta acumulada com **Desfazer** por item; **Testar alterações** mostra antes/depois com contagens reais da amostra; **Salvar configuração** só após o teste, com confirmação na própria tela: valida e aplica numa única ação.
- Lista de **Conferência**; **Histórico** com restauração (auditada) e auditoria.
- Nenhum JSON no fluxo comum. Mensagens de erro do servidor em português, específicas (ex.: proteção de fábrica, versão desatualizada).

## Limitações
- Amostra atual: atos **sintéticos**, identificados na tela. A anatomia baseada em atos oficiais depende de acesso às fontes.
- Não há processamento em lote: só análises individuais disparadas pela tela.

## Evidências
`docs/evidence/anat-config-01/` — capturas e vídeo do fluxo completo contra a API real (harness local com banco descartável, usuários sintéticos): `e2e/anatomy-config-real.spec.ts`.
