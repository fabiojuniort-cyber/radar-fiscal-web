@AGENTS.md

# Mapa rápido — Anatomia do ato (web)

- Configuração acessível `/admin/anatomia`: `src/anatomy-config.tsx`, `anatomy-config-api.ts`, flag `VITE_ENABLE_ANAT_CONFIG` (`anatomy-config-flag.ts`).
- Admin de regras (legado P4, redireciona para a configuração quando ela está ativa): `src/anatomy-rules-admin.tsx`, `anatomy-rules-api.ts`, flag `VITE_ENABLE_ANAT_RULES_ADMIN`.
- Rotas: `src/App.tsx` (busque `anatomy`). Testes: `npx vitest run src/anatomy-*.test.tsx`; e2e `e2e/anatomy-*.spec.ts`.
- Backend, invariantes e docs: `radar-fiscal-backend/CLAUDE.md` e a skill `.claude/skills/anatomia-do-ato` de lá.
