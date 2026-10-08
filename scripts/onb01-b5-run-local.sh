#!/usr/bin/env bash
# ONB-01-B5: opt-in, private repos checked out in independent dirs, PG18 disposable ONLY.
set -euo pipefail
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ONB01_B5_BACKEND_DIR:-$FRONTEND_DIR/backend}"
EVIDENCE_DIR="$FRONTEND_DIR/playwright-artifacts/onb01-b5"
mkdir -p "$EVIDENCE_DIR"
BACKEND_PID=''
cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then kill "$BACKEND_PID" 2>/dev/null || :; wait "$BACKEND_PID" 2>/dev/null || :; fi
}
trap cleanup EXIT INT TERM
if [[ "${ONB01_B5_RUNNER_MODE:-}" != 'isolated-postgres-service' ]]; then
  echo 'BLOCK: B5 must run only with ONB01_B5_RUNNER_MODE=isolated-postgres-service' >&2; exit 2
fi
if [[ ! -f "$BACKEND_DIR/dist/server.js" ]]; then
  echo 'BLOCK: compiled backend must be checked out and built separately' >&2; exit 2
fi
node -e '
 for (const k of ["DATABASE_URL","DATABASE_ADMIN_URL"]) {
   const raw=process.env[k]; if(!raw) throw Error("Missing "+k);
   const u=new URL(raw);
   if (!["127.0.0.1","localhost"].includes(u.hostname)
       || u.pathname!=="/radar_fiscal_onb01_b5"
       || !["5432",""].includes(u.port)) throw Error("BLOCK: non-isolated database URL");
 }
 if(process.env.NODE_ENV!=="test") throw Error("BLOCK: NODE_ENV must be test");
'
actual_db="$(psql "$DATABASE_ADMIN_URL" -X -A -t -v ON_ERROR_STOP=1 -c "SELECT current_database() || ':' || current_setting('server_version_num')")"
if [[ "$actual_db" != radar_fiscal_onb01_b5:18* ]]; then
  echo 'BLOCK: only PostgreSQL 18 and radar_fiscal_onb01_b5 are permitted' >&2; exit 2
fi
actual_backend="$(git -C "$BACKEND_DIR" rev-parse HEAD)"
if [[ "$actual_backend" != '532006508aebdb8dd1f384da14b3f7cdcd2a8aa5' ]]; then
  echo 'BLOCK: backend immutable SHA mismatch' >&2; exit 2
fi
git -C "$FRONTEND_DIR" merge-base --is-ancestor 'b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a' HEAD || {
  echo 'BLOCK: web checkout does not descend from reference SHA' >&2; exit 2;
}
printf 'BACKEND_SHA=%s\nFRONTEND_TEST_SHA=%s\nFRONTEND_BASE_SHA=%s\nPG=%s\n' "$actual_backend" "$(git -C "$FRONTEND_DIR" rev-parse HEAD)" 'b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a' "$actual_db" > "$EVIDENCE_DIR/HEADS.txt"
export ONB01_B5_BACKEND_SHA="$actual_backend"
export ONB01_B5_FRONTEND_BASE_SHA='b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a'
(
  cd "$BACKEND_DIR"
  npm run db:prepare
)
psql "$DATABASE_ADMIN_URL" -X -v ON_ERROR_STOP=1 -f "$FRONTEND_DIR/e2e/onb01-b5/seed.sql" > "$EVIDENCE_DIR/SEED.txt"
(
  cd "$BACKEND_DIR"
  export HOST=127.0.0.1
  export PORT=3000
  export NODE_OPTIONS="--import=$FRONTEND_DIR/e2e/onb01-b5/outbound-shim.mjs"
  exec node dist/server.js
) > "$EVIDENCE_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
healthy=0
for _ in $(seq 1 40); do
  if curl --silent --fail --max-time 1 http://127.0.0.1:3000/health >/dev/null; then healthy=1; break; fi
  sleep 1
done
if [[ "$healthy" -ne 1 ]]; then echo 'BLOCK: local Fastify health probe failed' >&2; exit 1; fi
(
 cd "$FRONTEND_DIR"
 export AUTH_PROXY_TARGET='http://127.0.0.1:3000'
 npm run build
 npx playwright test e2e/onb01-b5.real.spec.ts --project=desktop-1440x900 --workers=1 --retries=0
)
printf 'COMPLETED: real Chromium -> Fastify -> isolated PostgreSQL 18\n' > "$EVIDENCE_DIR/RUN_RESULT.txt"
