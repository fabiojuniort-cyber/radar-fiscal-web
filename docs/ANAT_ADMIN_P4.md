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

## R1 corrections (COORD review of `1269b69`)

| Finding | Correction | Evidence |
|---|---|---|
| **P4-R1-01:** a preview could survive a change of candidate | `CandidatePanel` remounts per candidate (`key`). The preview is held together with its candidate, action and scope: it is shown and confirmable only under that candidate, and a late response for a previous selection is dropped. The confirmation names the candidate, the action and the scope | Unit test `P4-R1-01`. **Reproduced on `1269b69`** with A and B both cached: A's preview stayed visible under B |
| **P4-R1-02:** freeze ignored unsaved edits | Freeze is disabled while the visible JSON differs from the content last loaded or saved, or while a save is in flight ("Há alterações não salvas…"). The saved content is exactly what was sent | Unit test `P4-R1-02`: edit after saving, save in flight, switching drafts. **Reproduced on `1269b69`**: freeze stayed enabled after an edit |

After the fixes, the real-API e2e (backend `1196cd6`, fresh disposable PostgreSQL 16) passed 12 of 12, with 8 skipped by design. Evidence screenshots were regenerated.

## R2 correction (COORD review of `2852d69`)

| Finding | Correction | Evidence |
|---|---|---|
| **P4-R2-01:** a save's response could change another draft's selection and state | Two layers. (1) While a save or a freeze is in flight, the draft list, "Novo rascunho" and both text areas are locked, with the note "Aguardando o servidor…". (2) Each save captures its edit-session identity, target (ID and revision, or creation) and the exact text sent; its response updates the saved state and the identity only if that session is still the one shown, and the success or error message is shown only for it | Tests "P4 R2" (4): slow save of A with an attempt to select B; creation in flight with an attempt to open another draft; editing while the save is pending; a late response never enables freeze for the wrong target (freeze goes to A's ID). **Reproduced on `2852d69`:** after A's slow save, the screen showed "Editando A · revisão 2" with B's content |

Results on this HEAD: web suite 257/257, typecheck, lint and build clean; real e2e against the harness on backend `2e8a15a` (fresh database, one worker): 4 passed, 4 skipped by design (the mutating flow runs on one viewport; the others check its result).
