import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

const LOGIN_TEST_PASSWORD = ['Senha', '123!'].join('')
const SIGNUP_TEST_PASSWORD = ['Senha', 'Segura', '2026!'].join('-')

const routes = [
  { path: '/', slug: 'home' },
  { path: '/cobertura', slug: 'cobertura' },
  { path: '/portfolio', slug: 'portfolio' },
  { path: '/como-funciona', slug: 'como-funciona' },
  { path: '/reforma-tributaria', slug: 'reforma-tributaria' },
  { path: '/termos', slug: 'termos' },
  { path: '/privacidade', slug: 'privacidade' },
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

async function mockPublicPublications(page: Page) {
  await page.route('**/public/v1/publications*', async (route) => {
    const url = new URL(route.request().url())
    const uf = url.searchParams.get('uf')

    const federalItem = {
      id: 'pub-fed-1',
      title: 'Ato federal coletado de verdade',
      actType: 'INSTRUÇÃO NORMATIVA',
      actNumber: '123/2026',
      agency: 'Receita Federal',
      uf: null,
      publishedOn: '2026-09-30',
      effectiveOn: null,
      officialUrl: 'https://example.test/federal',
    }

    const stateItem = {
      ...federalItem,
      id: 'pub-sp-1',
      title: 'Publicação estadual real de São Paulo',
      actType: 'PORTARIA',
      actNumber: '45/2026',
      agency: 'SEFAZ-SP',
      uf: 'SP',
      officialUrl: 'https://example.test/sp',
    }

    const items = uf === 'SP'
      ? [stateItem]
      : uf
        ? []
        : [federalItem]

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items }),
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
      await expect(footerLogo).toHaveAttribute('src', '/brand/trifaros-logo-horizontal.png')
      await expect(footerLogo).toHaveAttribute('alt', '')
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
      expect(footerLogoState.naturalWidth).toBeGreaterThan(0)
      expect(footerLogoState.naturalHeight).toBeGreaterThan(0)
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

  const statePills = page.getByRole('tab', { name: /^Exibir / })
  await expect(statePills).toHaveCount(5)
  const names = await statePills.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label')))
  expect(new Set(names).size).toBe(5)

  for (let index = 0; index < await statePills.count(); index += 1) {
    const box = await statePills.nth(index).boundingBox()
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(24)
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(24)
  }

  const carouselPosition = page.getByTestId('state-carousel-position')
  await expect(carouselPosition).toContainText('1 / 5')
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await page.getByRole('button', { name: 'Pausar' }).click()
  await expect(page.getByRole('button', { name: 'Reproduzir' })).toBeVisible()
  await page.getByRole('button', { name: 'Reproduzir' }).click()
  await page.getByRole('button', { name: 'Próximo estado' }).click()
  await expect(carouselPosition).toContainText('2 / 5')
  await page.getByRole('button', { name: 'Estado anterior' }).click()
  await expect(carouselPosition).toContainText('1 / 5')

  await screenshot(page, testInfo.project.name, 'carousel-interaction')
})

test('WEB-16 — login modal, signup ativo, contenção de foco e Escape', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const trigger = await openLogin(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entrar na TriFaros' })).toBeVisible()
  await expect(dialog.getByText('Acesse sua conta TriFaros.')).toBeVisible()
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

test('ONB-01 — keyboard navigates password controls with explicit labels on login and signup', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await openLogin(page)
  const dialog = page.getByRole('dialog')
  const loginInput = dialog.getByLabel('Senha', { exact: true })
  const loginToggle = dialog.getByRole('button', { name: 'Mostrar senha' })
  expect(await loginInput.evaluate((el) => {
    const input = el as HTMLInputElement
    return Boolean(input.id && document.querySelector(`label[for="${input.id}"]`)) && !input.closest('label')
  })).toBe(true)
  await loginInput.focus()
  await page.keyboard.press('Tab')
  await expect(loginToggle).toBeFocused()
  await page.keyboard.press('Space')
  await expect(loginInput).toHaveAttribute('type', 'text')
  await expect(dialog.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true')

  await dialog.getByRole('button', { name: 'Criar conta' }).click()
  const signupInput = dialog.getByLabel('Senha', { exact: true })
  const confirmInput = dialog.getByLabel('Confirmar senha', { exact: true })
  for (const input of [signupInput, confirmInput]) {
    expect(await input.evaluate((el) => {
      const field = el as HTMLInputElement
      return Boolean(field.id && document.querySelector(`label[for="${field.id}"]`)) && !field.closest('label')
    })).toBe(true)
  }
  await confirmInput.focus()
  await page.keyboard.press('Tab')
  const confirmToggle = dialog.getByRole('button', { name: 'Mostrar confirmação de senha' })
  await expect(confirmToggle).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(confirmInput).toHaveAttribute('type', 'text')
  await expect(dialog.getByRole('button', { name: 'Ocultar confirmação de senha' })).toHaveAttribute('aria-pressed', 'true')
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
  await dialog.getByLabel('Senha', { exact: true }).fill(LOGIN_TEST_PASSWORD)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(capturedMethod).toBe('POST')
  expect(JSON.parse(capturedBody)).toEqual({
    email: 'teste@example.com',
    password: LOGIN_TEST_PASSWORD,
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
          name: `Conta de ${request.name}`,
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
  await dialog.getByLabel('Senha', { exact: true }).fill(SIGNUP_TEST_PASSWORD)
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill(SIGNUP_TEST_PASSWORD)
  await dialog.getByLabel(/Aceite dos Termos/).check()

  await dialog.getByRole('button', { name: 'Criar conta' }).click()

  await expect(page.getByRole('heading', { name: 'Entrar na TriFaros' })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Conta criada com sucesso')
  await expect(page.getByLabel('E-mail')).toHaveValue('nova.pessoa@example.com')

  expect(capturedMethod).toBe('POST')
  expect(JSON.parse(capturedBody)).toEqual({
    name: 'Nova Pessoa',
    email: 'nova.pessoa@example.com',
    password: SIGNUP_TEST_PASSWORD,
    confirmPassword: SIGNUP_TEST_PASSWORD,
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
  await dialog.getByLabel('Senha', { exact: true }).fill(SIGNUP_TEST_PASSWORD)
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill(SIGNUP_TEST_PASSWORD)
  await dialog.getByLabel(/Aceite dos Termos/).check()
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
  await expect(footerLogo).toHaveAttribute('src', '/brand/trifaros-logo-horizontal.png')
  const footerFilter = await footerLogo.evaluate((element) => getComputedStyle(element).filter)
  expect(footerFilter).toBe('none')

  await expect(page.getByText(/Alta.*sinal próximo ao centro/)).toBeVisible()
  await expect(page.getByText(/Média.*distância intermediária/)).toBeVisible()
  await expect(page.getByText(/Baixa.*sinal distante/)).toBeVisible()

  const sweep = page.locator('.ref-live-radar-sweep')
  await expect(sweep).toBeVisible()
  expect(await sweep.evaluate((element) => getComputedStyle(element).animationName)).toBe('none')

  const radar = page.locator('.ref-live-radar')
  const targetCount = Number(
    await radar.getAttribute('data-target-count'),
  )
  expect(targetCount).toBeGreaterThanOrEqual(1)
  expect(targetCount).toBeLessThanOrEqual(10)

  const blips = page.locator(
    '.ref-live-radar-blip:not(.is-residual)',
  )
  await expect(blips).toHaveCount(targetCount)
  for (let index = 0; index < targetCount; index += 1) {
    expect(
      await blips
        .nth(index)
        .evaluate(
          (element) =>
            getComputedStyle(element).opacity,
        ),
    ).toBe('1')
  }
})

test('WEB-19 — Sonar cycles through 25 target combinations and keeps half-turn fade', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' })

  const radar = page.locator('.ref-live-radar')
  const sweep = page.locator('.ref-live-radar-sweep')
  await expect(radar).toBeVisible()
  await expect(sweep).toBeVisible()

  await expect(radar).toHaveAttribute('data-pattern-count', '25')
  await expect(radar).toHaveAttribute('data-target-count', '1')
  await expect(radar).toHaveAttribute('data-cycle', '0')

  const sweepAnimation = await sweep.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      name: style.animationName,
      duration: style.animationDuration,
      background: style.backgroundImage,
    }
  })

  expect(sweepAnimation.name).toBe('tribuscaRadarSweep')
  expect(sweepAnimation.duration).toBe('4.8s')
  expect(sweepAnimation.background).toContain('38, 215, 200')

  const zones = page.locator('.ref-radar-zone')
  await expect(zones).toHaveCount(3)
  const zoneBorders = await zones.evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).borderTopColor),
  )
  expect(new Set(zoneBorders).size).toBe(1)

  const firstGeneration = page.locator(
    '.ref-live-radar-blip[data-generation="0"]',
  )
  await expect(firstGeneration).toHaveCount(1)

  const firstTarget = await firstGeneration.first().evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      className: element.className,
      animationName: style.animationName,
      animationDuration: style.animationDuration,
      animationIterationCount: style.animationIterationCount,
      animationDelay: Number.parseFloat(style.animationDelay),
    }
  })

  expect(firstTarget.className).toMatch(/is-(near|medium|far)/)
  expect(firstTarget.animationName).toBe('tribuscaRadarBlip')
  expect(firstTarget.animationDuration).toBe('4.8s')
  expect(firstTarget.animationIterationCount).toBe('1')
  expect(firstTarget.animationDelay).toBeGreaterThanOrEqual(0)
  expect(firstTarget.animationDelay).toBeLessThan(4.8)

  const fadeProfile = await firstGeneration.first().evaluate((element) => {
    const animation = element.getAnimations()[0]
    if (
      !animation ||
      !(animation.effect instanceof KeyframeEffect)
    ) {
      return []
    }

    return animation.effect.getKeyframes().map((frame) => ({
      offset: frame.offset,
      opacity: String(frame.opacity ?? ''),
    }))
  })

  expect(
    fadeProfile.some(
      (frame) =>
        frame.offset === 0 &&
        frame.opacity === '0',
    ),
  ).toBe(true)
  expect(
    fadeProfile.some(
      (frame) =>
        frame.offset !== null &&
        frame.offset > 0 &&
        frame.offset <= 0.1 &&
        frame.opacity === '1',
    ),
  ).toBe(true)
  expect(
    fadeProfile.filter((frame) => frame.opacity === '1').length,
  ).toBeGreaterThanOrEqual(2)
  expect(
    fadeProfile.some(
      (frame) =>
        frame.offset === 0.5 &&
        frame.opacity === '0',
    ),
  ).toBe(true)

  await expect
    .poll(
      async () =>
        Number(
          await radar.getAttribute('data-cycle'),
        ),
      { timeout: 6_500 },
    )
    .toBeGreaterThan(0)

  const cycle = Number(
    await radar.getAttribute('data-cycle'),
  )
  const targetCount = Number(
    await radar.getAttribute('data-target-count'),
  )
  const patternIndex = Number(
    await radar.getAttribute('data-pattern-index'),
  )

  expect(targetCount).toBeGreaterThanOrEqual(1)
  expect(targetCount).toBeLessThanOrEqual(10)
  expect(patternIndex).toBeGreaterThanOrEqual(0)
  expect(patternIndex).toBeLessThan(25)

  await expect(
    page.locator(
      '.ref-live-radar-blip[data-generation="' +
        cycle +
        '"]',
    ),
  ).toHaveCount(targetCount)

  expect(
    await page.locator(
      '.ref-live-radar-blip[data-generation="0"]',
    ).count(),
  ).toBeGreaterThanOrEqual(1)
})

test('WEB-20 — Home e carrossel usam publicações reais e não inventam itens', async ({ page }) => {
  await mockPublicSources(page)
  await mockPublicPublications(page)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Ato federal coletado de verdade')).toBeVisible()
  await expect(page.getByText('Publicação estadual real de São Paulo')).toBeVisible()
  await expect(page.getByText(/Exemplo de captura/)).toHaveCount(0)

  const tabs = page.getByRole('tab', { name: /^Exibir / })
  await tabs.nth(1).click()

  const stateCard = page.locator('.ref-state-publications-card')
  await expect(stateCard).toContainText('Nenhuma publicação recente disponível.')
})

test('WEB-18 — Home mostra Verificando durante loading da cobertura federal', async ({ page }) => {
  await mockPublicSources(page, 200, 700)
  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Verificando…')).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /^Exibir São Paulo$/ })).toBeVisible()
})

test('WEB-11 — claims públicos e Cobertura com API oficial', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Em desenvolvimento')).toHaveCount(0)
  await expect(page.getByText('Disponível', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('navigation', { name: 'Recursos do portfólio' }).getByRole('link')).toHaveCount(6)
  await expect(page.getByRole('link', { name: 'Acervo' })).toHaveAttribute('href', '#acervo')

  await mockPublicSources(page, 200, 350)
  await page.goto('/cobertura', { waitUntil: 'domcontentloaded' })

  const stateCards = page.locator('[data-testid="state-coverage-card"]')
  await expect(stateCards).toHaveCount(27)
  await expect(stateCards.first()).toContainText('São Paulo / SP')

  const federalCards = page.locator('[data-testid="federal-coverage-card"]')
  const douCard = federalCards.filter({ hasText: 'DOU / INLABS' }).first()
  await expect(douCard.locator('.collection-status')).toHaveText('Coleta —')
  await expect(douCard.locator('.coverage-metrics dd')).toHaveText(['—', '—', '—'])

  await expect(douCard.locator('.collection-status')).toHaveText('Coleta Online')
  await expect(douCard).toContainText('3')
  await expect(douCard).toContainText('517')
  await expect(douCard).toContainText('10:30')

  const confazCard = federalCards.filter({ hasText: 'CONFAZ' }).first()
  await expect(confazCard.locator('.collection-status')).toHaveText('Coleta Em validação')

  const nfeCard = federalCards.filter({ hasText: 'NF-e / ENCAT' }).first()
  await expect(nfeCard.locator('.collection-status')).toHaveText('Coleta Em validação')
  await expect(nfeCard.locator('.coverage-metrics dd').first()).toHaveText('—')

  const spedCard = federalCards.filter({ hasText: 'SPED' }).first()
  await expect(spedCard.locator('.collection-status')).toHaveText('Coleta Ainda não consultada')

  const goCard = stateCards.filter({ hasText: 'Goiás / GO' }).first()
  await expect(goCard.locator('.collection-status')).toHaveText('Coleta Ainda não consultada')
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
    await expect(statuses.nth(index)).toHaveText('Coleta —')
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
    name: 'Saiba o que mudou. Entenda o que importa. Cheque à fonte oficial.',
  })).toBeVisible()
  expect(appRequests.filter((url) => /\/auth\//.test(url))).toEqual([])
  expect(appRequests.every((url) => /\/public\/v1\/(?:sources|publications)/.test(url))).toBe(true)
})