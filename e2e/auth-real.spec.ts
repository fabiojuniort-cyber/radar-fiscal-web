import { expect, test } from '@playwright/test'

async function openLogin(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width ?? 0) <= 680) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('navigation', { name: 'Navegação móvel' })
      .getByRole('button', { name: 'Entrar' }).click()
  } else {
    await page.locator('.nav-actions').getByRole('button', { name: 'Entrar' }).click()
  }
}

test('real login, cookie refresh and logout protect the authenticated panel', async ({ page }) => {
  await page.route('**/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'radar_refresh_token=browser-test; HttpOnly; Path=/auth; SameSite=Strict' },
      body: JSON.stringify({ accessToken: 'access-test', tokenType: 'Bearer', expiresIn: 900 }),
    })
  })
  await page.route('**/auth/refresh', async (route) => {
    expect(route.request().headers()['x-csrf-protection']).toBe('1')
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ accessToken: 'refreshed-test', tokenType: 'Bearer', expiresIn: 900 }),
    })
  })
  await page.route('**/auth/me', async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer /)
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ user: { id: 'test', email: 'owner@example.test', name: null }, memberships: [
        { tenantId: 'tenant-test', tenantName: 'TriBusca Internal', tenantSlug: 'tribusca-internal', role: 'OWNER' },
      ] }),
    })
  })
  await page.route('**/auth/logout', async (route) => {
    expect(route.request().headers()['x-csrf-protection']).toBe('1')
    expect(route.request().headers().authorization).toMatch(/^Bearer /)
    await route.fulfill({ status: 204, headers: { 'set-cookie': 'radar_refresh_token=; Max-Age=0; HttpOnly; Path=/auth; SameSite=Strict' } })
  })

  await page.goto('/')
  await openLogin(page)
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill('owner@example.test')
  await dialog.getByLabel('Senha').fill('Only-For-Browser-Test!1')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Painel TriBusca' })).toBeVisible()
  await expect(page.getByText('TriBusca Internal · OWNER')).toBeVisible()

  const cookies = await page.context().cookies()
  expect(cookies.find((cookie) => cookie.name === 'radar_refresh_token')?.httpOnly).toBe(true)
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Painel TriBusca' })).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Painel TriBusca' })).toHaveCount(0)
})

test('unauthenticated direct access never renders account data', async ({ page }) => {
  await page.route('**/auth/refresh', (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_refresh_token' }),
  }))
  await page.goto('/painel')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Painel TriBusca' })).toHaveCount(0)
})
