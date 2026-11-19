import { expect, test } from '@playwright/test'

const token = 's'.repeat(43)
const password = 'Senha-Sintetica!123'
test.beforeEach(async ({ page }) => {
  // The scenarios use only local assets and mocked same-origin APIs.
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin !== 'http://127.0.0.1:4173') return route.abort()
    if (url.pathname.startsWith('/public/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], generatedAt: '2026-11-19T00:00:00Z' }) })
    if (url.pathname.startsWith('/auth/')) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
    return route.continue()
  })
})

test('scenario 1: recovery request returns only the neutral message', async ({ page }) => {
  let requests = 0
  await page.route('**/auth/password/forgot', async route => {
    requests++
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ email: 'conta@example.test' })
    await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ status: 'if_account_exists' }) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click()
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await page.getByLabel('E-mail', { exact: true }).fill('conta@example.test')
  await page.getByRole('button', { name: 'Enviar instruções' }).click()
  await expect(page.getByRole('status')).toContainText('Se houver uma conta elegível')
  expect(requests).toBe(1)
})

for (const resetPath of ['/nova-senha', '/nova-senha/']) {
test('scenario 2: opening ' + resetPath + ' cleans its fragment and does not consume it', async ({ page }) => {
  let resetRequests = 0
  await page.route('**/auth/password/reset', async route => { resetRequests++; await route.fulfill({ status: 204 }) })
  const response = await page.goto(resetPath + '#token=' + token)
  expect(response?.status()).toBe(200)
  expect(response?.headers()['referrer-policy']).toBe('no-referrer')
  expect(response?.headers()['cache-control']).toContain('no-store')
  const csp = response?.headers()['content-security-policy'] ?? ''
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("connect-src 'self'")
  expect(csp).toContain("frame-ancestors 'none'")
  expect(csp).not.toContain('unsafe-eval')
  await expect(page).toHaveURL('http://127.0.0.1:4173' + resetPath)
  await expect(page.getByRole('heading', { name: 'Nova senha', exact: true })).toBeVisible()
  expect(resetRequests).toBe(0)
  expect(await page.content()).not.toContain(token)
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(token)
})

test('query-only token on ' + resetPath + ' is removed without being accepted', async ({ page }) => {
  let resetRequests = 0
  await page.route('**/auth/password/reset', async route => { resetRequests++; await route.fulfill({ status: 204 }) })
  const response = await page.goto(resetPath + '?token=' + token)
  expect(response?.headers()['cache-control']).toBe('no-store')
  await expect(page).toHaveURL('http://127.0.0.1:4173' + resetPath)
  await expect(page.getByRole('button', { name: 'Salvar nova senha' })).toBeDisabled()
  expect(resetRequests).toBe(0)
  expect(await page.content()).not.toContain(token)
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(token)
})
}

test('scenario 3: voluntary password reset submits once and returns to login after 204', async ({ page }) => {
  let resets = 0
  await page.route('**/auth/password/reset', async route => {
    resets++
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({ token, password, confirmPassword: password })
    expect(route.request().headers().referer).toBeUndefined()
    await route.fulfill({ status: 204 })
  })
  await page.goto('/nova-senha#token=' + token)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Salvar nova senha' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/?entrar=1')
  await expect(page.getByRole('heading', { name: 'Entrar na TriFaros' })).toBeVisible()
  expect(resets).toBe(1)
})
