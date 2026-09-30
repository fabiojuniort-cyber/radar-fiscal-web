import { expect, test } from '@playwright/test'

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

test('LAUNCH-01 authenticated release candidate screens and account setup work end-to-end', async ({ page }) => {
  let companyCreated = false
  let establishmentCreated = false
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
        tenantId: '11111111-1111-4111-8111-111111111111',
        tenantName: 'Empresa Launch',
        tenantSlug: 'empresa-launch',
        role: 'OWNER',
      }],
    }),
  }))

  await page.route('**/public/v1/stats', (route) => route.fulfill({
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

  await page.route('**/public/v1/sources', (route) => route.fulfill({
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

  await page.route('**/api/v1/archive?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      page: 1,
      limit: 25,
      hasMore: false,
      items: [{
        id: '55555555-5555-4555-8555-555555555555',
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
      }],
    }),
  }))

  await page.route('**/api/v1/publications/55555555-5555-4555-8555-555555555555', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      publication: {
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Ato oficial real do Acervo',
        actType: 'IN',
        actNumber: '99/2026',
        agency: 'Receita Federal',
        jurisdictionLevel: 'FEDERAL',
        uf: null,
        publishedOn: '2026-09-30',
        effectiveOn: '2026-10-01',
        officialUrl: 'https://example.test/oficial',
        firstCollectedAt: '2026-09-30T00:00:00.000Z',
        lastSeenAt: '2026-09-30T00:00:00.000Z',
      },
      version: {
        id: '66666666-6666-4666-8666-666666666666',
        versionNo: 1,
        versionCount: 1,
        contentText: 'CAPÍTULO I\n\nArt. 1º  Texto oficial.\n    I - primeiro item;\n    II - segundo item.',
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
        officialUrl: 'https://example.test/oficial',
        externalId: 'ato-99',
        firstSeenAt: '2026-09-30T00:00:00.000Z',
        lastSeenAt: '2026-09-30T00:00:00.000Z',
      }],
    }),
  }))

  await page.route('**/api/v1/account', async (route) => {
    expect(route.request().headers()['x-tenant-id'])
      .toBe('11111111-1111-4111-8111-111111111111')

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant: {
          id: '11111111-1111-4111-8111-111111111111',
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
          id: '22222222-2222-4222-8222-222222222222',
          legalName: 'Empresa Launch Ltda',
          tradeName: 'Empresa Launch',
          cnpj: '11222333000181',
          isActive: true,
          establishmentCount: establishmentCreated ? 1 : 0,
        }] : [],
      }),
    })
  })

  await page.route('**/api/v1/companies/from-cnpj', async (route) => {
    expect(route.request().method()).toBe('POST')
    companyCreated = true
    establishmentCreated = true
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        company: {
          id: '22222222-2222-4222-8222-222222222222',
          legalName: 'Empresa Launch Ltda',
          tradeName: 'Empresa Launch',
          cnpj: '11222333000181',
        },
        establishment: {
          id: '33333333-3333-4333-8333-333333333333',
          companyId: '22222222-2222-4222-8222-222222222222',
          cnpj: '11222333000181',
          name: 'Empresa Launch',
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

  await page.route(
    /\/api\/v1\/companies\/22222222-2222-4222-8222-222222222222$/,
    async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue()
        return
      }

      companyCreated = false
      establishmentCreated = false
      await route.fulfill({
        status: 204,
        body: '',
      })
    },
  )

  await page.route('**/api/v1/establishment-types', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: [
        { code: 'HEAD_OFFICE', name: 'Matriz' },
        { code: 'OFFICE', name: 'Escritório' },
      ],
    }),
  }))

  await page.route('**/api/v1/companies/22222222-2222-4222-8222-222222222222/establishments', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      items: establishmentCreated ? [{
        id: '33333333-3333-4333-8333-333333333333',
        companyId: '22222222-2222-4222-8222-222222222222',
        cnpj: '11222333000181',
        name: 'Matriz Goiânia',
        typeCode: 'HEAD_OFFICE',
        isHeadOffice: true,
        uf: 'GO',
        municipalityName: 'Goiânia',
        municipalityIbgeCode: null,
        postalCode: null,
        street: null,
        streetNumber: null,
        complement: null,
        district: 'Centro',
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


  await page.route('**/api/v1/taxonomy/profile-options', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        release: {
          id: '77777777-7777-4777-8777-777777777777',
          version: 'v1.0.0',
          publishedAt: '2026-09-30T00:00:00.000Z',
        },
        dimensions: [
          {
            code: 'tax',
            name: 'Tributo',
            description: null,
            concepts: [{
              code: 'tax.icms',
              label: 'ICMS',
              definition: 'Imposto sobre circulação.',
            }],
          },
          {
            code: 'sector',
            name: 'Setor',
            description: null,
            concepts: [{
              code: 'sector.agribusiness',
              label: 'Agronegócio',
              definition: 'Atividades do agronegócio.',
            }],
          },
          {
            code: 'product',
            name: 'Produto',
            description: null,
            concepts: [{
              code: 'product.fertilizer',
              label: 'Fertilizantes',
              definition: 'Fertilizantes e afins.',
            }],
          },
          {
            code: 'operation',
            name: 'Operação',
            description: null,
            concepts: [{
              code: 'operation.sale',
              label: 'Venda',
              definition: 'Operação de venda.',
            }],
          },
          {
            code: 'document',
            name: 'Documento',
            description: null,
            concepts: [{
              code: 'document.nfe',
              label: 'NF-e',
              definition: 'Nota Fiscal eletrônica.',
            }],
          },
          {
            code: 'obligation',
            name: 'Obrigação',
            description: null,
            concepts: [{
              code: 'obligation.efd',
              label: 'EFD',
              definition: 'Escrituração Fiscal Digital.',
            }],
          },
        ],
      }),
    })
  })

  await page.route('**/api/v1/companies/22222222-2222-4222-8222-222222222222/tax-profile', async (route) => {
    if (route.request().method() === 'PUT') {
      profileSaved = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: '44444444-4444-4444-8444-444444444444',
            companyId: '22222222-2222-4222-8222-222222222222',
            versionNo: 1,
            taxRegime: 'LUCRO_REAL',
            segments: ['Agronegócio'],
            activities: ['Venda de insumos'],
            personalization: {
              taxes: ['ICMS'],
              products: ['Fertilizantes'],
              operations: ['Venda interestadual'],
              documents: ['NF-e'],
              obligations: ['EFD'],
              keywords: ['crédito presumido'],
              taxonomy: {
                releaseId: '77777777-7777-4777-8777-777777777777',
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
          },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        profile: profileSaved ? {
          id: '44444444-4444-4444-8444-444444444444',
          companyId: '22222222-2222-4222-8222-222222222222',
          versionNo: 1,
          taxRegime: 'LUCRO_REAL',
          segments: ['Agronegócio'],
          activities: ['Venda de insumos'],
          personalization: {
            taxes: ['ICMS'],
            products: ['Fertilizantes'],
            operations: ['Venda interestadual'],
            documents: ['NF-e'],
            obligations: ['EFD'],
            keywords: ['crédito presumido'],
          },
          validFrom: '2026-09-30',
        } : null,
      }),
    })
  })

  await page.route('**/auth/logout', (route) => route.fulfill({
    status: 204,
    headers: {
      'set-cookie': 'radar_refresh_token=; Max-Age=0; HttpOnly; Path=/auth; SameSite=Strict',
    },
  }))

  await page.goto('/')
  await openLogin(page)

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('E-mail').fill('owner@example.test')
  await dialog.getByLabel('Senha').fill('Only-For-Browser-Test!1')
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()

  await expect(page).toHaveURL(/\/painel$/)
  await expect(page.getByRole('heading', { name: 'Olá, Owner.' })).toBeVisible()
  await expect(page.getByText('321')).toBeVisible()

  await page.getByRole('button', { name: 'Publicações' }).click()
  await expect(page.getByRole('heading', { name: 'Publicações' })).toBeVisible()
  await expect(page.getByText('Ato oficial real do Acervo')).toBeVisible()

  await page
    .getByRole('link', {
      name: 'Abrir legislação no TriBusca: IN 99/2026',
    })
    .click()

  await expect(page).toHaveURL(
    /\/painel\/publicacoes\/55555555-5555-4555-8555-555555555555$/,
  )
  await expect(
    page.getByRole('heading', {
      name: 'Ato oficial real do Acervo',
    }),
  ).toBeVisible()

  const preservedHtml = page.locator(
    '.publication-preserved-html',
  )
  await expect(
    preservedHtml.getByRole('heading', {
      name: 'CAPÍTULO I',
    }),
  ).toBeVisible()
  await expect(
    preservedHtml.getByRole('cell', {
      name: 'ICMS',
    }),
  ).toBeVisible()
  await expect(
    preservedHtml.getByRole('cell', {
      name: 'Primeiro item',
    }),
  ).toBeVisible()

  const officialLink = page.getByRole('link', {
    name: 'Abrir fonte oficial',
  })
  await expect(officialLink).toHaveAttribute(
    'href',
    'https://example.test/oficial',
  )
  await expect(officialLink).toHaveAttribute(
    'target',
    '_blank',
  )

  await page
    .getByRole('link', {
      name: 'Voltar ao Acervo',
    })
    .click()
  await expect(page).toHaveURL(/\/painel$/)

  await page.getByRole('button', { name: 'Acervo' }).click()
  await expect(page.getByRole('heading', { name: 'Acervo' })).toBeVisible()
  await page.getByLabel('Pesquisar no Acervo').fill('ICMS')
  await page.getByRole('button', { name: 'Buscar' }).click()

  await page.getByRole('button', { name: 'Central de Monitoramento' }).click()
  await expect(page.getByRole('heading', { name: 'Central de Monitoramento' })).toBeVisible()
  await expect(page.getByText('DOU')).toBeVisible()

  await page.getByRole('button', { name: 'Fontes Oficiais' }).click()
  await expect(page.getByRole('heading', { name: 'Fontes Oficiais' })).toBeVisible()

  await page.getByRole('button', { name: 'Empresas' }).click()
  await expect(page.getByRole('heading', { name: 'Empresas da conta', level: 2 })).toBeVisible()
  await page.getByLabel('CNPJ da matriz').fill('11222333000181')
  await page.getByRole('button', { name: 'Consultar e cadastrar' }).click()
  await expect(page.getByText('Empresa Launch Ltda').first()).toBeVisible()

  await page.getByRole('tab', { name: /Estabelecimentos/ }).click()
  await expect(page.getByText('4683400')).toBeVisible()
  await expect(page.getByText('Goiânia/GO').first()).toBeVisible()
  await expect(page.getByText('10.123.456-2')).toBeVisible()
  await expect(page.getByText(/SEFAZ Goiás · SINTEGRA/)).toBeVisible()

  await page.getByRole('tab', { name: /Perfil tributário/ }).click()
  await page.getByLabel('Regime tributário').selectOption('LUCRO_REAL')
  await page.getByLabel('Palavras-chave adicionais').fill('crédito presumido')
  for (const label of ['ICMS', 'Agronegócio', 'Fertilizantes', 'Venda', 'NF-e', 'EFD']) {
    await page.getByText(label, { exact: true }).click()
  }
  await page.getByRole('button', { name: 'Criar Perfil Tributário' }).click()
  await expect(page.getByText(/Perfil atual v1/)).toBeVisible()

  await page.getByRole('button', { name: 'Empresas' }).click()
  await page.getByRole('tab', { name: /^Empresas/ }).click()
  await page.getByRole('button', { name: 'Excluir' }).click()

  const deleteDialog = page.getByRole('dialog', { name: 'Excluir empresa?' })
  await expect(deleteDialog).toBeVisible()
  await expect(deleteDialog).toContainText('O histórico será preservado')
  await deleteDialog.getByRole('button', { name: 'Excluir empresa' }).click()

  await expect(deleteDialog).toBeHidden()
  await expect(page.getByLabel('CNPJ da matriz')).toBeVisible()

  await page.getByRole('button', { name: 'Menu do usuário' }).click()
  await page.getByRole('button', { name: 'Configurações' }).click()
  await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible()

  await page.getByRole('button', { name: 'Menu do usuário' }).click()
  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
