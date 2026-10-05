import { expect, test } from '@playwright/test'

test('curator imports segment hierarchy and sees CNAE code before description', async ({ page }) => {
  const release = { id: 'draft', version: 'v1.3.0', status: 'DRAFT', createdAt: '2026-10-05T03:00:00Z', publishedAt: null, previousReleaseId: null, changeNotes: null }
  const dimension = { id: 'sector', code: 'sector', name: 'Segmento', description: null, revisionNo: 1, configured: true, profileVisible: true, profileOrder: 1, helpText: null, detailSection: 'Segmentos', detailOrder: 1, usesGroups: true, officialCodeType: 'CNAE', conceptCount: 0 }
  const concepts: Record<string, unknown>[] = [], groups: Record<string, unknown>[] = []
  await page.route('**/auth/refresh', route => route.fulfill({ json: { accessToken: 'test-curator-token', tokenType: 'Bearer', expiresIn: 900 } }))
  await page.route('**/auth/me', route => route.fulfill({ json: { user: { id: 'curator', email: 'owner@example.test', name: null }, memberships: [] } }))
  await page.route('**/api/v1/admin/me', route => route.fulfill({ json: { taxonomyCurator: true, curatorDatabase: true } }))
  await page.route('**/api/v1/admin/taxonomy/**', async route => {
    const url = new URL(route.request().url()).pathname
    let result: unknown
    if (url.endsWith('/state')) result = { published: null, draft: release, curatorDatabase: true, settings: { classificationEnabled: false, classificationExcludedSources: ['doe-sp'], updatedAt: {}, updatedBy: {} }, engine: { key: 'test', version: '1' }, progress: null, catalogs: [] }
    else if (url.endsWith('/releases/draft')) result = { release, dimensions: [{ ...dimension, conceptCount: concepts.length }], concepts, groups }
    else if (url.endsWith('/concepts')) {
      const body = route.request().postDataJSON()
      concepts.push({ ...body, releaseConceptId: body.code, dimensionCode: 'sector', membershipStatus: 'INCLUDED', groupId: null, aliases: [], officialCodes: [], releaseNotes: null })
      result = { code: body.code }
    } else if (url.endsWith('/groups')) {
      const body = route.request().postDataJSON()
      groups.push({ ...body, id: 'group1', code: 'group1', dimensionCode: 'sector', officialCodes: [] })
      result = { id: 'group1' }
    } else if (url.endsWith('/rows')) {
      const body = route.request().postDataJSON()
      expect(body.retire).toEqual([])
      const created: string[] = []
      for (const row of body.rows) {
        const code = `sector.cnae_${row.officialCodes[0]}`
        created.push(code)
        concepts.push({ ...row, code, releaseConceptId: code, dimensionCode: 'sector', membershipStatus: 'INCLUDED', groupId: 'group1', releaseNotes: null })
      }
      result = { created, updated: 0, retired: 0, groupsCreated: 0 }
    } else throw new Error(`Unexpected mutation: ${url}`)
    await route.fulfill({ json: result })
  })
  await page.goto('/admin/taxonomia')
  await expect(page.getByRole('heading', { name: 'Curadoria da Taxonomia' })).toBeVisible()
  const payload = {
    format: 'trifaros-segmentos-cnae-v1', sourceWorkbook: 'test.xlsx', sourceUrl: 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses',
    segments: [{ id: 'AGRO', name: 'Agropecuária', definition: 'Produção agrícola.' }],
    subsegments: [{ id: 'AGRO-PROD', name: 'Agropecuária / Produção', segmentId: 'AGRO' }],
    rows: [{ cnae: '0111301', description: 'Cultivo de arroz', segmentId: 'AGRO', subsegmentId: 'AGRO-PROD', synonyms: ['produção de arroz', 'rizicultura'] }],
  }
  await page.locator('.tc-file-button input[type=file]').setInputFiles({ name: 'segmentos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
  await expect(page.getByText(/Conferido no rascunho: 1 CNAEs/)).toBeVisible()
  const table = page.getByRole('table', { name: 'Itens de Segmento' })
  const headers = await table.getByRole('columnheader').allTextContents()
  expect(headers.indexOf('CNAE')).toBeLessThan(headers.indexOf('Descrição do CNAE'))
  await expect(table.getByLabel('CNAE', { exact: true })).toHaveValue('0111-3/01')
  await expect(table.getByLabel('Descrição do CNAE', { exact: true })).toHaveValue('Cultivo de arroz')
  await expect(table.getByLabel('Subsegmento', { exact: true })).toHaveValue('Agropecuária / Produção')
  await expect(table.getByText('Agropecuária', { exact: true })).toBeVisible()
  await expect(table.getByText('rizicultura', { exact: true })).toBeVisible()
  await expect(page.getByText('Desligada', { exact: true })).toBeVisible()
})
