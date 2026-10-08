import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

// ONB-01-B5: never mock /auth, /api, /public or responses from the internal server.
// The sole browser route aborts requests to NON-loopback origins (deny-only).
// Browser -> Vite preview proxy -> Fastify -> isolated PostgreSQL 18.
const PASSWORD = 'B5-Test-Only-Strong!2026'
const OFFICIAL_CODE = '6201501'
const OFFICIAL_DESCRIPTION = 'Desenvolvimento de programas de computador sob encomenda'
const INVALID_CODE = '9999999'

// This test must not contact external CNPJ providers from Chromium. The app
// tries an independent browser-side BrasilAPI fallback after backend 503.
// Only off-loopback origins match this route; internal routes are untouched.
const EXTERNAL_HTTP_URL = /^https?:\\/\\/(?!127\\.0\\.0\\.1:4173(?:\\/|$)).+/i
type EgressAudit = { blockedOrigins: Record<string, number> }

async function blockBrowserExternalEgress(context: BrowserContext, audit: EgressAudit): Promise<void> {
  await context.route(EXTERNAL_HTTP_URL, async (route) => {
    const origin = new URL(route.request().url()).origin
    audit.blockedOrigins[origin] = (audit.blockedOrigins[origin] ?? 0) + 1
    await route.abort('blockedbyclient')
  })
}
test.use({ serviceWorkers: 'block' })

function cnpj(root: string, branch = '0001'): string {
  const first12 = root + branch
  const check = (digits: string, weights: number[]) => {
    const remainder = [...weights].reduce((sum, w, i) => sum + w * Number(digits[i]), 0) % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  const first = check(first12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return first12 + first + check(first12 + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
}

type Signup = { user: { id: string }, tenant: { id: string } }
type Login = { accessToken: string }
type DbState = {
  user_count: number
  tenant_count: number
  company_count: number
  establishment_count: number
  company_cnae_count: number
  branch_root_ok: boolean
  global_description: string
  invalid_global_count: number
}

function databaseState(email: string, targetCnpj: string): DbState {
  const adminUrl = process.env.DATABASE_ADMIN_URL
  if (!adminUrl || process.env.ONB01_B5_RUNNER_MODE !== 'isolated-postgres-service') {
    throw new Error('B5 requires explicitly confirmed disposable PG18; refusing SQL')
  }
  const sql = `
    SELECT row_to_json(s) FROM (
      SELECT
        (SELECT count(*)::int FROM app_users WHERE email = :'email') AS user_count,
        (SELECT count(*)::int FROM tenant_memberships m JOIN app_users u ON m.user_id=u.id
           WHERE u.email = :'email') AS tenant_count,
        (SELECT count(*)::int FROM companies c JOIN tenant_memberships m ON m.tenant_id=c.tenant_id
           JOIN app_users u ON u.id=m.user_id
           WHERE u.email=:'email' AND c.head_office_cnpj=:'cnpj') AS company_count,
        (SELECT count(*)::int FROM establishments e JOIN companies c ON c.id=e.company_id
           JOIN tenant_memberships m ON m.tenant_id=c.tenant_id JOIN app_users u ON u.id=m.user_id
           WHERE u.email=:'email' AND e.cnpj=:'cnpj' AND e.is_head_office=true) AS establishment_count,
        (SELECT count(*)::int FROM company_cnaes cc JOIN companies c ON c.id=cc.company_id
           JOIN tenant_memberships m ON m.tenant_id=c.tenant_id JOIN app_users u ON u.id=m.user_id
           WHERE u.email=:'email' AND c.head_office_cnpj=:'cnpj' AND cc.cnae_code='6201501'
           AND cc.is_primary=true) AS company_cnae_count,
        (SELECT bool_and(left(e.cnpj, 8)=left(c.head_office_cnpj, 8))
           FROM establishments e JOIN companies c ON c.id=e.company_id
           WHERE c.head_office_cnpj=:'cnpj') IS DISTINCT FROM FALSE AS branch_root_ok,
        (SELECT description FROM cnaes WHERE code='6201501') AS global_description,
        (SELECT count(*)::int FROM cnaes WHERE code='9999999') AS invalid_global_count
    ) s;
  `
  const result = spawnSync('psql', [
    '--no-psqlrc', '-X', '-q', '-t', '-A', '-v', 'ON_ERROR_STOP=1',
    '-v', 'email=' + email, '-v', 'cnpj=' + targetCnpj, adminUrl,
  ], { encoding: 'utf8', input: sql, timeout: 10_000 })
  if (result.status !== 0) {
    throw new Error('B5 isolated PG18 SQL assertion failed (details withheld; inspect runner log)')
  }
  const row = result.stdout.trim().split('\n').filter(Boolean).at(-1)
  if (!row) throw new Error('B5 SQL assertion returned no row')
  return JSON.parse(row) as DbState
}

async function signupAndLogin(page: Page, email: string): Promise<{ tenantId: string, token: string }> {
  await page.goto('/')
  await page.locator('.nav-actions').getByRole('button', { name: 'Criar conta' }).click()
  const signupDialog = page.getByRole('dialog')
  await signupDialog.getByLabel('Nome completo').fill('Pessoa Teste B5')
  await signupDialog.getByLabel('E-mail corporativo').fill(email)
  await signupDialog.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  await signupDialog.getByLabel('Confirmar senha', { exact: true }).fill(PASSWORD)
  await signupDialog.getByLabel(/Aceite dos Termos/).check()
  const registered = page.waitForResponse(r => new URL(r.url()).pathname === '/auth/register' && r.request().method() === 'POST')
  await signupDialog.getByRole('button', { name: 'Criar conta' }).click()
  const registration = await registered
  expect(registration.status()).toBe(201)
  const signup = await registration.json() as Signup
  await expect(page.getByRole('heading', { name: 'Entrar na TriFaros' })).toBeVisible()
  const loginDialog = page.getByRole('dialog')
  await loginDialog.getByLabel('E-mail').fill(email)
  await loginDialog.getByLabel('Senha', { exact: true }).fill(PASSWORD)
  const loggedIn = page.waitForResponse(r => new URL(r.url()).pathname === '/auth/login' && r.request().method() === 'POST')
  await loginDialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  const login = await loggedIn
  expect(login.status()).toBe(200)
  const session = await login.json() as Login
  expect(session.accessToken.length).toBeGreaterThan(20)
  await expect(page).toHaveURL(/\/painel$/)
  return { tenantId: signup.tenant.id, token: session.accessToken }
}

test.skip(process.env.ONB01_B5_RUNNER_MODE !== 'isolated-postgres-service', 'B5 is opt-in and requires disposable PG18 + real Fastify')

test('ONB-01-B5: real Chromium -> Fastify -> isolated PostgreSQL 18; manual official CNAE and RLS', async ({ page, browser, request }, testInfo) => {
  test.setTimeout(150_000)
  expect(process.env.ONB01_B5_RUNNER_MODE).toBe('isolated-postgres-service')
  const emailA = 'b5-a-' + randomUUID() + '@example.test'
  const emailB = 'b5-b-' + randomUUID() + '@example.test'
  const headCnpj = cnpj('98765432')
  const rejectedCnpj = cnpj('98765431')
  const egress: EgressAudit = { blockedOrigins: {} }
  // Install before the first navigation; the API's 503 triggers browser
  // fallback to BrasilAPI. This is an ABORT, not a fake API response.
  await blockBrowserExternalEgress(page.context(), egress)
  const before = databaseState(emailA, headCnpj)
  expect(before.user_count).toBe(0)
  expect(before.company_count).toBe(0)
  expect(before.global_description).toBe(OFFICIAL_DESCRIPTION)
  const ownerA = await signupAndLogin(page, emailA)
  await page.getByRole('navigation', { name: 'Navegação do painel' })
    .getByRole('button', { name: /Empresas/ }).click()
  await page.getByLabel('CNPJ da matriz').fill(headCnpj)
  const registryCall = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/companies/from-cnpj')
  await page.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }).click()
  const registryResult = await registryCall
  expect(registryResult.status()).toBe(503)
  const manual = page.getByRole('dialog', { name: 'Continuar manualmente' })
  await expect(manual).toBeVisible()
  await manual.getByLabel('Razão social').fill('Empresa Fictícia B5')
  await manual.getByLabel('UF').selectOption('GO')
  await manual.getByRole('button', { name: 'Continuar para CNAEs' }).click()
  const cnaeDialog = page.getByRole('dialog', { name: 'Selecionar CNAEs da empresa' })
  await expect(cnaeDialog).toBeVisible()
  await cnaeDialog.getByLabel('Pesquisar CNAE oficial').fill('6201')
  await expect(cnaeDialog.getByRole('option', { name: /6201501/ })).toBeAttached()
  await cnaeDialog.getByLabel('Lista suspensa de CNAEs oficiais').selectOption(OFFICIAL_CODE)
  await cnaeDialog.getByRole('button', { name: 'Adicionar CNAE selecionado' }).click()
  const manualCreated = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/companies/manual' && r.request().method() === 'POST')
  await cnaeDialog.getByRole('button', { name: 'Concluir cadastro' }).click()
  expect((await manualCreated).status()).toBe(201)
  await expect(page.getByRole('tab', { name: /Perfil tributário/i })).toHaveAttribute('aria-selected', 'true')
  // Exercise a *real* authenticated API call with the token issued through Chromium login.
  const accountA = await request.get('/api/v1/account', {
    headers: { Authorization: 'Bearer ' + ownerA.token, 'x-tenant-id': ownerA.tenantId },
  })
  expect(accountA.status()).toBe(200)
  const bodyA = await accountA.json() as { companies: Array<{ cnpj: string, legalName: string }> }
  expect(bodyA.companies.some(c => c.cnpj === headCnpj && c.legalName === 'Empresa Fictícia B5')).toBe(true)
  const invalid = await request.post('/api/v1/companies/manual', {
    headers: { Authorization: 'Bearer ' + ownerA.token, 'x-tenant-id': ownerA.tenantId },
    data: {
      cnpj: rejectedCnpj, legalName: 'Inexistente B5', uf: 'GO',
      cnaes: [{ code: INVALID_CODE, description: 'NAO OFICIAL', isPrimary: true }],
    },
  })
  expect(invalid.status()).toBe(400)
  expect((await invalid.json()).error).toBe('invalid_cnae')
  const secondContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    serviceWorkers: 'block',
  })
  try {
    await blockBrowserExternalEgress(secondContext, egress)
    const secondPage = await secondContext.newPage()
    const ownerB = await signupAndLogin(secondPage, emailB)
    expect(ownerB.tenantId).not.toBe(ownerA.tenantId)
    const crossTenant = await request.get('/api/v1/account', {
      headers: { Authorization: 'Bearer ' + ownerB.token, 'x-tenant-id': ownerA.tenantId },
    })
    expect(crossTenant.status()).toBe(403)
    const ownAccount = await request.get('/api/v1/account', {
      headers: { Authorization: 'Bearer ' + ownerB.token, 'x-tenant-id': ownerB.tenantId },
    })
    expect(ownAccount.status()).toBe(200)
    expect((await ownAccount.json()).companies).toHaveLength(0)
  } finally {
    await secondContext.close()
  }
  const after = databaseState(emailA, headCnpj)
  const tenantB = databaseState(emailB, headCnpj)
  expect(after.user_count).toBe(1)
  expect(after.tenant_count).toBe(1)
  expect(after.company_count).toBe(1)
  expect(after.establishment_count).toBe(1)
  expect(after.company_cnae_count).toBe(1)
  expect(after.branch_root_ok).toBe(true)
  expect(after.global_description).toBe(OFFICIAL_DESCRIPTION)
  expect(after.invalid_global_count).toBe(0)
  expect(tenantB.user_count).toBe(1)
  expect(tenantB.company_count).toBe(0)
  // Evidence that the direct browser-side external fallback was prevented,
  // not silently allowed through to the public provider.
  expect(egress.blockedOrigins['https://brasilapi.com.br']).toBeGreaterThanOrEqual(1)
  await testInfo.attach('ONB01-B5-evidence.json', {
    body: JSON.stringify({
      backendSha: process.env.ONB01_B5_BACKEND_SHA,
      frontendBaselineSha: process.env.ONB01_B5_FRONTEND_BASE_SHA,
      testCommitSha: process.env.GITHUB_SHA ?? 'local-run',
      postgres: '18 / disposable', registryOutbound: '503 test-only outbound shim',
      internalEndpointMocks: 0,
      browserExternalEgressPolicy: 'deny non-loopback HTTP(S) via abort (service workers blocked)',
      blockedExternalOrigins: egress.blockedOrigins,
      signupAndLogin: true,
      manualCnaeCanonical: true, tenantIsolation: true,
      postgresReadback: { before, after, secondTenantCompanyCount: tenantB.company_count },
      deployed: false,
    }, null, 2),
    contentType: 'application/json',
  })
})
