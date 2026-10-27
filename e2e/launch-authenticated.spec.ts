import agrex from './fixtures/agrex-35.json' with {type:'json'}
import { expect, test } from '@playwright/test'

test.use({video:'on',actionTimeout:15000})

const tenantId = '11111111-1111-4111-8111-111111111111'
const companyId = '22222222-2222-4222-8222-222222222222'
const establishmentId = '33333333-3333-4333-8333-333333333333'
const branchId='33333333-3333-4333-8333-333333333334'
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
  test.setTimeout(120000)
  const archiveRequests: URL[] = []
  let branchAdded=false
  let companyCreated = false
  let profileSaved = false
  let currentIe='10.123.456-2'

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
          legalName: 'AGREX — ambiente de teste',
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
          legalName: 'AGREX — ambiente de teste',
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
          stateRegistration: currentIe,
          stateRegistrationStatus: 'ATIVO - HABILITADO',
          stateRegistrationLookupStatus: 'SUCCESS',
          stateRegistrationSource: 'SEFAZ_GO_SINTEGRA',
          stateRegistrationCheckedAt: '2026-09-30T10:00:00.000Z',
          cnaes: [{
            code: '0111301',
            description: 'Cultivo de arroz',
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
        stateRegistration: currentIe,
        stateRegistrationStatus: 'ATIVO - HABILITADO',
        stateRegistrationLookupStatus: 'SUCCESS',
        stateRegistrationSource: 'SEFAZ_GO_SINTEGRA',
        stateRegistrationCheckedAt: '2026-09-30T10:00:00.000Z',
        isActive: true,
        cnaes: [{
          code: '0111301',
          description: 'Cultivo de arroz',
          isPrimary: true,
        },...extraSegmentActivities.map(([,label,code])=>({code,description:label+' — atividade sintética',isPrimary:false}))],
      }, ...(branchAdded?[{
        id:branchId,companyId,cnpj:'11222333000262',name:'Filial teste',typeCode:'OFFICE',isHeadOffice:false,uf:'GO',
        municipalityName:'Goiânia',municipalityIbgeCode:'5208707',postalCode:null,street:null,streetNumber:null,complement:null,district:null,businessLocationCode:null,
        stateRegistration:null,stateRegistrationStatus:null,stateRegistrationLookupStatus:'UNAVAILABLE',stateRegistrationSource:null,stateRegistrationCheckedAt:null,isActive:true,
        cnaes:[{code:'0111301',description:'Cultivo de arroz',isPrimary:true}],
      }]:[])] : [],
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
      cnaes: [{ cnaeCode: '0111301', isPrimary: true, segments: [{ code: 'sector.wholesale', label: 'Comércio atacadista' }] }],
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
        { cnaeCode: '0111301', segmentCode: 'sector.agri_inputs' },
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
  await page.route('**/api/v1/onboarding/phrases',route=>route.fulfill({json:{items:[{segment:'agro',phrases:['Contando os grãos da safra.','Conferindo se o trator tem NCM.','Regando o perfil tributário.'],version_no:1},{segment:'generico',phrases:['Preparando seu perfil.'],version_no:1}]}}))
  const assistantData={version:0,release:{id:releaseId,version:'v1.9.0'},companyName:'AGREX — ambiente de teste',companyCnpj:agrex.provenance.cnpj,
    state:{completed:false,cards:{} as Record<string,unknown>,units:{} as Record<string,{cards:Record<string,unknown>}>},
    concepts:[...agrex.concepts],cards:agrex.cards.map(c=>({...c,establishmentId})),
    historicalConcepts:[{code:'product.retired',label:'Produto histórico de teste',dimensionCode:'product'}],
    effectiveProfiles:[{establishmentId,name:'Matriz Goiânia',isHeadOffice:true,taxRegime:'NAO_INFORMADO',conceptCodes:[] as string[],ncmCodes:[] as string[],legacyFields:{} as Record<string,string[]>,cnaeSegments:[],historicalCodes:[] as string[]}]}
  expect(new Set(assistantData.cards.map(c=>c.cnaeCode)).size).toBe(35)
  expect(assistantData.cards.filter(c=>c.segmentCode==='sector.agro')).toHaveLength(15)
  await page.route(`**/api/v1/companies/${companyId}/onboarding`,async route=>{
    if(route.request().method()==='PUT'){
      const b=route.request().postDataJSON()
      expect(b.expectedVersion).toBe(assistantData.version)
      const choice={status:b.status,conceptCodes:b.conceptCodes,ncmCodes:b.ncmCodes}
      if(b.units){for(const u of b.units){assistantData.state.units[u.establishmentId]??={cards:{}};assistantData.state.units[u.establishmentId]!.cards[b.cardId]={status:b.status,conceptCodes:u.conceptCodes,ncmCodes:u.ncmCodes};Object.assign(assistantData.effectiveProfiles.find(p=>p.establishmentId===u.establishmentId)!,u)}}
      else if(b.cardId==='profile'){const p=assistantData.effectiveProfiles.find(p=>p.establishmentId===b.establishmentId)!;Object.assign(p,{conceptCodes:b.conceptCodes,ncmCodes:b.ncmCodes,legacyFields:b.legacyFields??p.legacyFields,historicalCodes:[]});assistantData.state.units[b.establishmentId]??={cards:{}};assistantData.state.units[b.establishmentId]!.cards.profile=choice}
      else assistantData.state.cards[b.cardId]=choice
      assistantData.version++;assistantData.state.completed=b.cardId==='summary'
    }
    await route.fulfill({json:{...assistantData,segmentCards:assistantData.cards}})
  })
  await page.getByLabel('CNPJ da matriz').fill('11222333000181')
  await page.getByLabel('Local Negócio').first().fill('MATRIZ-01')
  await page.screenshot({path:testInfo.outputPath('01-cnpj.png'),fullPage:false})
  await page.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }).click()
  // ONB-03 opens the assistant, leaving company and units on one screen.
  const assistant=page.getByRole('dialog',{name:'Assistente do perfil tributário'})
  await expect(assistant).toBeVisible()
  await expect(assistant.getByRole('status')).toBeVisible()
  await expect(assistant.locator('.onb-progress')).toHaveCount(0)
  await expect(assistant.locator('.onb-loading-track')).toHaveCount(1)
  await page.screenshot({path:testInfo.outputPath('02-animacao.png'),fullPage:false})
  await expect(assistant.getByRole('heading',{name:'Estes são os dados da sua empresa?',exact:true})).toBeVisible({timeout:10000})
  await expect(assistant.locator('.onb-counter')).toBeVisible()
  const actions=await assistant.locator('.onb-footer').evaluate(el=>{const a=el.children[0]!.getBoundingClientRect(),b=el.children[1]!.getBoundingClientRect();return {sameRow:Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom),overflow:el.scrollWidth>el.clientWidth}})
  expect(actions).toEqual({sameRow:true,overflow:false})
  await page.screenshot({path:testInfo.outputPath('03-card-empresa.png'),fullPage:false})
  // IE can be edited and read back without leaving the modal (all four viewports).
  await page.route(`**/api/v1/companies/${companyId}/establishments/${establishmentId}/state-registration`,async route=>{
    expect(route.request().method()).toBe('PATCH')
    expect(route.request().headers()['x-tenant-id']).toBe(tenantId)
    const body=route.request().postDataJSON()
    expect(Object.keys(body).sort()).toEqual(['expectedStateRegistration','stateRegistration'])
    expect(body.expectedStateRegistration).toBe(currentIe)
    currentIe=body.stateRegistration
    await route.fulfill({json:{establishmentId,stateRegistration:currentIe,stateRegistrationSource:'MANUAL'}})
  })
  await assistant.getByRole('button',{name:'Salvar e continuar'}).click()
  await expect(assistant.getByRole('heading',{name:'Confira seus estabelecimentos',exact:true})).toBeVisible()
  const ie=assistant.getByLabel('Inscrição Estadual — Matriz Goiânia')
  await ie.fill('109876543')
  await expect(assistant.getByRole('button',{name:'Salvar e continuar'})).toBeEnabled()
  await expect(assistant.getByRole('button',{name:'Salvar IE',exact:true})).toHaveCount(0)
  await page.screenshot({path:testInfo.outputPath('04-card-estabelecimentos-ie.png'),fullPage:false})
  await assistant.getByRole('button',{name:'Salvar e continuar'}).click()
  expect(currentIe).toBe('109876543')
  await expect(assistant.getByRole('heading',{name:'Agropecuária, pesca e insumos agrícolas: o que você compra, vende ou produz?'})).toBeVisible()
  await expect(assistant.getByRole('checkbox',{name:/^Arroz NCM 1006$/})).not.toBeChecked()
  await assistant.getByText('Ver 15 atividades deste segmento',{exact:true}).click()
  await expect(assistant.getByText(/0111301.*Cultivo de arroz/)).toBeVisible()
  await expect(assistant.getByText('NCM 1006',{exact:true})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('05a-sugestoes-sem-preselecao.png'),fullPage:false})
  await expect(assistant.locator('.onb-suggestions .onb-suggestion')).toHaveCount(8)
  await expect(assistant.getByRole('button',{name:/sugestões · mostrar mais/})).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('05b-agro-15-cnaes-mostrar-mais.png'),fullPage:false})
  await assistant.getByRole('button',{name:/sugestões · mostrar mais/}).click()
  await page.screenshot({path:testInfo.outputPath('05c-agro-expandido.png'),fullPage:false})
  await assistant.getByRole('checkbox',{name:/^Arroz NCM 1006$/}).check()
  await expect(assistant.locator('.onb-counter')).toContainText('1 item')
  await expect(assistant.locator('.onb-counter')).toContainText('1 NCM')
  await page.screenshot({path:testInfo.outputPath('05-cnae-0111301-arroz-1006.png'),fullPage:false})
  await assistant.getByRole('button',{name:'Salvar e continuar'}).click()
  const otherSegments=[...new Set(agrex.cards.map(c=>c.segmentLabel))].filter(label=>label!=='Agropecuária, pesca e insumos agrícolas').sort((a,b)=>a.localeCompare(b,'pt-BR'))
  for(const [number,label] of otherSegments.entries()){
    await expect(assistant.getByRole('heading',{name:label+': o que você compra, vende ou produz?'})).toBeVisible()
    await page.screenshot({path:testInfo.outputPath('segmento-'+number+'.png'),fullPage:false})
    await assistant.getByRole('button',{name:'Pular',exact:true}).click()
  }
  await expect(assistant.getByRole('heading',{name:'Tudo pronto! Confira seu perfil',exact:true})).toBeVisible()
  await expect(assistant.locator('.onb-progress i')).toHaveAttribute('style','width: 100%;')
  await expect(assistant.getByRole('button',{name:'Revisar',exact:true})).toHaveCount(0)
  await page.screenshot({path:testInfo.outputPath('06-resumo.png'),fullPage:false})
  await assistant.getByRole('button',{name:'Concluir perfil',exact:true}).click()
  await expect(assistant).toHaveCount(0)

  await expect(page.getByRole('heading',{name:'Empresa e filiais',exact:true})).toBeVisible()
  await expect(page.getByRole('tab',{name:/Estabelecimentos/})).toHaveCount(0)
  await expect(page.getByText('AGREX — ambiente de teste').first()).toBeVisible()
  await expect(page.getByText('MATRIZ-01').first()).toBeVisible()
  await expect(page.getByText('0111301')).toBeVisible()
  await expect(page.getByText('109876543')).toBeVisible()
  // Read-only reopen of a historical profile; only this isolated mocked record is edited.
  Object.assign(assistantData.effectiveProfiles[0]!,{conceptCodes:['product.rice','product.retired'],ncmCodes:['1006','2716'],legacyFields:{products:['Escolha manual anterior'],operations:['Revenda']},historicalCodes:['product.retired']})
  await page.getByRole('button',{name:'Abrir assistente',exact:true}).click()
  await expect(assistant.getByRole('heading',{name:'Tudo pronto! Confira seu perfil'})).toBeVisible()
  await assistant.locator('.onb-body').evaluate(el=>el.scrollTo(0,el.scrollHeight))
  await page.screenshot({path:testInfo.outputPath('06b-legado-resumo-completo.png'),fullPage:false})
  await assistant.getByRole('button',{name:'Editar escolhas — Matriz Goiânia'}).click()
  await assistant.getByRole('checkbox',{name:/Produto histórico de teste/}).scrollIntoViewIfNeeded()
  await expect(assistant.getByRole('checkbox',{name:/Produto histórico de teste/})).toBeChecked()
  await page.screenshot({path:testInfo.outputPath('06c-legado-aberto-no-assistente.png'),fullPage:false})
  await assistant.getByRole('checkbox',{name:/Produto histórico de teste/}).uncheck()
  await assistant.getByRole('checkbox',{name:'NCM 2716'}).uncheck()
  await assistant.getByRole('checkbox',{name:/Escolha manual anterior/}).uncheck()
  await assistant.getByRole('button',{name:'Salvar escolhas deste estabelecimento'}).click()
  await expect(assistant.getByRole('button',{name:'Cancelar edição'})).toHaveCount(0)
  expect(assistantData.effectiveProfiles[0]!.conceptCodes).toEqual(['product.rice'])
  expect(assistantData.effectiveProfiles[0]!.ncmCodes).toEqual(['1006'])
  await assistant.getByRole('button',{name:'Fechar assistente'}).click()

  await expect(page.getByRole('tab',{name:/Perfil tributário/})).toHaveCount(0)
  await expect(page.locator('.tp-tax-profile-editor')).toHaveCount(0)

  // Add a filial after the matrix was concluded: it has its own empty card.
  await page.route(`**/api/v1/companies/${companyId}/establishments/from-cnpj`,async route=>{
    expect(route.request().postDataJSON().cnpj).toBe('11222333000262')
    expect(route.request().postDataJSON().typeCode).toBe('OFFICE')
    expect(route.request().headers()['x-tenant-id']).toBe(tenantId)
    branchAdded=true;assistantData.state.completed=false
    assistantData.cards.push({...assistantData.cards.find(c=>c.cnaeCode==='0111301')!,establishmentId:branchId});assistantData.effectiveProfiles.push({establishmentId:branchId,name:'Filial nova de teste',isHeadOffice:false,taxRegime:'NAO_INFORMADO',conceptCodes:[],ncmCodes:[],legacyFields:{},cnaeSegments:[],historicalCodes:[]})
    await route.fulfill({status:201,json:{establishment:{id:branchId}}})
  })
  await page.getByRole('button',{name:'Adicionar estabelecimento',exact:true}).click()
  await page.getByLabel('CNPJ do estabelecimento').fill('11222333000262')
  await page.getByLabel('Tipo',{exact:true}).selectOption('OFFICE')
  await page.getByRole('button',{name:'Consultar CNPJ e adicionar',exact:true}).click()
  await expect(assistant).toBeVisible()
  await expect(assistant.getByRole('heading',{name:'Agropecuária, pesca e insumos agrícolas: o que você compra, vende ou produz?'})).toBeVisible({timeout:10000})
  await expect(assistant.getByLabel('Estabelecimento',{exact:false})).toHaveValue(branchId)
  await expect(assistant.getByRole('checkbox',{name:/Arroz/})).not.toBeChecked()
  expect(assistantData.state.units[branchId]).toBeUndefined()
  expect(assistantData.effectiveProfiles.find(p=>p.establishmentId===establishmentId)!.ncmCodes).toEqual(['1006'])
  expect(assistantData.effectiveProfiles.find(p=>p.establishmentId===branchId)!.ncmCodes).toEqual([])
  await page.screenshot({path:testInfo.outputPath('07-filial-nova-vazia.png'),fullPage:false})
  await assistant.getByRole('button',{name:'Fechar assistente'}).click()

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
        { id: companyId, legalName: 'AGREX — ambiente de teste', cnpj: '11222333000181', isActive: true, establishmentCount: 1 },
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
    const json = path.endsWith('/onboarding') ? {version:0,release:{id:releaseId,version:'v1.9.0'},companyName:'Segunda Empresa Ltda',state:{completed:false,cards:{},units:{}},concepts:[],cards:[]}
      : path.endsWith('/tax-profile') ? { profile: null }
      : path.endsWith('/taxonomy-suggestions') ? { cnaes: [], suggestions: [] }
        : { items: [] }
    return route.fulfill({ json })
  })
  await page.getByRole('button', { name: 'Adicionar empresa', exact: true }).click()
  await page.getByLabel('CNPJ da matriz').fill('04252011000110')
  await page.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }).click()
  await expect.poll(() => accountReadbackStarted).toBe(true)
  await expect(page.getByRole('heading',{name:'Empresa e filiais',exact:true})).toBeVisible()
  await expect(page.getByText('Carregando empresa selecionada…', { exact: true })).toBeVisible()
  await expect(page.locator('.tp-tax-profile-editor')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Salvar Perfil Tributário', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Regime tributário')).toHaveCount(0)
  expect(oldCompanyWrites).toBe(0)
  releaseAccount()
  await expect(page.getByRole('dialog',{name:'Assistente do perfil tributário'})).toBeVisible()
  await page.getByRole('button',{name:'Fechar assistente'}).click()
  await expect(page.locator('.tp-tax-profile-editor')).toHaveCount(0)
  await expect(page.getByRole('tab',{name:/Perfil tributário/})).toHaveCount(0)
  expect(oldCompanyWrites).toBe(0)
  // A new deployment keeps the open form draft and prevents further writes.
  await page.getByRole('button',{name:'Editar empresa',exact:true}).last().click()
  const draft=page.getByLabel('Razão social',{exact:true})
  await draft.fill('Rascunho preservado')
  await page.route('**/build-version.json*',route=>route.fulfill({json:{id:'new-deployment-after-this-build'}}))
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('alert')).toContainText('Há uma versão nova do TriFaros. Recarregue a página para continuar.')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(draft).toHaveValue('Rascunho preservado')
  await page.getByRole('alert').scrollIntoViewIfNeeded()
  const overlap=await page.evaluate(()=>{const notice=document.querySelector('.tp-version-notice')!.getBoundingClientRect(),input=document.querySelector('input[aria-label=\"Razão social\"]')?.getBoundingClientRect();return input?notice.top<input.bottom&&notice.bottom>input.top:false})
  expect(overlap).toBe(false)
  await page.screenshot({path:testInfo.outputPath('08-nova-versao-rascunho.png'),fullPage:false})

  await page.getByRole('button', { name: 'Menu do usuário', exact: true }).click()
  await page.getByRole('button', { name: 'Abrir configurações', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()

  await page.getByRole('button', { name: 'Menu do usuário', exact: true }).click()
  await page.getByRole('button', { name: 'Sair da conta', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

