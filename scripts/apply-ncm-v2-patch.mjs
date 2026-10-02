import { readFileSync, writeFileSync } from 'node:fs'

function replaceRequired(text, before, after, label) {
  if (text.includes(after)) return text
  if (!text.includes(before)) {
    throw new Error(`NCM patch context not found: ${label}`)
  }
  return text.replace(before, after)
}

const panelPath = 'src/authenticated-product-panel.tsx'
let panel = readFileSync(panelPath, 'utf8')

panel = replaceRequired(
  panel,
  "import type { PanelIdentity } from './panel-experience'\nimport { NewsSection as LiveNewsSection } from './news-section'\nimport {",
  "import type { PanelIdentity } from './panel-experience'\nimport { NewsSection as LiveNewsSection } from './news-section'\nimport { ProductNcmProfiles } from './product-ncm-profiles'\nimport {",
  'product NCM import',
)

panel = replaceRequired(
  panel,
  `          {cnaes.length ? (\n            <div className="tp-cnae-profile-table">\n              <div className="tp-cnae-profile-head">\n                <span>CNAE</span><span>Atividade</span><span>Setor</span><span>Produto</span><span>NCM</span>\n              </div>\n              {cnaes.map((cnae) => (\n                <div className="tp-cnae-profile-row" key={cnae.code}>\n                  <b>{cnae.code}</b>\n                  <span>{cnae.description}</span>\n                  <span>{cnaeSector(cnae.code)}</span>\n                  <span className="tp-parameter-empty">Adicionar produto</span>\n                  <span className="tp-parameter-empty">Adicionar NCM</span>\n                </div>\n              ))}\n            </div>\n          ) : (`,
  `          {cnaes.length ? (\n            <ProductNcmProfiles\n              apiFetch={apiFetch}\n              tenantId={tenantId}\n              companyId={company.id}\n              cnaes={cnaes}\n              sectorLabel={cnaeSector}\n            />\n          ) : (`,
  'tax profile CNAE table',
)

writeFileSync(panelPath, panel)

const e2ePath = 'e2e/launch-authenticated.spec.ts'
let e2e = readFileSync(e2ePath, 'utf8')

const publicationNcmRoute = `  await page.route(\`**/api/v1/publications/\${publicationId}/ncms\`, (route) => route.fulfill({\n    status: 200,\n    contentType: 'application/json',\n    body: JSON.stringify({\n      items: [{\n        code: '10063011',\n        description: 'Arroz semibranqueado ou branqueado',\n        verificationStatus: 'CATALOG_MATCHED',\n        method: {\n          type: 'DETERMINISTIC',\n          detectorKey: 'ncm-catalog-v1',\n          detectorVersion: '1',\n        },\n        confidence: 1,\n        excerpt: 'Art. 1º NCM 1006.30.11.',\n      }],\n    }),\n  }))\n\n`

if (!e2e.includes('/ncms`')) {
  const marker = "  await page.route('**/api/v1/account', async (route) => {"
  if (!e2e.includes(marker)) throw new Error('NCM patch context not found: publication NCM route')
  e2e = e2e.replace(marker, publicationNcmRoute + marker)
}

const productProfilesRoute = `  await page.route(\`**/api/v1/companies/\${companyId}/product-profiles\`, (route) => route.fulfill({\n    status: 200,\n    contentType: 'application/json',\n    body: JSON.stringify({ items: [] }),\n  }))\n\n`

if (!e2e.includes('/product-profiles`')) {
  const marker = "  await page.route('**/api/v1/establishment-types', (route) => route.fulfill({"
  if (!e2e.includes(marker)) throw new Error('NCM patch context not found: product profiles route')
  e2e = e2e.replace(marker, productProfilesRoute + marker)
}

e2e = replaceRequired(
  e2e,
  "  await expect(page.getByText('1006.30.11')).toBeVisible()",
  "  await expect(page.getByText('1006.30.11', { exact: true })).toBeVisible()",
  'publication NCM expectation',
)

e2e = replaceRequired(
  e2e,
  "  await expect(page.getByText('Adicionar NCM')).toBeVisible()",
  "  await expect(page.getByRole('button', { name: 'Adicionar produto e NCM' })).toBeVisible()",
  'product NCM profile expectation',
)

writeFileSync(e2ePath, e2e)

console.log('NCM v2 localized integration patch applied.')
