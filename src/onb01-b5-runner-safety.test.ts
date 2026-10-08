import { describe, expect, it } from 'vitest'
import wrapper from '../scripts/onb01-b5-run-disposable-docker.sh?raw'
import inner from '../scripts/onb01-b5-run-local.sh?raw'
import e2eSource from '../e2e/onb01-b5.real.spec.ts?raw'

// Policy-only regression checks. These never start Docker, Fastify, Chromium
// or PostgreSQL, and must never be claimed as proof of a real B5 execution.
describe('ONB-01-B5 runner static isolation contracts', () => {
  it('creates and destroys a labeled PG18 container with local dynamic port and ephemeral secrets', () => {
    expect(wrapper).toContain('postgres:18-bookworm')
    expect(wrapper).toContain("--publish '127.0.0.1::5432'")
    expect(wrapper).toContain('com.tribusca.onb01-b5.nonce')
    expect(wrapper).toContain('openssl rand -hex')
    expect(wrapper).toContain('docker rm -f -v')
    expect(wrapper).toContain('unix://*')
    expect(wrapper).toContain('npm run build')
    expect(wrapper.indexOf('npm run build')).toBeLessThan(wrapper.indexOf('docker run -d --rm'))
  })

  it('checks backend head, Docker identity and PostgreSQL before migrations', () => {
    expect(inner).toContain('a42f11bf2b928ce9ec48bf41b8069f998f26af95')
    expect(inner).toContain('b07b36a9603a3fa71bd5e9e84cfd1ada9e5e449a')
    expect(inner).toContain('ONB01_B5_CONTAINER_ID')
    expect(inner).toContain('ONB01_B5_RUN_NONCE')
    expect(inner).toContain('DATABASE_ADMIN_URL')
    expect(inner).toContain('radar_fiscal_onb01_b5')
    expect(inner).toContain('CI=1 npx playwright test')
    expect(inner.indexOf('ONB01_B5_CONTAINER_ID')).toBeLessThan(inner.indexOf('npm run db:prepare'))
    expect(inner.indexOf('actual_db=')).toBeLessThan(inner.indexOf('npm run db:prepare'))
    expect(inner.indexOf('port of [3000, 4173]')).toBeLessThan(inner.indexOf('npm run db:prepare'))
  })

  it('rejects off-loopback browser traffic without mocking internal API responses', () => {
    expect(e2eSource).toContain('context.route(EXTERNAL_HTTP_URL')
    expect(e2eSource).toContain("route.abort('blockedbyclient')")
    expect(e2eSource).toContain("serviceWorkers: 'block'")
    expect(e2eSource).toContain("blockedOrigins['https://brasilapi.com.br']")
    expect(e2eSource).not.toMatch(/page\.route\s*\(/)
    expect(e2eSource).not.toMatch(/route\.fulfill\s*\(/)
  })
})
