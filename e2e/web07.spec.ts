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

test('WEB-07 — modais, contenção de foco, Escape e retorno', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const trigger = await openLogin(page)

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Entrar na TriBusca' })).toBeVisible()

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

  await page.getByRole('button', { name: 'Esqueci minha senha' }).click()
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible()
  await page.getByRole('button', { name: 'Visualizar etapa “Nova senha”' }).click()
  await expect(page.getByRole('heading', { name: 'Nova senha' })).toBeVisible()

  await screenshot(page, testInfo.project.name, 'modal-nova-senha')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('WEB-07 — cadastro visual não dispara persistência e estados são acessíveis', async ({ page }) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (['fetch', 'xhr'].includes(request.resourceType())) apiRequests.push(request.url())
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const viewport = page.viewportSize()
  const createAccount = viewport && viewport.width <= 680
    ? page.locator('.nav-actions').getByRole('button', { name: 'Criar conta' })
    : page.locator('.nav-actions').getByRole('button', { name: 'Criar conta' })

  await createAccount.click()
  await expect(page.getByRole('heading', { name: 'Criar conta' })).toBeVisible()

  const dialog = page.getByRole('dialog')
  const password = dialog.getByLabel('Senha', { exact: true })
  const confirm = dialog.getByLabel('Confirmar senha', { exact: true })
  await password.fill('Abcdef1!')
  await confirm.fill('Abcdef1!')

  const submit = dialog.getByRole('button', { name: 'Criar conta' })
  await expect(submit).toBeDisabled()
  await expect(page.getByText('Integração aguardando contrato de API. Nenhum endpoint fictício é chamado.')).toBeVisible()

  const rule = page.getByLabel('Mínimo de 8 caracteres: atendido')
  const ruleColor = await rule.evaluate((element) => getComputedStyle(element).color)
  expect(contrastRatio(ruleColor, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(4.5)
  expect(ruleColor).not.toBe('rgb(35, 112, 50)')

  const borderColor = await password.evaluate((element) => getComputedStyle(element).borderTopColor)
  expect(contrastRatio(borderColor, 'rgb(255, 255, 255)')).toBeGreaterThanOrEqual(3)

  await password.focus()
  const focus = await password.evaluate((element) => ({
    outlineWidth: getComputedStyle(element).outlineWidth,
    boxShadow: getComputedStyle(element).boxShadow,
  }))
  expect(Number.parseFloat(focus.outlineWidth)).toBeGreaterThanOrEqual(3)
  expect(focus.boxShadow).not.toBe('none')

  expect(apiRequests).toEqual([])
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

test('WEB-07 — claims públicos e Cobertura sem API', async ({ page }) => {
  await page.goto('/portfolio', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Em desenvolvimento')).toHaveCount(6)
  await expect(page.getByText('Disponível')).toHaveCount(0)

  await page.goto('/cobertura', { waitUntil: 'domcontentloaded' })
  const coverageCards = page.locator('.coverage-card')
  expect(await coverageCards.count()).toBeGreaterThan(27)
  const statuses = page.locator('.collection-status')
  for (let index = 0; index < await statuses.count(); index += 1) {
    await expect(statuses.nth(index)).toHaveText('—')
  }
  expect(await page.locator('.coverage-metrics dd').count()).toBeGreaterThan(20)
  for (const metric of await page.locator('.coverage-metrics dd').all()) {
    await expect(metric).toHaveText('—')
  }
})
