# F2 — integração revisável de web #141 e #142

Data04/11/2026. Controle#124; autorização6642917997. Sem merge em main, deploy ou operação produtiva.

## Composição e conflitos

Base main3489453c5f991d02e053a5e9eaec5717cc21b5e3 (revalidada ao preparar).
- Merge isolado #141 b74678a7d463f2a928de5ece333831d7da401777 →2ce259953d865e3c9479e4d64d622e3aed947b89.
- Merge isolado #142 3b34075193f11c54b8dafc1bb34588956a9b1cd7 →e9f0450860e907d8cf51859a9ec035377968454f.
- Ambos são merges de dois pais, sem rebase/squash/reescrita. Nada foi enviado à main.
- Conjuntos de arquivos não se sobrepõem. Árvore combinada antes deste complemento documental muda exatamente14 arquivos, nenhum removido. Os12 arquivos de produto/teste conservam os blobs dos HEADs revisados. Só os2 docs antigos recebem estado atual, mais este documento novo.
- Outros PRs abertos não foram incorporados nem alterados. #140 ANAT não sobrepõe esses caminhos; #111 é a entrega antiga portada por #141. Há sobreposição potencial com #95 (API de filtros) e #85 (e2e launch), não conflito contra a main atual; ambos permanecem intactos. #126/#121/#120/#117/#90/#81 não sobrepõem os14 caminhos. Manter melhorias já presentes na main; não substituir pelo código antigo de #111.

## AS IS / TO BE / impacto

AS IS: main contém perfil com identidade por rótulo e fluxo anterior de Salvar; dois incrementos separados estão tecnicamente revisados/CI verde. Nenhuma integração desses incrementos foi realizada em produção.
TO BE do pacote já aprovado: salvar Excluir confirma/purga apenas elegíveis; KEEP não destrutivo; perfil usa identidade por código. Não há requisito novo.
Impacto: apenas web e testes/docs. Backend/contratos/migrations/tenant/expectedVersion/taxonomia/proteções preservados; não há backfill. O usuário pode confirmar uma exclusão pelo fluxo explícito existente após futura liberação; esta preparação não executa a ação.

## Gates

CI original #14141908237120 e #14241908172089 verdes não substituem CI combinado. Disparar o novo PR ready para regressão integral no HEAD final; não alterar testes/gates para obter verde. Os24 ignorados de cada suite anterior não são provas executadas. Revisões independentes de produto estão nos comentários6642909957/6642909571; delta de composição/docs deve ser conferido no SHA final. Sem autoaprovação.

## Efeitos de merge/autodeploy — fatos e limite

Um futuro merge/push em main aciona o Frontend CI conforme .github/workflows/ci.yml. Nenhuma autorização para esse merge foi dada.
GitHub commit status da main3489453c registra Railway success em31/10/2026, contexto tribusca-web-preview-web05 / web05-preview e descrição www.trifaros.com.br, deployment48f2557d-b050-4ace-8122-35f5f781970b. Isso prova associação histórica daquele commit/deploy, **não a configuração atual de autodeploy/checkSuites/branch**.
Consulta nativa railway status não concluiu comprovação: refreshOAuth não pôde persistir sessão (acesso negado). Não foram alteradas autenticação, variáveis ou configuração e nenhum Railway AI Agent foi usado. A vinculação atual/branch/gates/autodeploy é NOT_PROVEN por essa leitura; não afirmar que esperar CI garante impedir deploy após merge.
Consequência conservadora para decisão: tratar futuro merge em main como potencial publicação imediata da web e exigir conferir a configuração nativa antes de autorização final. Não desligar/autorização presumida. Backend/worker/scheduler não são modificados por este pacote web; nenhum deploy deles proposto.

## Verificações para a futura etapa, sem executar produção

1. Revalidar base/head e diff do pacote, CI integral SUCCESS e revisão do delta no HEAD exato; se main avançar, reconciliar em novo commit e gates proporcionais.
2. Confirmar nativamente serviço/ambiente/branch/build/start e regra real de autodeploy/checkSuites; manter flag/dados/configuração sem alteração. Se não houver evidência, relatar NOT_PROVEN antes da decisão de merge.
3. Somente após autorização específica do Fábio para pacote/HEAD, integrar e observar SHA resultante, status terminal do deploy e domínio alvo. Preparação não equivale a autorização.
4. Smoke inicialmente só leitura: carregamento web, navegação/perfil existente e ausência de regressão visual. Não confirmar exclusão real nem salvar perfil produtivo como smoke sem autorização própria. Preview/confirm destrutivo usa laboratório e dados sintéticos, não clientes reais.
5. Se houver erro, preservar evidências e propor recuperação. Um revert é commit novo e pode gerar outro autodeploy; não executar automaticamente.

Avanço Frente2 permanece6%/3de50 até reconciliação do marco de aceite; revisão técnica não é integração/liberação produtiva.
