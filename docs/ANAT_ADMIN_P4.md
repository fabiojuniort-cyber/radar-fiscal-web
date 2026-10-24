# ANAT-ADMIN-01 / P4 — anatomy-rules admin screens

**Status:** implementation, not yet independently reviewed (tribusca-control#116). It depends on backend P3-D (radar-fiscal-backend#260) → P3-C (#259) → P3-B1 (#258).

**Not enabled for real users.**
- The route `/admin/anatomia-regras` exists only in builds with `VITE_ENABLE_ANAT_RULES_ADMIN=true` (default off → redirect to `/`).
- The backend plugin is not registered in `buildApp()` either.

## Design source
There is no separate P4 design. The screens follow the acceptance criteria T1–T8 of `docs/anatomy/ADMIN-01-P3.md` §7 (backend) and the patterns of the existing admin pages (React Query, `apiFetch`, denied state, own CSS prefix `ar-`).

Reversible choices:
- one page (rules on the left, candidate on the right, history below);
- profiles and examples edited as JSON with readable validation;
- the API's "not supported" reasons shown verbatim.

## Flow
Draft → freeze → simulate (with cancel) → compare → review → preview → confirm → history.
- **Outcomes:** `pass`, `fail`, `parcial`, `inconclusivo`, `cancelado` and `falhou` are visually distinct.
- **Review:** one decision per difference; required justification. The author is blocked, both in the UI and by the API and database. "Aprovar" is enabled only when the mirrored §2.5 rules pass; the server remains the authority.
- **Preview:** effective profile per source and family; publication and analysis counts shown as **"não suportado"**, never zero; "nothing is reprocessed".
- **Preview errors:** an expired, stale or consumed preview returns to the preview step with an explanation.
- **States:** empty, loading, failure (server code mapped to a message) and access denied.

## Tests
- **Unit:** `src/anatomy-rules-admin.test.tsx` (10, fixtures identified as such): flag, denied access, §2.5 blockers, outcome badges, author blocked, decisions sent, preview and stale confirm, review selection after approval (a regression found by the real e2e run), error texts.
- **Mocked e2e:** `e2e/anatomy-rules-admin.spec.ts`, on the 4 viewports: route off without the flag, access denied, API failure message, no horizontal overflow.
- **Real e2e:** `e2e/anatomy-rules-real.spec.ts` (only with `ANAT_REAL_API=1`): the complete flow against the **real** backend through the dev harness `radar-fiscal-backend/test/support/anatomy-admin-dev-server.ts` (real plugin, real workers, real JWT and session, disposable PostgreSQL, two synthetic admins), plus a viewport check on 1920, 390 and 360.
- **Evidence:** `docs/evidence/anat-admin-p4/*.png` (synthetic data only).

**How to run the real flow locally:**
1. Start the harness on a fresh `anat04_ci`.
2. `VITE_ENABLE_ANAT_RULES_ADMIN=true npm run build`.
3. `AUTH_PROXY_TARGET=http://127.0.0.1:3999 npx vite preview --port 4173`.
4. `ANAT_REAL_API=1 VITE_ENABLE_ANAT_RULES_ADMIN=true npx playwright test e2e/anatomy-rules-real.spec.ts`.

## Known limits
- On narrow viewports the before/after JSON columns of a difference are narrow (readable, cramped).
- The "not supported" reasons come from the API in English.
- The real-flow spec is not run in CI: it needs the backend harness and its database.
