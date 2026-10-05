import { expect, test, type Page } from '@playwright/test'

const publicationId = '55555555-5555-4555-8555-555555555555'
const tenantId = '11111111-1111-4111-8111-111111111111'
const today = '2026-10-01'
const singleDate = '2026-09-28'
const from = '2026-09-25'
const to = '2026-09-30'
const dateKeys = ['publishedOn', 'publishedFrom', 'publishedTo'] as const
type DateParams = Partial<Record<typeof dateKeys[number], string>>

// Contract fixtures only: the browser exercises the built frontend and its
// actual requests. Backend date filtering is covered in backend PR #127.
const publication = {
  id: publicationId,
  title: 'Publicação de teste DATE-01',
  actType: 'IN',
  actNumber: '99/2026',
  agency: 'Receita Federal',
  jurisdictionLevel: 'FEDERAL',
  uf: null,
  publishedOn: singleDate,
  effectiveOn: null,
  officialUrl: 'https://example.test/date-01',
  sourceCode: 'dou',
  sourceName: 'DOU',
  excerpt: 'Conteúdo usado exclusivamente no teste de navegação.',
}

async function openArchive(page: Page) {
  // UTC is already Oct 2, but Sao Paulo is still Oct 1. Timers keep running.
  await page.clock.setFixedTime(new Date('2026-10-02T02:30:00Z'))
  await page.route('**/auth/refresh', (route) => route.fulfill({ json: {
    accessToken: 'date-01-test-access', tokenType: 'Bearer', expiresIn: 900,
  } }))
  await page.route('**/auth/me', (route) => route.fulfill({ json: {
    user: { id: 'date-01-user', email: 'date-01@example.test', name: 'Teste DATE-01' },
    memberships: [{ tenantId, tenantName: 'Teste DATE-01', tenantSlug: 'date-01', role: 'OWNER' }],
  } }))
  await page.route('**/public/v2/stats', (route) => route.fulfill({ json: {
    totalPublications: 75, totalSources: 1, activeSources: 1, importedToday: 0,
    generatedAt: '2026-10-01T12:00:00Z',
  } }))
  await page.route('**/public/v2/sources', (route) => route.fulfill({ json: {
    generatedAt: '2026-10-01T12:00:00Z', items: [],
  } }))
  await page.route('**/api/v1/monitoring/runs', (route) => route.fulfill({ json: {
    generatedAt: '2026-10-01T12:00:00Z', windowHours: 24, items: [],
  } }))
  await page.route('**/api/v1/account', (route) => route.fulfill({ json: {
    tenant: { id: tenantId, name: 'Teste DATE-01', slug: 'date-01', status: 'ACTIVE' },
    onboarding: null, companies: [],
  } }))
  await page.route('**/api/v1/establishment-types', (route) => route.fulfill({ json: { items: [] } }))
  await page.route('**/api/v1/taxonomy/profile-options', (route) => route.fulfill({ json: {
    release: null, dimensions: [],
  } }))
  await page.route('**/api/v2/archive/facets', (route) => route.fulfill({ json: {
    ufs: ['GO'], sources: [{ code: 'dou', name: 'DOU' }], actTypes: ['IN'],
  } }))
  await page.route('**/api/v2/archive/navigation?*', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer date-01-test-access')
    const params = new URL(route.request().url()).searchParams
    const groupBy = params.get('groupBy')
    const items = groupBy === 'jurisdiction'
      ? [{ value: 'FEDERAL', label: 'Federal', count: 75 }]
      : groupBy === 'source'
        ? [{ value: 'dou', label: 'DOU', count: 75 }]
        : groupBy === 'actType'
          ? [{ value: 'IN', label: 'IN', count: 75 }]
          : groupBy === 'year'
            ? [{ value: '2026', label: '2026', count: 75 }]
            : groupBy === 'month'
              ? [{ value: '9', label: '9', count: 75 }]
              : []
    return route.fulfill({ json: { groupBy, items } })
  })
  await page.route('**/api/v2/archive?*', (route) => {
    expect(route.request().headers().authorization).toBe('Bearer date-01-test-access')
    const params = new URL(route.request().url()).searchParams
    const pageNumber = Number(params.get('page'))
    const limit = Number(params.get('limit'))
    return route.fulfill({ json: {
      page: pageNumber, limit, totalItems: 75, totalPages: Math.ceil(75 / limit),
      totalIsCapped: false, hasMore: pageNumber < Math.ceil(75 / limit), items: [publication],
    } })
  })
  await page.route(`**/api/v1/publications/${publicationId}`, (route) => route.fulfill({ json: {
    publication: { ...publication, firstCollectedAt: '2026-09-28T12:00:00Z', lastSeenAt: '2026-09-28T12:00:00Z' },
    version: {
      id: '66666666-6666-4666-8666-666666666666', versionNo: 1, versionCount: 1,
      contentText: publication.excerpt, excerpt: null, capturedAt: '2026-09-28T12:00:00Z',
      presentation: { version: 1, format: 'PRESERVED_TEXT', preservesWhitespace: true },
    },
    origins: [],
  } }))
  await page.route(`**/api/v1/publications/${publicationId}/ncms`, (route) => route.fulfill({ json: { items: [] } }))

  await page.goto('/painel')
  await page.getByRole('button', { name: 'Acervo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Acervo', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Filtro por data de publicação' })).toBeVisible()
  await expect(page.locator('.tp-page-numbers [aria-current="page"]')).toHaveText('1')
}

async function expectArchiveRequest(
  page: Page,
  action: () => Promise<unknown>,
  dates: DateParams,
  pageNumber = 1,
  filters: Record<string, string> = {},
) {
  // Arm before the action: cached/earlier requests cannot satisfy the assertion.
  const pending = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/v2/archive' &&
      url.searchParams.get('limit') === '25' &&
      url.searchParams.get('page') === String(pageNumber) &&
      dateKeys.every((key) => url.searchParams.get(key) === (dates[key] ?? null)) &&
      Object.entries(filters).every(([key, value]) => url.searchParams.get(key) === value)
  }, { timeout: 8_000 })
  const [response] = await Promise.all([pending, action()])
  expect(response.status()).toBe(200)
  await expect(page.locator('.tp-page-numbers [aria-current="page"]')).toHaveText(String(pageNumber))
}

async function expectDateUrl(page: Page, expected: Record<string, string>) {
  await expect(page).toHaveURL((url) =>
    url.pathname === '/painel' &&
    ['date', 'range', 'from', 'to'].every((key) => url.searchParams.get(key) === (expected[key] ?? null)),
  )
}

async function enableRange(page: Page) {
  const dateFilter = page.getByRole('region', { name: 'Filtro por data de publicação' })
  // The styled switch uses a label over a pointer-events:none native input.
  // Click its visible label, as a user would, then assert the native state.
  await dateFilter.getByText('Intervalo', { exact: true }).click()
  await expect(dateFilter.getByRole('checkbox', { name: 'Intervalo' })).toBeChecked()
}

async function visitDetailAndReturn(page: Page, expectedUrl: Record<string, string>, dates: DateParams) {
  await page.getByRole('link', { name: 'Abrir legislação: IN 99/2026' }).click()
  await expect(page).toHaveURL(new RegExp(`/painel/publicacoes/${publicationId}$`))
  await expect(page.getByRole('heading', { name: publication.title })).toBeVisible()
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Voltar', exact: true }).click(), dates, 2, { q: 'tributário' })
  await expectDateUrl(page, expectedUrl)
  await expect(page.getByLabel('Pesquisar no Acervo')).toHaveValue('tributário')
}

test('DATE-01: dates, requests, pagination, detail return, open ranges and clearing', async ({ page }) => {
  test.setTimeout(90_000)
  await openArchive(page)
  const dateFilter = page.getByRole('region', { name: 'Filtro por data de publicação' })
  const dateInput = dateFilter.getByLabel('Data', { exact: true })
  await expect(dateInput).toHaveAttribute('max', today)
  const futureDays = dateFilter.getByRole('button', { name: /data futura indisponível/ })
  await expect(futureDays).toHaveCount(3)
  for (const button of await futureDays.all()) await expect(button).toBeDisabled()

  // Combine with another filter, move to page 2, then change the date.
  await page.getByLabel('Pesquisar no Acervo').fill('tributário')
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Buscar no Acervo', exact: true }).click(), {}, 1, { q: 'tributário' })
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Avançar página' }).click(), {}, 2)
  await expectArchiveRequest(page, () => dateInput.fill(singleDate), { publishedOn: singleDate }, 1, { q: 'tributário' })
  await expectDateUrl(page, { date: singleDate })
  await expect(dateInput).toHaveValue(singleDate)

  // The ruler also makes a real selection, reflected in the URL and request.
  await expectArchiveRequest(page, () => dateFilter.getByRole('button', { name: /^29 / }).click(), { publishedOn: '2026-09-29' })
  await expectDateUrl(page, { date: '2026-09-29' })
  await expectArchiveRequest(page, () => dateInput.fill(singleDate), { publishedOn: singleDate })
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Avançar página' }).click(), { publishedOn: singleDate }, 2)
  await visitDetailAndReturn(page, { date: singleDate }, { publishedOn: singleDate })
  await expect(dateInput).toHaveValue(singleDate)

  await expectArchiveRequest(page, () => enableRange(page), { publishedFrom: singleDate, publishedTo: singleDate })
  await expectArchiveRequest(page, () => dateFilter.getByLabel('De:', { exact: true }).fill(from), { publishedFrom: from, publishedTo: singleDate })
  await expectArchiveRequest(page, () => dateFilter.getByLabel('Até:', { exact: true }).fill(to), { publishedFrom: from, publishedTo: to })
  await expectDateUrl(page, { range: '1', from, to })
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Avançar página' }).click(), { publishedFrom: from, publishedTo: to }, 2)
  await visitDetailAndReturn(page, { range: '1', from, to }, { publishedFrom: from, publishedTo: to })
  await expect(dateFilter.getByLabel('De:', { exact: true })).toHaveValue(from)
  await expect(dateFilter.getByLabel('Até:', { exact: true })).toHaveValue(to)

  // B1 in both directions, including the one-sided request and page reset.
  await expectArchiveRequest(page, () => dateFilter.getByLabel('Até:', { exact: true }).fill(''), { publishedFrom: from })
  await expectDateUrl(page, { range: '1', from })
  await expect(dateFilter.getByLabel('De:', { exact: true })).toHaveValue(from)
  await expect(dateFilter.getByLabel('Até:', { exact: true })).toHaveValue('')
  await expectArchiveRequest(page, () => dateFilter.getByLabel('Até:', { exact: true }).fill(to), { publishedFrom: from, publishedTo: to })
  await expectArchiveRequest(page, () => dateFilter.getByLabel('De:', { exact: true }).fill(''), { publishedTo: to })
  await expectDateUrl(page, { range: '1', to })
  await expect(dateFilter.getByLabel('De:', { exact: true })).toHaveValue('')
  await expect(dateFilter.getByLabel('Até:', { exact: true })).toHaveValue(to)
  await expectArchiveRequest(page, () => dateFilter.getByLabel('De:', { exact: true }).fill(from), { publishedFrom: from, publishedTo: to })

  await expectArchiveRequest(page, () => dateFilter.getByRole('button', { name: 'Limpar data' }).click(), {}, 1, { q: 'tributário' })
  await expectDateUrl(page, { range: '1' })
  await expect(dateFilter.getByLabel('De:', { exact: true })).toHaveValue('')
  await expect(dateFilter.getByLabel('Até:', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Pesquisar no Acervo')).toHaveValue('tributário')

  await expectArchiveRequest(page, () => dateFilter.getByLabel('De:', { exact: true }).fill(from), { publishedFrom: from, publishedTo: from })
  await expectArchiveRequest(page, () => dateFilter.getByLabel('Até:', { exact: true }).fill(to), { publishedFrom: from, publishedTo: to })
  await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Limpar filtros' }).click(), {})
  await expectDateUrl(page, { range: '1' })
  await expect(dateFilter.getByLabel('De:', { exact: true })).toHaveValue('')
  await expect(dateFilter.getByLabel('Até:', { exact: true })).toHaveValue('')
  await expect(page.getByLabel('Pesquisar no Acervo')).toHaveValue('')
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('tribusca.archive.date') ?? '{}')))
    .toMatchObject({ singleDate: '', from: '', to: '' })
})


test('DESIGN-03: Navegação hierárquica fica no Acervo e preserva o filtro de data', async ({ page }) => {
  await openArchive(page)

  const pesquisaTab = page.getByRole('tab', { name: 'Pesquisa', exact: true })
  const navegacaoTab = page.getByRole('tab', { name: 'Navegação', exact: true })
  const dateFilter = page.getByRole('region', { name: 'Filtro por data de publicação' })

  await expect(pesquisaTab).toHaveAttribute('aria-selected', 'true')
  await enableRange(page)
  await expect(dateFilter.getByText(/Régua ajusta/)).toHaveCount(0)

  await navegacaoTab.click()
  await expect(navegacaoTab).toHaveAttribute('aria-selected', 'true')
  await expect(dateFilter).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'A Biblioteca Tributária' })).toBeVisible()
  await expect(page.getByText('Acervo · Biblioteca Viva', { exact: true })).toBeVisible()
  await expect(page.getByText(/Conhecimento organizado para ser encontrado/)).toBeVisible()

  await page.getByRole('button', { name: 'Ajuda', exact: true }).click()
  const help = page.getByRole('dialog')
  await expect(help.getByRole('heading', { name: 'Farol de navegação' })).toBeVisible()
  await expect(help).toContainText(
    'A ideia é reduzir o Acervo em etapas claras. A cada clique, você troca milhares de possibilidades por um conjunto menor e mais relevante.',
  )
  for (const step of [
    'Escolha o ponto de partida',
    'Refine por categoria',
    'Chegue à lista de documentos',
    'Abra a fonte preservada',
  ]) {
    await expect(help.getByText(step, { exact: true })).toBeVisible()
  }
  await help.getByRole('button', { name: 'Fechar', exact: true }).click()

  const options = page.locator('.tp-acervo-option-grid')
  await options.getByRole('button', { name: /Federal/ }).click()
  const libraryWindowHeight = await page.locator('.tp-acervo-library-stage')
    .evaluate((element) => getComputedStyle(element, '::before').height)
  expect(libraryWindowHeight).toBe('560px')
  await options.getByRole('button', { name: /DOU/ }).click()
  await options.getByRole('button', { name: /IN/ }).click()
  await options.getByRole('button', { name: /2026/ }).click()

  const finalActs = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.pathname === '/api/v2/archive' &&
      url.searchParams.get('limit') === '25' &&
      url.searchParams.get('jurisdiction') === 'FEDERAL' &&
      url.searchParams.get('source') === 'dou' &&
      url.searchParams.get('actType') === 'IN' &&
      url.searchParams.get('publishedFrom') === '2026-09-01' &&
      url.searchParams.get('publishedTo') === '2026-09-30'
  }, { timeout: 8_000 })
  await options.getByRole('button', { name: /Setembro/ }).click()
  expect((await finalActs).status()).toBe(200)

  await expect(navegacaoTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('link', { name: 'Abrir legislação: IN 99/2026' })).toBeVisible()
  const breadcrumb = page.getByRole('navigation', { name: 'Caminho atual' })
  for (const label of ['Federal', 'DOU', 'IN', '2026', 'Setembro']) {
    await expect(breadcrumb.getByRole('button', { name: label, exact: true })).toBeVisible()
  }
  const pathRail = page.locator('.tp-acervo-path-rail')
  await expect(pathRail).toContainText('Federal')
  await expect(pathRail).toContainText('75 atos')
  await expect(pathRail).toContainText('Setembro')
  await expect(pathRail.locator('.tp-acervo-path-icon')).toHaveCount(5)
  const finalLibraryWindowHeight = await page.locator('.tp-acervo-library-stage')
    .evaluate((element) => getComputedStyle(element, '::before').height)
  expect(finalLibraryWindowHeight).toBe(libraryWindowHeight)

  await pesquisaTab.click()
  const restoredDateFilter = page.getByRole('region', { name: 'Filtro por data de publicação' })
  await expect(restoredDateFilter).toBeVisible()
  await expect(restoredDateFilter.getByRole('checkbox', { name: 'Intervalo' })).toBeChecked()
})


for (const mode of ['single', 'range'] as const) {
  test(`DATE-01: active ${mode} date filters do not leak into Publicações`, async ({ page }) => {
    await openArchive(page)
    const dateFilter = page.getByRole('region', { name: 'Filtro por data de publicação' })
    await expectArchiveRequest(page, () => dateFilter.getByLabel('Data', { exact: true }).fill(singleDate), { publishedOn: singleDate })
    if (mode === 'range') {
      await expectArchiveRequest(page, () => enableRange(page), { publishedFrom: singleDate, publishedTo: singleDate })
      await expectArchiveRequest(page, () => dateFilter.getByLabel('Até:', { exact: true }).fill(to), { publishedFrom: singleDate, publishedTo: to })
    }
    const storedBefore = await page.evaluate(() => sessionStorage.getItem('tribusca.archive.date'))

    // No clear first: a surviving saved date makes this a meaningful leak check.
    const requests: URL[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/v2/archive') requests.push(url)
    })
    const pending = page.waitForResponse((response) => {
      const url = new URL(response.url())
      return url.pathname === '/api/v2/archive' && url.searchParams.get('limit') === '25'
    }, { timeout: 8_000 })
    await page.getByRole('button', { name: 'Publicações', exact: true }).click()
    expect((await pending).status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Publicações', exact: true })).toBeVisible()
    await expect(page.getByText(publication.title, { exact: true })).toBeVisible()
    await expect(dateFilter).toHaveCount(0)
    expect(requests.length).toBeGreaterThan(0)
    for (const url of requests) {
      for (const key of dateKeys) expect(url.searchParams.has(key), `${key} leaked to Publicações`).toBe(false)
    }
    expect(await page.evaluate(() => sessionStorage.getItem('tribusca.archive.date'))).toBe(storedBefore)

    const dates = mode === 'single'
      ? { publishedOn: singleDate }
      : { publishedFrom: singleDate, publishedTo: to }
    await expectArchiveRequest(page, () => page.getByRole('button', { name: 'Acervo', exact: true }).click(), dates)
    await expectDateUrl(page, mode === 'single' ? { date: singleDate } : { range: '1', from: singleDate, to })
  })
}
