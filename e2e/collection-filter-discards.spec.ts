import { expect, test } from '@playwright/test'

test('platform admin reviews discards and rate alerts without mutations or overflow', async ({ page }) => {
  const writes: string[] = []
  await page.route('**/auth/refresh', route => route.fulfill({ json: { accessToken: 'test-admin-token', tokenType: 'Bearer', expiresIn: 900 } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { user: { id: 'admin', email: 'admin@example.test', name: null }, memberships: [] } }))
  await page.route('**/api/v1/admin/me', route => route.fulfill({ json: { platformAdmin: true } }))
  await page.route('**/api/v1/admin/collection-filter/**', async route => {
    if (route.request().method() !== 'GET') writes.push(route.request().url())
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/state')) {
      const id='11111111-1111-4111-8111-111111111111'
      return route.fulfill({ json: {
        policies:[{id,status:'APPROVED',version:1,revision:5}],
        documents:{[id]:{id,status:'APPROVED',version:1,revision:5,rules:[],aliases:[],terms:[]}},
        newTypesOpen:0,
      } })
    }
    if (url.pathname.endsWith('/discarded')) return route.fulfill({ json: { items: [{
      id: 'discard-1', source_code: 'dou', connector_key: 'dou-inlabs', section: 'DO1', raw_type: 'PORTARIA', canonical_type: 'PORTARIA',
      title: 'Portaria administrativa para revisão', act_number: '42', published_on: '2026-10-07', official_url: 'https://www.in.gov.br/ato-42',
      reason_code: 'NO_TAX_TERM', decisive_term: null, policy_version: 1, policy_revision: 5,
      discarded_at: '2026-10-07T14:00:00Z', expires_at: '2027-01-07T14:00:00Z',
    }] } })
    if (url.pathname.endsWith('/discard-alerts')) return route.fulfill({ json: { items: url.searchParams.get('status') === 'ACKNOWLEDGED' ? [] : [{
      id: 'alert-1', collection_run_id: '01234567-89ab-4cde-8f01-234567890abc', source_code: 'dou', discard_rate: '0.9', baseline_rate: '0.4', threshold_rate: '0.65',
      found_count: 100, discard_count: 90, status: 'OPEN', created_at: '2026-10-07T14:00:00Z', acknowledged_at: null,
    }] } })
    return route.fulfill({ json: { items: [] } })
  })
  await page.goto('/admin/filtro-coleta')
  await page.getByRole('button', { name: 'Desconsiderados', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Portaria administrativa para revisão' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir fonte oficial' })).toHaveAttribute('href', 'https://www.in.gov.br/ato-42')
  await expect(page.getByText('v1 · revisão 5', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Próxima', exact: true })).toBeDisabled()
  await page.getByLabel('Fonte', { exact: true }).fill('dou')
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click()
  await expect(page.getByText('07/01/2027, 11:00:00')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Alertas de descarte', exact: true }).click()
  await expect(page.getByText('90%', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByLabel('Status do alerta').selectOption('ACKNOWLEDGED')
  await expect(page.getByText('Nenhum alerta para o status selecionado.')).toBeVisible()
  expect(writes).toEqual([])
})

test('non-admin cannot open operational discard views', async ({ page }) => {
  const requests: string[] = []
  await page.route('**/auth/refresh', route => route.fulfill({ json: { accessToken: 'test-member', tokenType: 'Bearer', expiresIn: 900 } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { user: { id: 'member', email: 'member@example.test', name: null }, memberships: [] } }))
  await page.route('**/api/v1/admin/me', route => route.fulfill({ json: { platformAdmin: false } }))
  await page.route('**/api/v1/admin/collection-filter/**', route => { requests.push(route.request().url()); return route.fulfill({ status: 403, json: { error: 'platform_admin_required' } }) })
  await page.goto('/admin/filtro-coleta')
  await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible()
  expect(requests).toEqual([])
})
