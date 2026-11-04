# ANAT-NAV-01 — navegação hierárquica na tela "Anatomia dos atos"

Governança: tribusca-control#116, entrega 7 da matriz de progresso (comentário 6629944227). Atrás da flag `VITE_ENABLE_ANAT_CONFIG`, desligada por padrão. Não muda o contrato da API: usa só os campos `key`, `parentKey`, `depth`, `structure` e `label` que a API já devolve.

## O que muda

- **Árvore da estrutura** (`src/anatomy-tree.tsx`), no padrão WAI-ARIA *tree*:
  - `role="tree"`, `treeitem` e `group`, com `aria-level`, `aria-expanded` e `aria-selected`;
  - um único item na ordem de tabulação;
  - grupos recolhíveis.
  - Teclado: ↑ ↓, Home, End, → (expande e depois entra no filho), ← (recolhe e depois sobe ao pai), Enter ou espaço para selecionar.
- **Nome acessível de cada item:** estrutura mais o início do rótulo, truncado em 40 caracteres com "…" e nunca omitido. Assim, irmãos com a mesma estrutura (por exemplo, duas cláusulas) continuam distinguíveis.
- **Trilha "Localização do trecho"** acima do texto, com o caminho da raiz até o trecho selecionado. Cada nível é clicável.
- **Rolagem:** o trecho selecionado é trazido à vista na coluna do texto.
- Sem JSON e sem ids internos na tela.

## Testes e evidências

- `src/anatomy-tree.test.tsx` (8 testes):
  - montagem da árvore, com órfãos e ciclo de pais;
  - visibilidade de itens com grupos recolhidos;
  - semântica ARIA;
  - teclado completo;
  - clique e trilha;
  - nomes acessíveis distintos;
  - documento vazio;
  - ausência de JSON.
- Suíte completa: 308/308, com typecheck e build com a flag ligada e desligada.
- `docs/evidence/anat-nav-01/` e `docs/evidence/anat-nav-01.zip`: 12 capturas em 4 viewports (desktop, laptop, tablet, celular), com a tela real ligada ao harness de desenvolvimento do backend (`test/support/anatomy-config-dev-server.ts`, branch do #281) e só atos sintéticos. Mostram a árvore, um trecho selecionado com a trilha e um grupo recolhido.

## Limitações

- Os exemplos sintéticos atuais têm hierarquia rasa (até 2 níveis). A navegação profunda (Livro → … → item) está coberta pelos testes unitários. A demonstração visual com atos oficiais depende da cobertura oficial (rede bloqueada).
