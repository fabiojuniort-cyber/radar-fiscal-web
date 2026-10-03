import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const pmpfRows = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
].map((uf, index) =>
  `<tr><td>${index + 1}</td><td>${uf}</td><td>-</td><td>**4,9363</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`,
).join('')

const fixture = `
  <main class="publication-detail-main" data-testid="legal-template-fixture">
    <section
      class="publication-preserved-html"
      data-legal-template="CONVENIO_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="standard"
      data-testid="standard"
    >
      <p class="TituloAcordo">CONVÊNIO ICMS Nº 114, DE 30 DE SETEMBRO DE 2026</p>
      <p class="DataPublicao">Publicado no DOU de 01.10.2026</p>
      <p class="Ementa">Autoriza a redução de juros e multas na forma que especifica.</p>
      <p class="TextoAcordo">Cláusula primeira Texto oficial do dispositivo.</p>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="CONVENIO_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="consolidated"
      data-testid="consolidated"
    >
      <p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>
      <p class="Remisso">Nova redação dada pelo Conv. ICMS 79/25.</p>
      <p class="Ementa">Reduz a base de cálculo do ICMS.</p>
      <p class="TextoAcordo">Cláusula primeira Texto vigente.</p>
      <p class="RemissoAnt">Redação original.</p>
      <p class="RedaoAnt">Cláusula primeira Texto original.</p>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="CONVENIO_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="annex-structured"
      data-testid="annex"
    >
      <p class="TituloAcordo">CONVÊNIO ICMS 22/02</p>
      <p class="Ementa">Autoriza os Estados que menciona a conceder benefício na forma especificada.</p>
      <p class="TextoAcordo">Cláusula primeira</p>
      <div class="legal-table-scroll" role="region" tabindex="0" aria-label="Tabela da legislação">
        <table>
          <tbody>
            <tr>
              <td rowspan="2">ITEM_00000000000000000001</td>
              <td colspan="11">ANEXO_ESTRUTURADO_00000000000000000002</td>
            </tr>
            <tr>
              <td>COLUNA_00000000000000000003</td><td>COLUNA_00000000000000000004</td>
              <td>COLUNA_00000000000000000005</td><td>COLUNA_00000000000000000006</td>
              <td>COLUNA_00000000000000000007</td><td>COLUNA_00000000000000000008</td>
              <td>COLUNA_00000000000000000009</td><td>COLUNA_00000000000000000010</td>
              <td>COLUNA_00000000000000000011</td><td>COLUNA_00000000000000000012</td>
              <td>COLUNA_00000000000000000013</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="ATO_COTEPE_PMPF"
      data-legal-template-version="1.0.0"
      data-legal-variant="pmpf-table"
      data-testid="pmpf"
    >
      <p class="TituloAcordo">ATO COTEPE/PMPF Nº 26, DE 24 DE SETEMBRO DE 2026</p>
      <p class="DataPublicao">Publicado no DOU de 25.09.2026</p>
      <p class="Ementa">Preço médio ponderado ao consumidor final (PMPF) de combustíveis.</p>
      <p class="TextoAcordo">CONSIDERANDO as informações recebidas das unidades federadas, TORNA PÚBLICO:</p>
      <div class="legal-table-scroll" role="region" tabindex="0" aria-label="Tabela da legislação">
        <table>
          <thead>
            <tr><th rowspan="2">ITEM</th><th rowspan="2">UF</th><th>QAV</th><th>AEHC</th><th>GNV</th><th>GNI</th><th colspan="2">ÓLEO COMBUSTÍVEL</th></tr>
            <tr><th>(R$/ litro)</th><th>(R$/ litro)</th><th>(R$/ m³)</th><th>(R$/ m³)</th><th>(R$/ litro)</th><th>(R$/ Kg)</th></tr>
          </thead>
          <tbody>${pmpfRows}</tbody>
        </table>
      </div>
      <p class="TextoAcordo">Notas Explicativas: ** valores alterados de PMPF que apresentam redução.</p>
    </section>
  </main>
`

test('DESIGN-01B — Convênio ICMS mantém as três variantes e overflow local', async ({
  page,
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((html) => {
    document.body.innerHTML = html
  }, fixture)
  // Stress fixture only: force an intrinsically wide annex so the test proves
  // that overflow stays inside the table region even on desktop.
  await page.addStyleTag({
    content: '[data-testid="annex"] table { white-space: nowrap; }',
  })

  const standard = page.getByTestId('standard')
  const standardEmenta = standard.locator('.Ementa')
  const standardText = standard.locator('.TextoAcordo')
  expect(
    await standardEmenta.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).marginLeft),
    ),
  ).toBeGreaterThan(0)
  await expect(standardEmenta).toHaveCSS('font-weight', '700')
  await expect(standardText).toHaveCSS('text-indent', '0px')

  const consolidated = page.getByTestId('consolidated')
  await expect(consolidated.locator('.Remisso')).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(consolidated.locator('.RedaoAnt')).toHaveCSS('color', 'rgb(0, 128, 0)')

  const annex = page.getByTestId('annex')
  await expect(annex.locator('.Ementa')).toHaveCSS('margin-left', '0px')
  await expect(annex.locator('.TextoAcordo')).toHaveCSS('text-indent', '0px')
  await expect(annex.locator('td').first()).toHaveCSS('text-align', 'left')

  const tableScroll = annex.locator('.legal-table-scroll')
  await expect(tableScroll).toHaveAttribute('tabindex', '0')
  await expect(tableScroll).toHaveCSS('overflow-x', 'auto')
  const scroll = await tableScroll.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth)

  const viewportOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewportOverflow.scrollWidth).toBeLessThanOrEqual(viewportOverflow.clientWidth + 1)

  const evidenceDir = path.join('playwright-artifacts', 'screenshots')
  await mkdir(evidenceDir, { recursive: true })
  for (const variant of ['standard', 'consolidated', 'annex'] as const) {
    await page.getByTestId(variant).screenshot({
      path: path.join(evidenceDir, `${testInfo.project.name}-convenio-icms-${variant}.png`),
    })
  }
})


test('ATO COTEPE/PMPF — grade oficial permanece legível sem overflow da página', async ({
  page,
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((html) => {
    document.body.innerHTML = html
  }, fixture)

  const pmpf = page.getByTestId('pmpf')
  await expect(pmpf.locator('.TituloAcordo')).toHaveCSS('text-align', 'center')
  await expect(pmpf.locator('.DataPublicao')).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(pmpf.locator('tbody tr')).toHaveCount(27)
  await expect(pmpf.locator('thead tr').first().locator('th').first()).toHaveAttribute('rowspan', '2')
  await expect(pmpf.locator('thead tr').first().locator('th').last()).toHaveAttribute('colspan', '2')

  const tableScroll = pmpf.locator('.legal-table-scroll')
  await expect(tableScroll).toHaveCSS('overflow-x', 'auto')
  const viewportOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewportOverflow.scrollWidth).toBeLessThanOrEqual(viewportOverflow.clientWidth + 1)

  const evidenceDir = path.join('playwright-artifacts', 'screenshots')
  await mkdir(evidenceDir, { recursive: true })
  await pmpf.screenshot({
    path: path.join(evidenceDir, `${testInfo.project.name}-ato-cotepe-pmpf-table.png`),
  })
})
