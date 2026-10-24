import { expect, test } from '@playwright/test'

const tenantId = '11111111-1111-4111-8111-111111111111'
const companyId = '22222222-2222-4222-8222-222222222222'
const establishmentId = '33333333-3333-4333-8333-333333333333'
const publicationId = '55555555-5555-4555-8555-555555555555'
const releaseId = '77777777-7777-4777-8777-777777777777'

async function openLogin(page: import('@playwright/test').Page) {
  if ((page.viewportSize()?.width ?? 0) <= 680) {
    await page.getByRole('button', { name: 'Abrir menu' }).click()
    await page.getByRole('navigation', { name: 'Navegação móvel' })
      .getByRole('button', { name: 'Entrar' }).click()
    return
  }

  await page.locator('.nav-actions')
    .getByRole('button', { name: 'Entrar' }).click()
}

const archiveItem = {
  id: publicationId,
  title: 'Ato oficial real do Acervo',
  actType: 'IN',
  actNumber: '99/2026',
  agency: 'Receita Federal',
  jurisdictionLevel: 'FEDERAL',
  uf: null,
  publishedOn: '2026-09-30',
  effectiveOn: '2026-10-01',
  officialUrl: 'https://example.test/oficial',
  sourceCode: 'dou',
  sourceName: 'DOU',
  excerpt: 'Conteúdo oficial de teste.',
}

test('authenticated product v2 works end-to-end with current navigation and account setup', async ({ page }, testInfo) => {
  const archiveRequests: URL[] = []
  let companyCreated = false
  let profileSaved = false

  await page.route('**/auth/login', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'set-cookie': 'radar_refresh_token=launch-browser; HttpOnly; Path=/auth; SameSite=Strict',
    },
    body: JSON.stringify({
      accessToken: 'launch-access',
      tokenType: 'Bearer',
      expiresIn: 900,
    }),
  }))

  await page.route('**/auth/me', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: {
        id: 'launch-user',
        email: 'owner@example.test',
        name: 'Owner Teste',
      },
      memberships: [{
        tenantId,
        tenantName: 'Empresa Launch',
        tenantSlug: 'empresa-launch',
        role: 'OWNER',
      }],
    }),
  }))

  await page.route('**/auth/refresh', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      accessToken: 'launch-refreshed',
      tokenType: 'Bearer',
      expiresIn: 900,
    }),
  }))

  await page.route('**/auth/logout', (route) => route.fulfill({
    status: 204,
    headers: {
      'set-cookie': 'radar_refresh_token=; Max-Age=0; HttpOnly; Path=/auth; SameSite=Strict',
    },
  }))

  await page.route('**/public/v2/stats', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      totalPublications: 321,
      totalSources: 12,
      activeSources: 10,
      importedToday: 7,
      generatedAt: '2026-09-30T00:00:00.000Z',
    }),
  }))

  await page.route('**/public/v2/sources', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      generatedAt: '2026-09-30T00:00:00.000Z',
      items: [{
        code: 'dou',
        name: 'DOU',
        jurisdictionLevel: 'FEDERAL',
        uf: null,
        isActive: true,
        status: 'ONLINE',
        lastRunStatus: 'SUCCESS',
        lastSuccessAt: '2026-09-30T00:00:00.000Z',
        lastAttemptAt: '2026-09-30T00:00:00.000Z',
        importedToday: 7,
        totalPublications: 321,
      }],
    }),
  }))

  await page.route('**/api/v1/monitoring/runs', async (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe(tenantId)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-09-30T00:00:00.000Z',
        windowHours: 24,
        items: [{
          id: '88888888-8888-4888-8888-888888888888',
          sourceCode: 'dou',
          sourceName: 'DOU',
          jurisdictionLevel: 'FEDERAL',
          uf: null,
          status: 'SUCCESS',
          triggerType: 'SCHEDULED',
          scheduledFor: '2026-09-30T00:00:00.000Z',
          startedAt: '2026-09-30T00:00:00.000Z',
          finishedAt: '2026-09-30T00:00:03.000Z',
          durationMs: 3000,
          attemptCount: 1,
          foundItems: 10,
          discardedItems: 3,
          retainedItems: 6,
          processedItems: 9,
          importedDocuments: 2,
        }],
      }),
    })
  })

  await page.route('**/api/v1/news?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        id: '99999999-9999-4999-8999-999999999999',
        sourceCode: 'rfb-news',
        sourceName: 'Receita Federal — Notícias',
        agency: 'RFB',
        title: 'Receita Federal orienta sobre IBS e CBS',
        summary: 'Conteúdo tributário oficial selecionado pelo TriBusca.',
        category: 'Tributação',
        publishedAt: '2026-10-01T12:00:00.000Z',
        updatedAt: null,
        officialUrl: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/exemplo-ibs-cbs',
        tags: ['IBS', 'CBS'],
      }],
      page: 1,
      limit: 20,
      totalItems: 1,
      totalPages: 1,
    }),
  }))

  await page.route('**/api/v2/archive/facets?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ufs: ['GO'],
      sources: [{ code: 'dou', name: 'DOU' }],
      actTypes: new URL(route.request().url()).searchParams.has('source') ? [] : ['IN', 'Convênio ICMS'],
    }),
  }))

  await page.route('**/api/v2/archive?*', (route) => {
    const url = new URL(route.request().url())
    archiveRequests.push(url)
    const pageNumber = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '25')
    // Searches answer with the PERF-02 capped contract; everything else with
    // the previous contract (no totalIsCapped), as an older backend would.
    // A source filter answers with no matches, so a filter leaking into
    // another screen would empty it.
    const body = url.searchParams.has('source')
      ? { page: pageNumber, limit, totalItems: 0, totalPages: 1, totalIsCapped: false, hasMore: false, items: [] }
      : url.searchParams.has('q')
        ? { page: pageNumber, limit, totalItems: 10000, totalPages: 400, totalIsCapped: true, hasMore: true, items: [archiveItem] }
        : { page: pageNumber, limit, totalItems: 1, totalPages: 1, hasMore: false, items: [archiveItem] }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })

  await page.route(`**/api/v1/publications/${publicationId}`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      publication: {
        id: publicationId,
        title: archiveItem.title,
        actType: archiveItem.actType,
        actNumber: archiveItem.actNumber,
        agency: archiveItem.agency,
        jurisdictionLevel: archiveItem.jurisdictionLevel,
        uf: archiveItem.uf,
        publishedOn: archiveItem.publishedOn,
        effectiveOn: archiveItem.effectiveOn,
        officialUrl: archiveItem.officialUrl,
        firstCollectedAt: '2026-09-30T00:00:00.000Z',
        lastSeenAt: '2026-09-30T00:00:00.000Z',
      },
      version: {
        id: '66666666-6666-4666-8666-666666666666',
        versionNo: 1,
        versionCount: 1,
        contentText: 'CAPÍTULO I\nArt. 1º NCM 1006.30.11.',
        excerpt: null,
        capturedAt: '2026-09-30T00:00:00.000Z',
        presentation: {
          version: 1,
          format: 'SANITIZED_HTML',
          preservesWhitespace: true,
          html: '<h2>CAPÍTULO I</h2><p>Art. 1º Texto oficial.</p><table><tbody><tr><th>Tributo</th><th>Regra</th></tr><tr><td>ICMS</td><td>Primeiro item</td></tr></tbody></table>',
        },
      },
      origins: [{
        sourceCode: 'dou',
        sourceName: 'DOU',
        officialUrl: archiveItem.officialUrl,
        externalId: 'ato-99',
        firstSeenAt: '2026-09-30T00:00:00.000Z',
        lastSeenAt: '2026-09-30T00:00:00.000Z',
      }],
    }),
  }))

  await page.route(`**/api/v1/publications/${publicationId}/ncms`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [{
        code: '10063011',
        description: 'Arroz semibranqueado ou branqueado',
        verificationStatus: 'CATALOG_MATCHED',
        method: {
          type: 'DETERMINISTIC',
          detectorKey: 'ncm-catalog-v1',
          detectorVersion: '1',
        },
        confidence: 1,
        excerpt: 'Art. 1º NCM 1006.30.11.',
      }],
    }),
  }))

  await page.route('**/api/v1/account', async (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe(tenantId)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant: {
          id: tenantId,
          name: 'Empresa Launch',
          slug: 'empresa-launch',
          status: 'ACTIVE',
        },
        onboarding: {
          companyName: 'Empresa Launch',
          cnpj: null,
          createdAt: '2026-09-30T00:00:00.000Z',
        },
        companies: companyCreated ? [{
          id: companyId,
          legalName: 'Empresa Launch Ltda',
          tradeName: 'Empresa Launch',
          cnpj: '11222333000181',
          isActive: true,
          establishmentCount: 1,
          businessLocationCode: 'MATRIZ-01',
        }] : [],
      }),
    })
  })

  await page.route('**/api/v1/companies/from-cnpj', async (route) => {
    const payload = route.request().postDataJSON() as {
      cnpj: string
      businessLocationCode?: string
    }
    expect(payload.cnpj).toBe('11222333000181')
    expect(payload.businessLocationCode).toBe('MATRIZ-01')
    companyCreated = true
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        company: {
          id: companyId,
          legalName: 'Empresa Launch Ltda',
          tradeName: 'Empresa Launch',
          cnpj: '11222333000181',
          businessLocationCode: 'MATRIZ-01',
        },
        establishment: {
          id: establishmentId,
          companyId,
          cnpj: '11222333000181',
          name: 'Matriz Goiânia',
          typeCode: 'HEAD_OFFICE',
          isHeadOffice: true,
          uf: 'GO',
          municipalityName: 'Goiânia',
          municipalityIbgeCode: '5208707',
          postalCode: '74000000',
          street: 'Avenida Teste',
          streetNumber: '100',
          complement: null,
          district: 'Centro',
          businessLocationCode: 'MATRIZ-01',
          stateRegistration: '10.123.456-2',
          stateRegistrationStatus: 'ATIVO - HABILITADO',
          stateRegistrationLookupStatus: 'SUCCESS',
          stateRegistrationSource: 'SEFAZ_GO_SINTEGRA',
          stateRegistrationCheckedAt: '2026-09-30T10:00:00.000Z',
          cnaes: [{
            code: '4683400',
            description: 'Comércio atacadista de defensivos agrícolas',
            isPrimary: true,
          }],
        },
        registry: {
          source: 'BRASILAPI_MINHA_RECEITA',
          consultedAt: '2026-09-30T10:00:00.000Z',
          registrationStatus: 'ATIVA',
          openedOn: '2020-01-01',
        },
      }),
    })
  })

  await page.route(`**/api/v1/companies/${companyId}/establishments`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: companyCreated ? [{
        id: establishmentId,
        companyId,
        cnpj: '11222333000181',
        name: 'Matriz Goiânia',
        typeCode: 'HEAD_OFFICE',
        isHeadOffice: true,
        uf: 'GO',
        municipalityName: 'Goiânia',
        municipalityIbgeCode: '5208707',
        postalCode: '74000000',
        street: 'Avenida Teste',
        streetNumber: '100',
        complement: null,
        district: 'Centro',
        businessLocationCode: 'MATRIZ-01',
        stateRegistration: '10.123.456-2',
        stateRegistrationStatus: 'ATIVO - HABILITADO',
        stateRegistrationLookupStatus: 'SUCCESS',
        stateRegistrationSource: 'SEFAZ_GO_SINTEGRA',
        stateRegistrationCheckedAt: '2026-09-30T10:00:00.000Z',
        isActive: true,
        cnaes: [{
          code: '4683400',
          description: 'Comércio atacadista de defensivos agrícolas',
          isPrimary: true,
        }],
      }] : [],
    }),
  }))

  await page.route(`**/api/v1/companies/${companyId}/cnae-ncms`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }))

  await page.route(`**/api/v1/companies/${companyId}/product-profiles`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [] }),
  }))

  await page.route('**/api/v1/establishment-types', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ items: [
      { code: 'HEAD_OFFICE', name: 'Matriz' },
      { code: 'OFFICE', name: 'Escritório' },
    ] }),
  }))

  await page.route('**/api/v1/taxonomy/profile-options', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      release: {
        id: releaseId,
        version: 'v1.0.0',
        publishedAt: '2026-09-30T00:00:00.000Z',
      },
      dimensions: [
        { code: 'tax', name: 'Tributo', description: null, concepts: [
          { code: 'tax.icms', label: 'ICMS', definition: 'Imposto sobre circulação.' },
        ] },
        { code: 'sector', name: 'Setor', description: null, concepts: [
          { code: 'sector.agribusiness', label: 'Agronegócio', definition: 'Atividades do agronegócio.' },
        ] },
        { code: 'product', name: 'Produto', description: null, concepts: [
          { code: 'product.fertilizer', label: 'Fertilizantes', definition: 'Fertilizantes e afins.' },
        ] },
        { code: 'operation', name: 'Operação', description: null, concepts: [
          { code: 'operation.sale', label: 'Venda', definition: 'Operação de venda.' },
        ] },
        { code: 'document', name: 'Documento', description: null, concepts: [
          { code: 'document.nfe', label: 'NF-e', definition: 'Nota Fiscal eletrônica.' },
        ] },
        { code: 'obligation', name: 'Obrigação', description: null, concepts: [
          { code: 'obligation.efd', label: 'EFD', definition: 'Escrituração Fiscal Digital.' },
        ] },
      ],
      segments: [
        { code: 'sector.wholesale', label: 'Comércio atacadista' },
        { code: 'sector.agri_inputs', label: 'Insumos agrícolas' },
      ],
      products: [],
    }),
  }))

  // Segment of each company CNAE, from the Segmento table.
  await page.route(`**/api/v1/companies/${companyId}/taxonomy-suggestions`, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      segments: [],
      cnaes: [{ cnaeCode: '4683400', isPrimary: true, segments: [{ code: 'sector.wholesale', label: 'Comércio atacadista' }] }],
    }),
  }))

  await page.route(`**/api/v1/companies/${companyId}/tax-profile`, async (route) => {
    if (route.request().method() === 'PUT') {
      profileSaved = true
      const payload = route.request().postDataJSON() as {
        taxRegime: string
        personalization: {
          ncmCodes?: string[]
          taxonomy: { conceptCodes: string[]; cnaeSegments?: Array<{ cnaeCode: string; segmentCode: string }> } | null
        }
      }
      expect(payload.taxRegime).toBe('LUCRO_REAL')
      expect(payload.personalization.taxonomy?.conceptCodes).toContain('tax.icms')
      expect(payload.personalization.ncmCodes).toEqual([])
      // The user changed the CNAE's segment in the CNAE table.
      expect(payload.personalization.taxonomy?.cnaeSegments).toEqual([
        { cnaeCode: '4683400', segmentCode: 'sector.agri_inputs' },
      ])
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: profileSaved ? {
          id: '44444444-4444-4444-8444-444444444444',
          companyId,
          versionNo: 1,
          taxRegime: 'LUCRO_REAL',
          segments: ['Agronegócio'],
          activities: ['Venda'],
          personalization: {
            taxes: ['ICMS'],
            products: ['Fertilizantes'],
            operations: ['Venda'],
            documents: ['NF-e'],
            obligations: ['EFD'],
            keywords: ['crédito presumido'],
            taxonomy: {
              releaseId,
              releaseVersion: 'v1.0.0',
              conceptCodes: [
                'tax.icms',
                'sector.agribusiness',
                'product.fertilizer',
                'operation.sale',
                'document.nfe',
                'obligation.efd',
              ],
            },
          },
          validFrom: '2026-09-30',
        } : null,
      }),
    })
  })

  await page.goto('/')
  await openLogin(page)

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill('owner@example.test')
  await dialog.getByLabel('Senha', { exact: true }).fill('browser-test-value')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Olá, Owner.' })).toBeVisible()
  await expect(page.getByText('321')).toBeVisible()

  await page.getByRole('button', { name: 'Publicações', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Publicações' })).toBeVisible()
  await expect(page.getByText('Ato oficial real do Acervo')).toBeVisible()

  await page.getByRole('link', { name: 'Abrir legislação: IN 99/2026' }).click()
  await expect(page).toHaveURL(new RegExp(`/painel/publicacoes/${publicationId}$`))
  await expect(page.getByRole('heading', { name: 'Ato oficial real do Acervo' })).toBeVisible()
  await expect(page.getByText('1006.30.11', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(page.getByRole('heading', { name: 'Publicações' })).toBeVisible()

  await page.getByRole('button', { name: 'Acervo', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Acervo' })).toBeVisible()
  await expect(page.getByLabel('UF')).toContainText('GO')
  await expect(page.getByLabel('Tipo de base legal')).toContainText('Convênio ICMS')
  await page.getByLabel('Tipo de base legal').selectOption('IN')
  await expect.poll(() => archiveRequests.some(
    (url) => url.searchParams.get('actType') === 'IN',
  )).toBe(true)
  // Response without totalIsCapped (previous backend contract) keeps the
  // exact summary.
  await expect(page.getByText('Página 1 de 1 · 1 publicações')).toBeVisible()

  await page.getByLabel('Buscar também no texto completo (ex.: NCM ou trecho do ato)').check()
  await page.getByLabel('Pesquisar no Acervo').fill('Convênio')
  await page.getByRole('button', { name: 'Buscar no Acervo' }).click()
  await expect(page.getByText('Página 1 · mais de 10.000 publicações')).toBeVisible()
  const searched = archiveRequests.filter((url) => url.searchParams.get('q') === 'Convênio')
  expect(searched.length).toBeGreaterThan(0)
  expect(searched.every((url) => url.searchParams.get('scope') === 'full')).toBe(true)
  expect(searched.every((url) => url.searchParams.get('actType') === 'IN')).toBe(true)
  expect(archiveRequests.some((url) => !url.searchParams.has('q') && url.searchParams.has('scope'))).toBe(false)

  // The applied search is visible and explains an empty filtered result.
  await expect(page.getByText('Resultados para')).toBeVisible()
  await page.getByLabel('Fonte').selectOption('dou')
  await expect(page.getByText(/Nenhum resultado com os filtros atuais · busca “Convênio” · fonte DOU · tipo IN/)).toBeVisible()

  // A new act type can be selected without clearing any of the other filters.
  const actTypeSelect = page.getByLabel('Tipo de base legal')
  await expect(actTypeSelect.locator('option')).toHaveCount(3)
  await expect(actTypeSelect).toContainText('Todos')
  await expect(actTypeSelect).toContainText('Convênio ICMS')
  await actTypeSelect.selectOption('Convênio ICMS')
  await expect.poll(() => archiveRequests.some((url) =>
    url.searchParams.get('actType') === 'Convênio ICMS' &&
    url.searchParams.get('source') === 'dou' &&
    url.searchParams.get('q') === 'Convênio',
  )).toBe(true)
  await actTypeSelect.selectOption('IN')

  // Acervo filters do not leak into Publicações.
  await page.getByRole('button', { name: 'Publicações', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Publicações' })).toBeVisible()
  await expect(page.getByText('Ato oficial real do Acervo')).toBeVisible()

  // Clearing the search stops filtering by it.
  await page.getByRole('button', { name: 'Acervo', exact: true }).click()
  await page.getByRole('button', { name: 'Limpar busca' }).click()
  await expect(page.getByText('Resultados para')).toHaveCount(0)
  await expect.poll(() => archiveRequests.some(
    (url) =>
      url.searchParams.get('source') === 'dou' &&
      url.searchParams.get('actType') === 'IN' &&
      !url.searchParams.has('q'),
  )).toBe(true)
  await page.getByRole('button', { name: 'Limpar filtros' }).click()

  await page.getByRole('button', { name: 'Central de Monitoramento', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Central de Monitoramento' })).toBeVisible()
  await expect(page.getByText('DOU').first()).toBeVisible()

  // MON-01: failures are found but not processed; existing retained items
  // count as maintained, not imported.
  const expectedLabels = ['Encontradas', 'Descartadas', 'Mantidas', 'Processadas', 'Importadas']
  const expectedValues = ['10', '3', '6', '9', '2']
  const monitoringSummary = page.locator('.tp-monitor-summary')
  const summarySequence = monitoringSummary.locator('.tp-monitor-totals-24h .tp-monitor-metric-sequence')
  await expect(summarySequence.locator('small')).toHaveText(expectedLabels)
  await expect(summarySequence.locator('b')).toHaveText(expectedValues)
  await expect(summarySequence.locator('.tp-monitor-metric-separator')).toHaveText(['|', '|', '|', '|'])
  const sourceCard = page.locator('.tp-monitor-source-card').filter({ hasText: 'DOU' })
  const sourceSequence = sourceCard.locator('.tp-monitor-source-counters .tp-monitor-metric-sequence')
  await expect(sourceSequence.locator('small')).toHaveText(expectedLabels)
  await expect(sourceSequence.locator('b')).toHaveText(expectedValues)
  await expect(sourceSequence.locator('.tp-monitor-metric-separator')).toHaveText(['|', '|', '|', '|'])
  if ((page.viewportSize()?.width ?? 0) <= 390) {
    // Horizontal scroll is intentional on narrow screens: preserve legible
    // metric labels/values instead of squeezing them or overflowing the page.
    for (const locator of [summarySequence, sourceCard.locator('.tp-monitor-source-counters')]) {
      const box = await locator.evaluate(element => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: getComputedStyle(element).overflowX,
      }))
      expect(box.clientWidth).toBeGreaterThan(0)
      expect(['auto', 'scroll']).toContain(box.overflowX)
      expect(box.scrollWidth).toBeGreaterThanOrEqual(box.clientWidth)
    }
  }
  await sourceCard.getByRole('button', { name: 'Ver execuções' }).click()
  const countersBox = await sourceCard.locator('.tp-monitor-source-counters').boundingBox()
  const toggleBox = await sourceCard.getByRole('button', { name: 'Ocultar execuções' }).boundingBox()
  expect(countersBox).not.toBeNull()
  expect(toggleBox).not.toBeNull()
  if ((page.viewportSize()?.width ?? 0) <= 760) {
    expect(countersBox!.width).toBeGreaterThan(180)
    expect(countersBox!.y + countersBox!.height).toBeLessThanOrEqual(toggleBox!.y + 1)
  }
  const runHistory = sourceCard.locator('.tp-run-history')
  const expectedRunHeadings = [
    'Tentativas', 'Encontradas', 'Descartadas', 'Mantidas',
    'Processadas', 'Importadas', 'Duração',
  ]
  for (const [index, label] of expectedRunHeadings.entries()) {
    await expect(runHistory.locator('.tp-run-history-head > span').nth(index + 2)).toContainText(label)
  }
  // Exactly six visible "|" separators, from Encontradas through Duração.
  await expect(runHistory.locator('.tp-run-history-head i')).toHaveCount(6)
  for (let i = 3; i <= 8; i += 1) {
    expect(await runHistory.locator('.tp-run-history-row > span').nth(i).evaluate(
      (span) => window.getComputedStyle(span, '::before').content,
    )).toBe('"|"')
  }
  await expect(runHistory.locator('.tp-run-history-row > span').nth(3)).toHaveText('10')
  await expect(runHistory.locator('.tp-run-history-row > span').nth(4)).toHaveText('3')
  await expect(runHistory.locator('.tp-run-history-row > span').nth(5)).toHaveText('6')
  await expect(runHistory.locator('.tp-run-history-row > span').nth(6)).toHaveText('9')
  await expect(runHistory.locator('.tp-run-history-row > span').nth(7)).toHaveText('2')
  // Screenshot is captured pre-merge and retained in CI's test-results artifact.
  await page.screenshot({ path: testInfo.outputPath('mon-01-central-monitoring.png'), fullPage: true })

  await page.getByRole('button', { name: 'Notícias', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Notícias' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Receita Federal orienta sobre IBS e CBS' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Abrir notícia oficial/ })).toHaveAttribute(
    'href',
    'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/exemplo-ibs-cbs',
  )
  await expect(page.getByRole('button', { name: 'Fontes Oficiais', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Empresas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Empresas da conta', level: 2 })).toBeVisible()
  await page.getByLabel('CNPJ da matriz').fill('11222333000181')
  await page.getByLabel('Local Negócio').first().fill('MATRIZ-01')
  await page.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }).click()
  // ONB-01 forwards new organizations to the current Tax Profile screen.
  await expect(page.getByRole('tab', { name: /Perfil tributário/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: /Empresas/ }).click()
  await expect(page.getByText('Empresa Launch Ltda').first()).toBeVisible()
  await expect(page.getByText('MATRIZ-01').first()).toBeVisible()

  await page.getByRole('tab', { name: /Estabelecimentos/ }).click()
  await expect(page.getByText('4683400')).toBeVisible()
  await expect(page.getByText('10.123.456-2')).toBeVisible()

  await page.getByRole('tab', { name: /Perfil tributário/ }).click()
  await expect(page.getByRole('button', { name: 'Adicionar produto', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Adicionar NCM', exact: true })).toBeVisible()
  const cnaeSegment = page.getByRole('combobox', { name: 'Segmento do CNAE 4683400' })
  await expect(cnaeSegment).toHaveValue('sector.wholesale')
  await cnaeSegment.selectOption('sector.agri_inputs')
  // The CNAE segment shows as selected in the Segmento card, marked as from the CNAE.
  const companyTaxonomy = page.getByRole('region', { name: 'Taxonomia da empresa', exact: true })
  const segmentCard = companyTaxonomy.getByRole('region', { name: 'Setor', exact: true })
  const segmentSelected = segmentCard.getByLabel('Selecionados')
  await expect(segmentSelected).toContainText('Insumos agrícolas')
  await expect(segmentSelected).toContainText('do CNAE 4683400')
  // Removing it there asks first and clears the CNAE row.
  await segmentSelected.getByRole('button', { name: 'Remover Insumos agrícolas' }).click()
  await expect(page.getByRole('dialog', { name: 'Remover segmento?' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Remover segmento?' }).getByRole('button', { name: 'Remover', exact: true }).click()
  await expect(cnaeSegment).toHaveValue('')
  await expect(segmentSelected).not.toContainText('Insumos agrícolas')
  await cnaeSegment.selectOption('sector.agri_inputs')
  // Card NCM between Produto and the next card.
  await expect(companyTaxonomy.getByRole('region', { name: 'NCM', exact: true })).toBeVisible()
  await page.getByLabel('Regime tributário').selectOption('LUCRO_REAL')
  await page.getByLabel('Palavras-chave adicionais').fill('crédito presumido')
  for (const label of ['ICMS', 'Agronegócio', 'Fertilizantes', 'Venda', 'NF-e', 'EFD']) {
    await companyTaxonomy.getByText(label, { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Salvar Perfil Tributário', exact: true }).click()
  await expect(page.getByText('Perfil v1')).toBeVisible()

  // A successful second registration must never expose the cached first profile
  // while the account readback is still in flight.
  const secondCompanyId = '22222222-2222-4222-8222-222222222223'
  let releaseAccount!: () => void
  const accountGate = new Promise<void>((resolve) => { releaseAccount = resolve })
  let accountReadbackStarted = false
  let oldCompanyWrites = 0
  page.on('request', (request) => {
    if (request.url().includes(`/companies/${companyId}/`) &&
        !['GET', 'OPTIONS'].includes(request.method())) oldCompanyWrites += 1
  })
  await page.route('**/api/v1/account', async (route) => {
    accountReadbackStarted = true
    await accountGate
    await route.fulfill({ json: {
      tenant: { id: tenantId, name: 'Empresa Launch', slug: 'empresa-launch', status: 'ACTIVE' },
      onboarding: { companyName: 'Empresa Launch', cnpj: null, createdAt: '2026-09-30T00:00:00.000Z' },
      companies: [
        { id: companyId, legalName: 'Empresa Launch Ltda', cnpj: '11222333000181', isActive: true, establishmentCount: 1 },
        { id: secondCompanyId, legalName: 'Segunda Empresa Ltda', cnpj: '04252011000110', isActive: true, establishmentCount: 1 },
      ],
    } })
  })
  await page.route('**/api/v1/companies/from-cnpj', (route) => route.fulfill({
    status: 201,
    json: { company: { id: secondCompanyId, legalName: 'Segunda Empresa Ltda', cnpj: '04252011000110' }, establishment: {} },
  }))
  await page.route(`**/api/v1/companies/${secondCompanyId}/**`, (route) => {
    const path = new URL(route.request().url()).pathname
    const json = path.endsWith('/tax-profile') ? { profile: null }
      : path.endsWith('/taxonomy-suggestions') ? { cnaes: [], suggestions: [] }
        : { items: [] }
    return route.fulfill({ json })
  })
  await page.getByRole('tab', { name: /Empresas/ }).click()
  await page.getByRole('button', { name: 'Adicionar empresa', exact: true }).click()
  await page.getByLabel('CNPJ da matriz').fill('04252011000110')
  await page.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }).click()
  await expect.poll(() => accountReadbackStarted).toBe(true)
  await expect(page.getByRole('tab', { name: /Perfil tributário/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('Carregando empresa selecionada…', { exact: true })).toBeVisible()
  await expect(page.locator('.tp-tax-profile-editor')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Salvar Perfil Tributário', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Regime tributário')).toHaveCount(0)
  expect(oldCompanyWrites).toBe(0)
  releaseAccount()
  await expect(page.locator('.tp-tax-profile-editor')).toBeVisible()
  await expect(page.locator('.tp-profile-context')).toContainText('04.252.011/0001-10')
  await expect(page.locator('.tp-profile-context')).not.toContainText('11.222.333/0001-81')
  await expect(page.getByRole('button', { name: 'Salvar Perfil Tributário', exact: true })).toBeVisible()
  expect(oldCompanyWrites).toBe(0)

  await page.getByRole('button', { name: 'Menu do usuário', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()

  await page.getByRole('button', { name: 'Menu do usuário', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
