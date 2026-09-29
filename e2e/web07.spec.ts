import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const routes = [
  { path: '/', slug: 'home' },
  { path: '/cobertura', slug: 'cobertura' },
  { path: '/portfolio', slug: 'portfolio' },
  { path: '/como-funciona', slug: 'como-funciona' },
  { path: '/reforma-tributaria', slug: 'reforma-tributaria' },
] as const

function parseRgb(value: string) {
  const parts = value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
  if (!parts || parts.length !== 3) throw new Error(`Unable to parse RGB: ${value}`)
  return parts as [number, number, number]
}

function relativeLuminance([r, g, b]: [number, number, number]) {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(foreground: string, background: string) {
  const l1 = relativeLuminance(parseRgb(foreground))
  const l2 = relativeLuminance(parseRgb(background))
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}

async function waitForFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
}

async function screenshot(page: Page, project: string, name: string) {
  const dir = path.join('playwright-artifacts', 'screenshots')
  await mkdir(dir, { recursive: true })
  await page.screenshot({
    path: path.join(dir, `${project}-${name}.png`),
    fullPage: true,
  })
}

async function mockPublicSources(page: Page, status = 200, delayMs = 0) {
  await page.route('**/public/v1/sources', async (route) => {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs))

    if (status !== 200) {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'public_sources_unavailable' }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-09-28T14:00:00.000Z',
        items: [
          {
            code: 'dou',
            name: 'DOU — Diário Oficial da União (INLABS)',
            jurisdictionLevel: 'FEDERAL',
            uf: null,
            isActive: true,
            status: 'ONLINE',
            lastRunStatus: 'SUCCESS',
            lastSuccessAt: '2026-09-28T13:30:00.000Z',
            lastAttemptAt: '2026-09-28T13:30:00.000Z',
            importedToday: 3,
            totalPublications: 517,
          },
          {
            code: 'confaz',
            name: 'CONFAZ — Conselho Nacional de Política Fazendária',
            jurisdictionLevel: 'FEDERAL',
            uf: null,
            isActive: true,
            status: 'UNSTABLE',
            lastRunStatus: 'PARTIAL_SUCCESS',
            lastSuccessAt: '2026-09-28T12:00:00.000Z',
            lastAttemptAt: '2026-09-28T13:00:00.000Z',
            importedToday: 1,
            totalPublications: 88,
          },
          {
            code: 'nfe-encat',
            name: 'Portal Nacional NF-e/ENCAT',
            jurisdictionLevel: 'FEDERAL',
            uf: null,
            isActive: true,
            status: 'UNAVAILABLE',
            lastRunStatus: 'FETCH_FAILED',
            lastSuccessAt: null,
            lastAttemptAt: '2026-09-28T13:00:00.000Z',
            importedToday: 0,
            totalPublications: 42,
          },
          {
            code: 'sped',
            name: 'Portal SPED — gov.br',
            jurisdictionLevel: 'FEDERAL',
            uf: null,
            isActive: false,
            status: 'NOT_CONSULTED',
            lastRunStatus: null,
            lastSuccessAt: null,
            lastAttemptAt: null,
            importedToday: 0,
            totalPublications: 0,
          },
          {
            code: 'doe-sp',
            name: 'Diário Oficial do Estado de São Paulo',
            jurisdictionLevel: 'STATE',
            uf: 'SP',
            isActive: true,
            status: 'ONLINE',
            lastRunStatus: 'SUCCESS_NO_RESULTS',
            lastSuccessAt: '2026-09-28T11:15:00.000Z',
            lastAttemptAt: '2026-09-28T11:15:00.000Z',
            importedToday: 0,
            totalPublications: 91,
          },
        ],
      }),
    })
  })
}

async function openLogin(page: Page) {
  const viewport = page.viewportSize()
  if (viewport && viewport.width <= 680) {
    const returnTarget = page.getByRole('button', { name: 'Abrir menu' })
    await returnTarget.click()
    const mobileNav = page.getByRole('navigation', { name: 'Navegação móvel' })
    await mobileNav.getByRole('button', { name: 'Entrar' }).click()
    return returnTarget
  }

  const trigger = page.locator('.nav-actions').getByRole('button', { name: 'Entrar' })
  await trigger.click()
  return trigger
}

test.describe('WEB-09 — rotas, responsividade e rodapé', () => {
  for (const route of routes) {
    test(`${route.slug}: render, overflow e screenshot`, async ({ page }, testInfo) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await waitForFonts(page)

      await expect(page.locator('main')).toBeVisible()

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(
        overflow.scrollWidth,
        `horizontal overflow on ${route.path}: ${JSON.stringify(overflow)}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1)

      const footer = page.locator('.site-footer')
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toBeVisible()

      const footerLogo = footer.locator('.footer-logo')
      await expect(footerLogo).toBeVisible()
      await expect(footerLogo).toHaveAttribute('src', '/brand/tribusca-logo-horizontal-dark.png')
      await expect(footerLogo).toHaveAttribute('alt', 'TriBusca')
      const footerLogoState = await footerLogo.evaluate((element) => {
        const image = element as HTMLImageElement
        const box = image.getBoundingClientRect()
        return {
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          renderedWidth: box.width,
          renderedHeight: box.height,
          filter: getComputedStyle(image).filter,
        }
      })
      expect(footerLogoState.complete).toBe(true)
      expect(footerLogoState.naturalWidth).toBe(2172)
      expect(footerLogoState.naturalHeight).toBe(724)
      expect(footerLogoState.renderedWidth).toBeGreaterThanOrEqual(118)
      expect(footerLogoState.renderedHeight).toBeGreaterThan(30)
      expect(footerLogoState.filter).toBe('none')

      const evidenceDir = path.join('playwright-artifacts', 'screenshots')
      await mkdir(evidenceDir, { recursive: true })
      await footer.screenshot({
        path: path.join(evidenceDir, `${testInfo.project.name}-footer-${route.slug}.png`),
      })
      await screenshot(page, testInfo.project.name, route.slug)
    })
  }
})

test('WEB-07 — menu, carrossel e foco por teclado', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForFonts(page)

  const viewport = page.viewportSize()
  if (viewport && viewport.width <= 680) {
    const menuButton = page.getByRole('button', { name: 'Abrir menu' })
    await expect(menuButton).toBeVisible()
    await menuButton.click()
    const mobileNav = page.getByRole('navigation', { name: 'Navegação móvel' })
    await expect(mobileNav).toBeVisible()
    await expect(mobileNav.getByRole('link', { name: 'Cobertura' })).toBeVisible()
    await page.getByRole('button', { name: 'Fechar menu' }).click()
    await expect(mobileNav).toBeHidden()
  }

  await page.locator('body').click({ position: { x: 1, y: 1 } })
  await page.keyboard.press('Tab')
  const firstFocus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      tag: el?.tagName ?? '',
      text: el?.textContent?.trim() ?? '',
      aria: el?.getAttribute('aria-label') ?? '',
      outlineStyle: el ? getComputedStyle(el).outlineStyle : '',
      outlineWidth: el ? getComputedStyle(el).outlineWidth : '',
    }
  })
  expect(firstFocus.tag).not.toBe('BODY')
  expect(firstFocus.outlineStyle).not.toBe('none')
  expect(Number.parseFloat(firstFocus.outlineWidth)).toBeGreaterThanOrEqual(3)

  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  const returnedFocus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    return {
      tag: el?.tagName ?? '',
      text: el?.textContent?.trim() ?? '',
      aria: el?.getAttribute('aria-label') ?? '',
    }
  })
  expect(returnedFocus.tag).toBe(firstFocus.tag)
  expect(returnedFocus.text).toBe(firstFocus.text)
  expect(returnedFocus.aria).toBe(firstFocus.aria)

  const dots = page.getByRole('button', { name: /^Exibir / })
  await expect(dots).toHaveCount(5)
  const names = await dots.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
  expect(new Set(names).size).toBe(5)

  for (let index = 0; index < await dots.count(); index += 1) {
    const box = await dots.nth(index).boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(24)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
  }

  await expect(page.locator('.state-position')).toHaveText('1 / 5')
  await page.getByRole('button', { name: 'Próximo estado' }).click()
  await expect(page.locator('.state-position')).toHaveText('2 / 5')
  await page.getByRole('button', { name: 'Estado anterior' }).click()
  await expect(page.locator('.state-position')).toHaveText('1 / 5')

  await screenshot(page, testInfo.project.name, 'carousel-interaction')
})

test('WEB-16 — login modal, signup ativo, contenção de foco e Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const trigger = await openLogin(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entrar na TriBusca' })).toBeVisible()
  await expect(dialog.getByText('Recuperação de senha em breve.')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Esqueci minha senha' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Criar conta' })).toBeVisible()

  const focusInside = await dialog.evaluate((element) => element.contains(document.activeElement))
  expect(focusInside).toBe(true)

  for (let index = 0; index < 10; index += 1) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Shift+Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('WEB-11 — login uses only the real auth contract and no localStorage token', async ({ page }) => {
  let capturedMethod = ''
  let capturedBody = ''
  await page.route('**/auth/login', async (route) => {
    capturedMethod = route.request().method()
    capturedBody = route.request().postData() ?? ''
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'invalid_credentials' }),
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await openLogin(page)

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill('teste@example.com')
  await dialog.getByLabel('Senha').fill('Senha123!')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(capturedMethod).toBe('POST')
  expect(JSON.parse(capturedBody)).toEqual({
    email: 'teste@example.com',
    password: 'Senha123!',
  })

  const storedKeys = await page.evaluate(() => Object.keys(localStorage))
  expect(storedKeys).toEqual([])
})

test('AUTH-02 — signup real exige confirmação da API antes do sucesso', async ({ page }) => {
  let capturedMethod = ''
  let capturedBody = ''

  await page.route('**/auth/register', async (route) => {
    capturedMethod = route.request().method()
    capturedBody = route.request().postData() ?? ''

    const request = JSON.parse(capturedBody) as {
      email: string
      name: string
      company: string
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-auth-02',
          email: request.email.toLowerCase(),
          name: request.name,
        },
        tenant: {
          id: 'tenant-auth-02',
          name: request.company,
          slug: 'empresa-auth-02-abc',
        },
        membership: { role: 'OWNER' },
        next: 'LOGIN',
      }),
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(await page.getByText(/7 dias para conhecer/i).count()).toBeGreaterThan(0)

  const viewport = page.viewportSize()
  if (viewport && viewport.width <= 680) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const mobileNav = page.getByRole('navigation', { name: 'Navegação móvel' })
    await mobileNav.getByRole('button', { name: 'Criar conta' }).click()
  } else {
    await page.locator('.nav-actions').getByRole('button', { name: 'Criar conta' }).click()
  }

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
  await dialog.getByLabel('Nome completo').fill('Nova Pessoa')
  await dialog.getByLabel('E-mail corporativo').fill('nova.pessoa@example.com')
  await dialog.getByLabel('Empresa').fill('Empresa Nova')
  await dialog.getByLabel('CNPJ').fill('12.345.678/0001-99')
  await dialog.getByLabel('Senha').fill('Senha-Segura-2026!')
  await dialog.getByLabel('Confirmar senha').fill('Senha-Segura-2026!')
  await dialog.getByLabel(/Li e aceito os Termos/).check()

  await dialog.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page.getByRole('heading', { name: 'Entrar na TriBusca' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Conta criada com sucesso')
  await expect(page.getByLabel('E-mail')).toHaveValue('nova.pessoa@example.com')

  expect(capturedMethod).toBe('POST')
  expect(JSON.parse(capturedBody)).toEqual({
    name: 'Nova Pessoa',
    email: 'nova.pessoa@example.com',
    company: 'Empresa Nova',
    cnpj: '12.345.678/0001-99',
    password: 'Senha-Segura-2026!',
    confirmPassword: 'Senha-Segura-2026!',
    acceptedTerms: true,
  })

  const storedKeys = await page.evaluate(() => Object.keys(localStorage))
  expect(storedKeys).toEqual([])
})

test('AUTH-02 — signup duplicado permanece no formulário sem falso sucesso', async ({ page }) => {
  await page.route('**/auth/register', async (route) => {
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'email_already_registered' }),
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const viewport = page.viewportSize()
  if (viewport && viewport.width <= 680) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    const mobileNav = page.getByRole('navigation', { name: 'Navegação móvel' })
    await mobileNav.getByRole('button', { name: 'Criar conta' }).click()
  } else {
    await page.locator('.nav-actions').getByRole('button', { name: 'Criar conta' }).click()
  }

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nome completo').fill('Pessoa Existente')
  await dialog.getByLabel('E-mail corporativo').fill('existente@example.com')
  await dialog.getByLabel('Empresa').fill('Empresa Existente')
  await dialog.getByLabel('Senha').fill('Senha-Segura-2026!')
  await dialog.getByLabel('Confirmar senha').fill('Senha-Segura-2026!')
  await dialog.getByLabel(/Li e aceito os Termos/).check()
  await dialog.getByRole('button', { name: 'Criar conta' }).click()

  await expect(dialog.getByRole('alert')).toContainText('Este e-mail já está cadastrado')
  await expect(dialog.getByRole('heading', { name: 'Criar conta' })).toBeVisible()
  await expect(dialog.getByText(/Conta criada com sucesso/)).toHaveCount(0)
})

test('WEB-07 — Sonar, fontes, footer e reduced motion no build real', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' })
  await waitForFonts(page)

  expect(await page.evaluate(() => document.fonts.check('16px Inter'))).toBe(true)
  const bodyFont = await page.locator('body').evaluate((element) => getComputedStyle(element).fontFamily)
  expect(bodyFont.toLowerCase().startsWith('inter')).toBe(true)

  const footerLogo = page.locator('.footer-logo')
  await expect(footerLogo).toHaveAttribute('src', '/brand/tribusca-logo-horizontal-dark.png')
  const footerFilter = await footerLogo.evaluate((element) => getComputedStyle(element).filter)
  expect(footerFilter).toBe('none')

  const levels = [
    { selector: '.sonar-state-high strong', minimum: 4.5 },
    { selector: '.sonar-state-medium strong', minimum: 4.5 },
    { selector: '.sonar-state-low strong', minimum: 4.5 },
  ]
  for (const level of levels) {
    const color = await page.locator(level.selector).evaluate((element) => getComputedStyle(element).color)
    expect(contrastRatio(color, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(level.minimum)
  }

  for (const selector of ['.sonar-high .sonar-ping', '.sonar-medium .sonar-ping', '.sonar-low .sonar-ping']) {
    const color = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).backgroundColor)
    expect(contrastRatio(color, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(3)
  }

  await expect(page.getByText('Média afinidade')).toBeVisible()
  await expect(page.getByText('Baixa afinidade')).toBeVisible()
  expect((await page.getByText('Alta afinidade').count())).toBeGreaterThan(0)

  const sweepAnimation = await page.locator('.sonar-sweep').first().evaluate((element) => getComputedStyle(element).animationName)
  const pingAnimation = await page.locator('.sonar-ping').first().evaluate((element) => getComputedStyle(element).animationName)
  expect(sweepAnimation).toBe('none')
  expect(pingAnimation).toBe('none')

  const stylesheetHref = await page.locator('link[rel="stylesheet"]').getAttribute('href')
  expect(stylesheetHref).toBeTruthy()
  const cssResponse = await page.request.get(new URL(stylesheetHref!, page.url()).href)
  expect(cssResponse.ok()).toBe(true)
  const css = (await cssResponse.text()).toLowerCase()

  for (const affinityColor of ['#c92a2a', '#9a6900', '#237032', '#2b8a3e']) {
    const blocks = css
      .split('}')
      .filter((block) => block.includes(affinityColor))
    expect(blocks.length, `no CSS rule found for ${affinityColor}`).toBeGreaterThan(0)
    for (const block of blocks) {
      const selector = block.split('{')[0]
      expect(selector, `${affinityColor} leaked outside Sonar: ${selector}`).toContain('sonar')
    }
  }
})

test('WEB-11 — claims públicos e Cobertura com API oficial', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Em desenvolvimento')).toHaveCount(6)
  await expect(page.getByText('Disponível', { exact: true })).toHaveCount(0)

  await mockPublicSources(page, 200, 350)
  await page.goto('/cobertura', { waitUntil: 'domcontentloaded' })

  const stateCards = page.locator('[data-testid="state-coverage-card"]')
  await expect(stateCards).toHaveCount(27)
  await expect(stateCards.first()).toContainText('São Paulo / SP')

  const federalCards = page.locator('[data-testid="federal-coverage-card"]')
  const douCard = federalCards.filter({ hasText: 'DOU / INLABS' }).first()
  await expect(douCard.locator('.collection-status')).toHaveText('—')
  await expect(douCard.locator('.coverage-metrics dd')).toHaveText(['—', '—', '—'])

  await expect(douCard.locator('.collection-status')).toHaveText('Online')
  await expect(douCard).toContainText('3')
  await expect(douCard).toContainText('517')
  await expect(douCard).toContainText('10:30')

  const confazCard = federalCards.filter({ hasText: 'CONFAZ' }).first()
  await expect(confazCard.locator('.collection-status')).toHaveText('Em validação')

  const nfeCard = federalCards.filter({ hasText: 'NF-e / ENCAT' }).first()
  await expect(nfeCard.locator('.collection-status')).toHaveText('Em validação')
  await expect(nfeCard.locator('.coverage-metrics dd').first()).toHaveText('—')

  const spedCard = federalCards.filter({ hasText: 'SPED' }).first()
  await expect(spedCard.locator('.collection-status')).toHaveText('Em implantação')

  const goCard = stateCards.filter({ hasText: 'Goiás / GO' }).first()
  await expect(goCard.locator('.collection-status')).toHaveText('Em implantação')
  await expect(goCard.locator('.coverage-metrics dd')).toHaveText(['—', '—', '—'])
})

test('WEB-11 — Coverage failure never invents current data', async ({ page }) => {
  await mockPublicSources(page, 503)

  const responsePromise = page.waitForResponse('**/public/v1/sources')
  await page.goto('/cobertura', { waitUntil: 'domcontentloaded' })
  await responsePromise

  const statuses = page.locator('.collection-status')
  expect(await statuses.count()).toBeGreaterThan(27)
  for (let index = 0; index < await statuses.count(); index += 1) {
    await expect(statuses.nth(index)).toHaveText('—')
  }

  const metrics = page.locator('.coverage-metrics dd')
  for (let index = 0; index < await metrics.count(); index += 1) {
    await expect(metrics.nth(index)).toHaveText('—')
  }
})


test('WEB-14 — modo demonstração navega sem autenticação ou chamadas privadas', async ({ page }, testInfo) => {
  const appRequests: string[] = []
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) {
      appRequests.push(request.url())
    }
  })

  await page.goto('/como-funciona', { waitUntil: 'domcontentloaded' })
  await waitForFonts(page)
  await openLogin(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Entrar em modo demonstração' })).toBeVisible()
  await expect(dialog.getByText('Acesso temporário para navegação e validação da interface.')).toBeVisible()

  await dialog.getByRole('button', { name: 'Entrar em modo demonstração' }).click()
  await expect(page).toHaveURL(/\/painel-demo$/)
  await expect(page.getByText('Modo demonstração').first()).toBeVisible()
  await expect(page.getByText('Dados exibidos nesta área são demonstrativos.')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegação do painel demonstrativo' })).toBeVisible()
  await expect(page.getByText('Demonstração', { exact: true })).toHaveCount(6)
  expect(appRequests).toEqual([])

  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/painel-demo$/)
  await expect(page.getByText('Modo demonstração').first()).toBeVisible()
  expect(appRequests).toEqual([])

  await page.getByRole('button', { name: 'Publicações' }).click()
  await expect(page.getByRole('heading', { name: 'Publicações' })).toBeVisible()
  expect(appRequests).toEqual([])

  await screenshot(page, testInfo.project.name, 'painel-demo')

  await page.getByRole('button', { name: 'Menu do usuário' }).click()
  await page.getByRole('button', { name: 'Sair da demonstração' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', {
    name: 'Saiba o que mudou. Entenda o que importa. Chegue à fonte oficial.',
  })).toBeVisible()
  expect(appRequests.filter((url) => /\/auth\//.test(url))).toEqual([])
  expect(appRequests.every((url) => url.includes('/public/v1/sources'))).toBe(true)
})
