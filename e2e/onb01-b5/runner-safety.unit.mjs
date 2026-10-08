// Shell safety unit tests with fake Docker/psql/npm. NOT a real B5 execution.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../..', import.meta.url))
const bash = process.env.ONB01_B5_TEST_BASH ?? 'bash'
const id = 'a'.repeat(64)
const volume = 'b'.repeat(64)

const fakeCli = `#!/usr/bin/env bash
set -eu
command_name="\${0##*/}"
case "$command_name" in
 git)
  case "$*" in
   *rev-parse*) echo a42f11bf2b928ce9ec48bf41b8069f998f26af95 ;;
   *ls-files*) [[ "$CASE" != extra-input ]] || echo migrations/999_untracked.sql ;;
  esac
  exit 0 ;;
 npm)
  [[ "\${DOTENV_CONFIG_PATH:-}" == /dev/null ]]
  [[ -z "\${DOTENV_CONFIG_OVERRIDE:-}\${DOTENV_CONFIG_KEY:-}\${NODE_OPTIONS:-}\${DATABASE_CURATOR_URL:-}\${DATABASE_WORKER_URL:-}\${DB_WORKER_RUNTIME_PASSWORD:-}\${PGSERVICE:-}\${PGPASSFILE:-}" ]]
  [[ "$*" == 'run build' ]] # must fail SQL before ever reaching db:prepare
  touch "$FIXTURE/build-checked"
  exit 0 ;;
 docker)
  case "$1" in
   context)
    if [[ "$2" == show ]]; then echo default; else echo unix:///fake-local-socket; fi ;;
   info)
    if [[ "$CASE" == daemon-unavailable && -f "$FIXTURE/created" ]]; then exit 1; fi ;;
   run)
    for arg in "$@"; do
     case "$arg" in com.tribusca.onb01-b5.nonce=*) echo "\${arg#*=}" > "$FIXTURE/nonce" ;; esac
    done
    touch "$FIXTURE/created"
    echo '${id}' ;;
   inspect)
    if [[ "$*" == *--format* ]]; then echo '${volume}'; else
     nonce="$(cat "$FIXTURE/nonce")"
     printf '[{"Config":{"Image":"postgres:18-bookworm","Labels":{"com.tribusca.onb01-b5":"disposable","com.tribusca.onb01-b5.nonce":"%s"},"Env":["POSTGRES_DB=radar_fiscal_onb01_b5"]},"State":{"Running":true},"NetworkSettings":{"Ports":{"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"54321"}]}},"Mounts":[{"Type":"volume","Name":"${volume}"}]}]' "$nonce"
    fi ;;
   rm) touch "$FIXTURE/removal-attempted" ;;
   ps) [[ "$CASE" != retained-resource ]] || echo '${id}' ;;
   volume) [[ "$CASE" != retained-resource ]] || echo '${volume}' ;;
   *) exit 9 ;;
  esac
  exit 0 ;;
 psql) exit 1 ;; # deliberate stop: never execute SQL or connect to any DB
 pg_isready|curl) exit 0 ;;
 *) exit 9 ;;
esac
`

for (const scenario of ['cleanup-confirmed', 'daemon-unavailable', 'retained-resource', 'dotenv-file', 'extra-input']) {
  test(`B5 shell unit / fake services: ${scenario}`, () => {
    const fixture = mkdtempSync(join(tmpdir(), 'onb01-b5-unit-'))
    try {
      const frontend = join(fixture, 'frontend')
      const backend = join(fixture, 'backend')
      const bin = join(fixture, 'bin')
      mkdirSync(join(frontend, 'scripts'), { recursive: true })
      mkdirSync(join(backend, 'dist'), { recursive: true })
      mkdirSync(bin)
      writeFileSync(join(backend, 'dist/server.js'), '// fake build output; never executed')
      for (const script of ['onb01-b5-run-disposable-docker.sh', 'onb01-b5-run-local.sh']) {
        copyFileSync(resolve(root, 'scripts', script), join(frontend, 'scripts', script))
      }
      for (const name of ['docker', 'git', 'npm', 'psql', 'pg_isready', 'curl']) {
        writeFileSync(join(bin, name), fakeCli, { mode: 0o755 })
      }
      if (scenario === 'dotenv-file') writeFileSync(join(frontend, '.env'), 'DATABASE_ADMIN_URL=forbidden')
      // Bash converts Windows paths to MSYS paths, avoiding drive-colon PATH entries.
      const invocation = 'export FIXTURE="$(cd "$1" && pwd)"; export PATH="$FIXTURE/bin:$PATH"; export ONB01_B5_BACKEND_DIR="$FIXTURE/backend"; bash "$FIXTURE/frontend/scripts/onb01-b5-run-disposable-docker.sh"'
      const result = spawnSync(bash, ['-c', invocation, 'b5-unit', fixture], {
        encoding: 'utf8', timeout: 30_000,
        env: {
          ...process.env, CASE: scenario,
          DATABASE_CURATOR_URL: 'forbidden', DATABASE_WORKER_URL: 'forbidden',
          DB_WORKER_RUNTIME_PASSWORD: 'forbidden', PGSERVICE: 'forbidden', PGPASSFILE: 'forbidden',
          NODE_OPTIONS: '--require=forbidden',
          DOTENV_CONFIG_PATH: 'forbidden', DOTENV_CONFIG_OVERRIDE: '1', DOTENV_CONFIG_KEY: 'forbidden',
          DOCKER_HOST: '', DOCKER_CONTEXT: '',
        },
      })
      assert.ifError(result.error)
      if (scenario === 'dotenv-file' || scenario === 'extra-input') {
        assert.equal(result.status, 2, result.stderr)
        assert.equal(existsSync(join(fixture, 'build-checked')), false)
        assert.equal(existsSync(join(fixture, 'created')), false)
      } else {
        assert.equal(existsSync(join(fixture, 'build-checked')), true, result.stderr)
        assert.equal(existsSync(join(fixture, 'removal-attempted')), true, result.stderr)
        // Directory uses a random per-run nonce; inspect only generated evidence.
        const listing = spawnSync(bash, ['-c', 'cat "$1"/frontend/playwright-artifacts/onb01-b5/*/TEARDOWN.json', 'b5-unit', fixture], { encoding: 'utf8' })
        const teardown = JSON.parse(listing.stdout)
        assert.equal(teardown.verified, scenario === 'cleanup-confirmed')
        assert.equal(teardown.volumeCount, 1)
        assert.equal(result.status, scenario === 'cleanup-confirmed' ? 1 : 2, result.stderr)
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true })
    }
  })
}
