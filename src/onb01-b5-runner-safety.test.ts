import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// These are static/policy checks only; they never invoke Docker, Fastify or PG.
// The B5 real-browser proof requires a separate, authorized opt-in run.
const atRoot = (path: string) => resolve(process.cwd(), path)
const wrapperPath = atRoot('scripts/onb01-b5-run-disposable-docker.sh')
const innerPath = atRoot('scripts/onb01-b5-run-local.sh')
const e2ePath = atRoot('e2e/onb01-b5.real.spec.ts')

describe('ONB-01-B5 test-only runner static safety', () => {
  it('parses both shell scripts without executing containers or migrations', () => {
    if (process.platform === 'win32') return // Windows runs through WSL2/Linux.
    for (const path of [wrapperPath, innerPath]) {
      const parsed = spawnSync('bash', ['-n', path], { encoding: 'utf8', timeout: 5000 })
      expect(parsed.error).toBeUndefined()
      expect(parsed.status, `bash -n failed for ${path}: ${parsed.stderr}`).toBe(0)
    }
  })

  it('owns a labeled container, local port, random secrets and teardown', () => {
    const src = readFileSync(wrapperPath, 'utf8')
    expect(src).toContain("postgres:18-bookworm")
    expect(src).toContain("--publish '127.0.0.1::5432'")
    expect(src).toContain('com.tribusca.onb01-b5.nonce')
    expect(src).toContain('openssl rand -hex')
    expect(src).toContain('docker rm -f -v')
    expect(src).toContain('unix://*')
    expect(src).toContain('npm run build')
    expect(src.indexOf('npm run build')).toBeLessThan(src.indexOf('docker run -d --rm'))
  })

  it('fails closed on backend commit, Docker identity and database before migrations', () => {
    const src = readFileSync(innerPath, 'utf8')
    expect(src).toContain('532006508aebdb8dd1f384da14b3f7cdcd2a8aa5')
    expect(src).toContain('b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a')
    expect(src).toContain('ONB01_B5_CONTAINER_ID')
    expect(src).toContain('ONB01_B5_RUN_NONCE')
    expect(src).toContain('DATABASE_ADMIN_URL')
    expect(src).toContain('radar_fiscal_onb01_b5')
    expect(src).toContain('CI=1 npx playwright test')
    expect(src.indexOf('ONB01_B5_CONTAINER_ID')).toBeLessThan(src.indexOf('npm run db:prepare'))
    expect(src.indexOf('actual_db=')).toBeLessThan(src.indexOf('npm run db:prepare'))
    expect(src.indexOf('port of [3000, 4173]')).toBeLessThan(src.indexOf('npm run db:prepare'))
  })

  it('aborts external Chromium requests without stubbing internal API routes', () => {
    const src = readFileSync(e2ePath, 'utf8')
    expect(src).toContain('context.route(EXTERNAL_HTTP_URL')
    expect(src).toContain("route.abort('blockedbyclient')")
    expect(src).toContain("serviceWorkers: 'block'")
    expect(src).toContain("blockedOrigins['https://brasilapi.com.br']")
    expect(src).not.toMatch(/page\.route\s*\(/)
    expect(src).not.toMatch(/route\.fulfill\s*\(/)
  })
})
