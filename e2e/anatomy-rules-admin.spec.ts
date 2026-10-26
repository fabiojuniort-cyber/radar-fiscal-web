import { expect, test, type Page } from '@playwright/test'

/**
 * ANAT-ADMIN-01 P4 — central paths with MOCKED responses (fixtures, identified as such): access denied, the route is off
 * without the build flag, and error states. The real flow is covered by anatomy-rules-real.spec.ts.
 */
const enabled = process.env.VITE_ENABLE_ANAT_RULES_ADMIN === 'true'
async function session(page: Page, admin: boolean) {
  await page.route('**/auth/refresh', (r) => r.fulfill({ json: { accessToken: 'fixture-token', tokenType: 'Bearer', expiresIn: 900 } }))
  await page.route('**/auth/me', (r) => r.fulfill({ json: { user: { id: '11111111-1111-4111-8111-111111111111', email: 'fixture@example.test', name: 'Fixture' }, memberships: [] } }))
  await page.route('**/api/v1/admin/me', (r) => r.fulfill({ json: { platformAdmin: admin, taxonomyCurator: false, licenseBypass: admin, curatorDatabase: false } }))
}

test('sem a flag de build a rota não existe para usuários', async ({ page }) => {
  test.skip(enabled, 'this build enables the screens')
  await session(page, true)
  await page.goto('/admin/anatomia-regras')
  await expect(page).not.toHaveURL(/anatomia-regras/u)
})

test('acesso negado para quem não é administrador', async ({ page }) => {
  test.skip(!enabled, 'needs VITE_ENABLE_ANAT_RULES_ADMIN=true')
  await session(page, false)
  await page.goto('/admin/anatomia-regras')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
})

test('falhas da API aparecem como mensagens, sem detalhes internos', async ({ page }) => {
  test.skip(!enabled, 'needs VITE_ENABLE_ANAT_RULES_ADMIN=true')
  await session(page, true)
  await page.route('**/api/v1/admin/anatomy-rules/**', (r) => r.fulfill({ status: 503, json: { error: 'audit_unavailable', correlationId: 'fixture' } }))
  await page.goto('/admin/anatomia-regras')
  await expect(page.getByRole('alert').first()).toHaveText('A auditoria está indisponível; nada foi alterado.')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})
