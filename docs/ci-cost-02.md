# CI-COST-02 — CI rápido e regressão final

Governança: [tribusca-control#92](https://github.com/fabiojuniort-cyber/tribusca-control/issues/92).

## Como trabalhar

1. Abra o PR como **draft** durante implementação e envie blocos coerentes de commits.
2. Os checks rápidos validam roteamento, dependências, tipos, build e testes unitários. Corrija falhas reais dessas etapas.
3. O último gate deixa o draft vermelho com **DRAFT_FAST_ONLY**. Isso é intencional: checks rápidos não aprovam merge. **Não faça rerun nem novos commits só para eliminar esse aviso.**
4. Ao concluir a implementação, marque o PR **Ready for review**. O evento `ready_for_review` dispara a regressão completa no mesmo PR.
5. Todo novo commit de um PR pronto também executa a regressão completa. Converter novamente em draft restaura o modo rápido.
6. Antes do merge, confirme CI completo verde no head atual e revisão independente quando a governança exigir. Não use o CI rápido antigo como evidência final.

`opened`, `synchronize`, `reopened`, `ready_for_review` e `converted_to_draft` estão explícitos. O alcance de branches foi preservado. Push em `main` continua completo, sem depender de payload de PR.

Os nomes dos checks finais e a concurrency de CI-COST-01 foram preservados. Cancelamento continua limitado ao PR anterior; pushes têm grupos independentes. Não existem workflow-level `paths-ignore` nem novos runners para roteamento.

## Limites

A configuração atual de `main` não tem branch protection. O gate vermelho torna a falta de regressão completa visível, mas não impede um usuário com permissão de ignorar o procedimento e fazer merge. Esta frente não altera plano, billing, visibilidade ou proteção da branch.

A economia depende de desenvolver em draft. PRs abertos como prontos desde o primeiro commit continuam executando o CI completo em cada atualização. Minutos economizados precisam ser medidos em runs reais; duração de workflow não é equivalente ao total faturável dos jobs.

## Validação e rollback

`python3 -m unittest discover -s .github/scripts -p test_ci_plan.py` cobre drafts, ready, main, metadados inválidos, paths protegidos, diff incerto, nomes com Unicode/newline, exclusão/rename real e o gate DRAFT_FAST_ONLY.

O rollout valida os próprios PRs primeiro em draft e depois em ready, seguido de CI na main após merge. Não são necessários commits artificiais para testar os eventos.

Rollback: revert do commit squash desta frente restaura o CI completo em todo PR, preservando as melhorias independentes de CI-COST-01. Não revertê-las junto.

## Frontend

Draft mantém typecheck, Vitest, validação PNG e build normal. Não instala Chromium, não constrói o alvo demo nem executa Playwright.

PR pronto e main executam todas as etapas anteriores, inclusive build demo e Playwright, na ordem original. Dependências continuam com `npm ci` e cache npm de CI-COST-01.

Artifacts rápidos contêm `CI-MODE.txt` com `DRAFT_FAST_ONLY`; não gravam metadados alegando Chromium ou execução browser. O nome histórico do artifact foi preservado. O resumo do run identifica o modo.

Ao atualizar dependências, mantenha `package.json` e `package-lock.json` coerentes; não substitua `npm ci` por instalação não determinística no CI.
