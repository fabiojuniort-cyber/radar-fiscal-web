#!/usr/bin/env bash
# ONB-01-B5: manual opt-in runner. Creates and destroys a dedicated PG18 container.
# Run ONLY after an authorized operator has checked out the two private repos.
set -Eeuo pipefail
# Sanitize before even invoking Node's version/build preflight.
unset NODE_OPTIONS DOTENV_KEY DATABASE_URL DATABASE_ADMIN_URL DATABASE_CURATOR_URL DATABASE_WORKER_URL
unset DB_RUNTIME_PASSWORD DB_WORKER_RUNTIME_PASSWORD DB_CURATOR_RUNTIME_PASSWORD
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGOPTIONS PGSERVICE PGSERVICEFILE PGPASSFILE
while IFS= read -r name; do unset "$name"; done < <(compgen -A variable DOTENV_CONFIG_ || :)
export DOTENV_CONFIG_PATH=/dev/null
FRONTEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ONB01_B5_BACKEND_DIR:-$FRONTEND_DIR/backend}"
CONTAINER_ID=''
CONTAINER_VOLUMES=()
EVIDENCE_DIR="$FRONTEND_DIR/playwright-artifacts/onb01-b5"

cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if [[ -n "$CONTAINER_ID" ]]; then
    local verified=true
    # An inspect failure alone cannot prove deletion: the daemon may be down.
    docker rm -f -v "$CONTAINER_ID" >/dev/null 2>&1 || :
    if ! docker info >/dev/null 2>&1; then
      verified=false
    else
      local remaining
      remaining="$(docker ps -aq --no-trunc --filter "id=$CONTAINER_ID")" || verified=false
      [[ -z "$remaining" ]] || verified=false
      for volume in "${CONTAINER_VOLUMES[@]}"; do
        remaining="$(docker volume ls -q --filter "name=^${volume}$")" || verified=false
        [[ -z "$remaining" ]] || verified=false
      done
    fi
    mkdir -p "$EVIDENCE_DIR"
    printf '{"containerAbsent":%s,"anonymousVolumesAbsent":%s,"volumeCount":%s,"verified":%s}\n' \
      "$verified" "$verified" "${#CONTAINER_VOLUMES[@]}" "$verified" > "$EVIDENCE_DIR/TEARDOWN.json"
    if [[ "$verified" != true ]]; then
      echo 'BLOCK: disposable PG18 teardown NOT_PROVEN; operator action required' >&2
      result=2
    fi
  fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

for command in docker node npm openssl psql pg_isready git curl; do
  if ! command -v "$command" >/dev/null; then
    echo "BLOCK: missing local prerequisite: $command" >&2; exit 2
  fi
done
if [[ "$(node --version)" != v24.* ]]; then
  echo 'BLOCK: ONB-01-B5 requires Node.js 24 for backend and Vite' >&2; exit 2
fi
if [[ "$(git -C "$BACKEND_DIR" rev-parse HEAD 2>/dev/null)" != 'a42f11bf2b928ce9ec48bf41b8069f998f26af95' ]]; then
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
  # Ignored dotenv files and extra source/migrations are outside the pinned SHA.
  for env_file in "$path"/.env "$path"/.env.*; do
    if [[ -e "$env_file" && "${env_file##*/}" != '.env.example' ]]; then
      echo 'BLOCK: dotenv input outside the committed test environment' >&2; exit 2
    fi
  done
  extra_inputs="$(git -C "$path" ls-files --others --exclude-standard -- src migrations scripts e2e public ':(top,glob)*.config.*' ':(top,glob)package*.json' ':(top,glob)tsconfig*.json')"
  ignored_inputs="$(git -C "$path" ls-files --others --ignored --exclude-standard -- src migrations scripts e2e public ':(top,glob)*.config.*' ':(top,glob)package*.json' ':(top,glob)tsconfig*.json')"
  if [[ -n "$extra_inputs" || -n "$ignored_inputs" ]]; then
    echo 'BLOCK: executable test inputs outside the committed Git manifest' >&2; exit 2
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
# Remote Docker daemons could publish 127.0.0.1 on a different machine.
# Fail closed: this wrapper is intentionally WSL2/Linux with a Unix socket.
if [[ -n "${DOCKER_HOST:-}" && "${DOCKER_HOST}" != unix://* ]]; then
  echo 'BLOCK: remote Docker host is not an isolated local runner' >&2; exit 2
fi
export DOCKER_CONTEXT="$(docker context show)"
docker_endpoint="$(docker context inspect "$DOCKER_CONTEXT" --format '{{ (index .Endpoints "docker").Host }}' 2>/dev/null || :)"
if [[ "$docker_endpoint" != unix://* ]]; then
  echo 'BLOCK: only local Unix-socket Docker contexts are authorized' >&2; exit 2
fi
# Do not inherit unrelated DB/auth credentials. Everything below is synthetic.
unset DOCKER_HOST
if ! docker info >/dev/null 2>&1; then
  echo 'BLOCK: local Docker daemon unavailable' >&2; exit 2
fi
RUN_NONCE="$(openssl rand -hex 16)"
EVIDENCE_DIR="$FRONTEND_DIR/playwright-artifacts/onb01-b5/$RUN_NONCE"
export ONB01_B5_EVIDENCE_DIR="$EVIDENCE_DIR"
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
mapfile -t CONTAINER_VOLUMES < <(docker inspect "$CONTAINER_ID" --format '{{range .Mounts}}{{if eq .Type "volume"}}{{println .Name}}{{end}}{{end}}' | sed '/^$/d')
if [[ "${#CONTAINER_VOLUMES[@]}" -ne 1 || ! "${CONTAINER_VOLUMES[0]}" =~ ^[a-f0-9]{64}$ ]]; then
  echo 'BLOCK: anonymous PostgreSQL volume identity not verified' >&2; exit 2
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
export DB_RUNTIME_PASSWORD="$APP_PASSWORD" DB_WORKER_RUNTIME_PASSWORD="$APP_PASSWORD" DB_CURATOR_RUNTIME_PASSWORD="$CURATOR_PASSWORD"
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
