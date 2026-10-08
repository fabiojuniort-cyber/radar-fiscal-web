#!/usr/bin/env bash
# ONB-01-B5: manual opt-in runner. Creates and destroys a dedicated PG18 container.
# Run ONLY after an authorized operator has checked out the two private repos.
set -Eeuo pipefail
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ONB01_B5_BACKEND_DIR:-$FRONTEND_DIR/backend}"
CONTAINER_ID=''

cleanup() {
  local result=$?
  trap - EXIT
  if [[ -n "$CONTAINER_ID" ]] && docker inspect "$CONTAINER_ID" >/dev/null 2>&1; then
    if ! docker rm -f -v "$CONTAINER_ID" >/dev/null 2>&1; then
      echo 'BLOCK: disposable PG18 container cleanup FAILED; operator action required' >&2
      result=2
    fi
  fi
  exit "$result"
}
trap cleanup EXIT

for command in docker node npm openssl psql pg_isready git curl; do
  if ! command -v "$command" >/dev/null; then
    echo "BLOCK: missing local prerequisite: $command" >&2; exit 2
  fi
done
if [[ "$(node --version)" != v24.* ]]; then
  echo 'BLOCK: ONB-01-B5 requires Node.js 24 for backend and Vite' >&2; exit 2
fi
if [[ -z "${ONB01_B5_BACKEND_DIR:-}" && ! -d "$BACKEND_DIR/.git" ]]; then
  echo 'BLOCK: an authorized private backend Git checkout is required' >&2; exit 2
fi
if [[ "$(git -C "$BACKEND_DIR" rev-parse HEAD 2>/dev/null)" != '532006508aebdb8dd1f384da14b3f7cdcd2a8aa5' ]]; then
  echo 'BLOCK: backend private checkout must be pinned to PR #190 immutable SHA' >&2; exit 2
fi
if ! git -C "$FRONTEND_DIR" merge-base --is-ancestor 'b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a' HEAD; then
  echo 'BLOCK: frontend B5 must descend from PR #83 immutable SHA' >&2; exit 2
fi
# A pinned HEAD alone does not prove the working tree is pristine.
# Make sure source is exactly the committed SHA before builds or test evidence.
for path in "$BACKEND_DIR" "$FRONTEND_DIR"; do
  if ! git -C "$path" diff --quiet HEAD -- || ! git -C "$path" diff --cached --quiet; then
    echo 'BLOCK: tracked files differ from committed Git SHA' >&2; exit 2
  fi
done
# Never trust a stale dist/ produced by a different checkout or commit.
# Compile the immutable backend source before provisioning the test database.
(
  cd "$BACKEND_DIR"
  npm run build
)
if [[ ! -f "$BACKEND_DIR/dist/server.js" ]]; then
  echo 'BLOCK: immutable backend build did not produce dist/server.js' >&2; exit 2
fi
if ! docker info >/dev/null 2>&1; then
  echo 'BLOCK: local Docker daemon unavailable' >&2; exit 2
fi
# Remote Docker daemons could publish 127.0.0.1 on a different machine.
# Fail closed: this wrapper is intentionally WSL2/Linux with a Unix socket.
if [[ -n "${DOCKER_HOST:-}" && "${DOCKER_HOST}" != unix://* ]]; then
  echo 'BLOCK: remote Docker host is not an isolated local runner' >&2; exit 2
fi
docker_endpoint="$(docker context inspect "$(docker context show)" --format '{{ (index .Endpoints "docker").Host }}' 2>/dev/null || :)"
if [[ "$docker_endpoint" != unix://* ]]; then
  echo 'BLOCK: only local Unix-socket Docker contexts are authorized' >&2; exit 2
fi
# Do not inherit unrelated DB/auth credentials. Everything below is synthetic.
unset NODE_OPTIONS PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGOPTIONS
RUN_NONCE="$(openssl rand -hex 16)"
DB_PASSWORD="$(openssl rand -hex 24)"
APP_PASSWORD="$(openssl rand -hex 24)"
CURATOR_PASSWORD="$(openssl rand -hex 24)"
JWT_SECRET="$(openssl rand -hex 32)"
CONTAINER_ID="$(docker run -d --rm \
  --name "onb01-b5-$RUN_NONCE" \
  --label 'com.tribusca.onb01-b5=disposable' \
  --label "com.tribusca.onb01-b5.nonce=$RUN_NONCE" \
  --publish '127.0.0.1::5432' \
  --env 'POSTGRES_DB=radar_fiscal_onb01_b5' \
  --env 'POSTGRES_USER=postgres' \
  --env "POSTGRES_PASSWORD=$DB_PASSWORD" \
  postgres:18-bookworm)"
if [[ -z "$CONTAINER_ID" ]]; then
  echo 'BLOCK: failed to provision disposable PostgreSQL 18' >&2; exit 2
fi
HOST_PORT="$(docker inspect "$CONTAINER_ID" | node -e '
  let data=""; process.stdin.on("data", x => data+=x);
  process.stdin.on("end", () => {
    try {
      const row=JSON.parse(data)[0];
      const ports=row.NetworkSettings.Ports["5432/tcp"];
      if (ports.length!==1 || ports[0].HostIp!=="127.0.0.1") throw Error();
      const p=Number(ports[0].HostPort);
      if (!Number.isInteger(p) || p<1024 || p>65535) throw Error();
      process.stdout.write(String(p));
    } catch { process.stderr.write("BLOCK: PG18 loopback port not verified\\n"); process.exitCode=2; }
  });
')"
export NODE_ENV=test ONB01_B5_RUNNER_MODE='isolated-postgres-service'
export ONB01_B5_CONTAINER_ID="$CONTAINER_ID" ONB01_B5_RUN_NONCE="$RUN_NONCE"
export DATABASE_ADMIN_URL="postgresql://postgres:$DB_PASSWORD@127.0.0.1:$HOST_PORT/radar_fiscal_onb01_b5"
export DATABASE_URL="postgresql://radar_app_runtime:$APP_PASSWORD@127.0.0.1:$HOST_PORT/radar_fiscal_onb01_b5"
export DB_RUNTIME_PASSWORD="$APP_PASSWORD" DB_CURATOR_RUNTIME_PASSWORD="$CURATOR_PASSWORD"
export JWT_ACCESS_SECRET="$JWT_SECRET"
export AUTH_REFRESH_COOKIE_NAME='radar_refresh_token'
export PUBLIC_API_ALLOWED_ORIGINS='http://127.0.0.1:4173'
ready=0
for _ in $(seq 1 45); do
  if pg_isready -q -h 127.0.0.1 -p "$HOST_PORT" -U postgres -d radar_fiscal_onb01_b5; then
    ready=1; break
  fi
  sleep 1
done
if [[ "$ready" -ne 1 ]]; then
  echo 'BLOCK: disposable PostgreSQL 18 did not become ready' >&2; exit 2
fi
echo 'Isolated PostgreSQL 18 ready; running guarded ONB-01-B5 integration harness.'
bash "$FRONTEND_DIR/scripts/onb01-b5-run-local.sh"
# EXIT trap removes container and its anonymous volumes even if tests fail.
