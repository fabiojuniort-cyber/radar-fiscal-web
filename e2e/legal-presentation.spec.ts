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
      data-legal-template="ATO_COTEPE_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="standard"
      data-testid="ato-cotepe-standard"
    >
      <p class="TituloAcordo">ATO COTEPE/ICMS 68/19, DE 20 DE DEZEMBRO DE 2019</p>
      <p class="DataPublicao">Publicado no DOU de 23.12.2019.</p>
      <p class="Ementa">Altera o Ato COTEPE/ICMS 06/12.</p>
      <p class="TextoAcordo">O Diretor do Conselho Nacional de Política Fazendária - CONFAZ resolve tornar público.</p>
      <p class="TextoAcordo"><b>Art. 1º</b> Fica alterado o § 1º.</p>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="ATO_COTEPE_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="annex-structured"
      data-testid="ato-cotepe-annex"
    >
      <p class="TituloAcordo">ATO COTEPE/ICMS Nº 100, DE 15 DE SETEMBRO DE 2026</p>
      <p class="DataPublicao">Publicação no DOU de 16.09.26.</p>
      <p class="Ementa">Altera relação de empresas nacionais beneficiárias.</p>
      <p class="AtoCotepeAnexoTitulo">Anexo único</p>
      <div class="legal-table-scroll" role="region" tabindex="0" aria-label="Tabela da legislação">
        <table class="AtoCotepeEmpresaTable"><tbody>
          <tr><td colspan="2" class="AtoCotepeUfHeader">SÃO PAULO</td></tr>
          <tr><td>814.</td><td>DIVISION TURBOS BRASIL LTDA<br>CNPJ: 17.524.167/0001-54<br>IE: 669.738.227.110</td></tr>
        </tbody></table>
      </div>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="ATO_COTEPE_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="historical-declaration"
      data-testid="ato-cotepe-historical"
    >
      <p class="TituloAcordo AtoCotepeTituloHistorico">ATO COTEPE/ICM Nº 05/87, DE 30 DE DEZEMBRO DE 1987<br><span class="AtoCotepeDouHistorico">(DOU 30.12.87)</span></p>
      <p class="Ementa">Ratifica os Convênios ICM de nºs 50 a 72/87.</p>
      <p class="TextoAcordo">O Presidente da Comissão Técnica Permanente do ICMS - COTEPE/ICMS, no uso da atribuição regimental,</p>
      <p class="AtoCotepeDeclara">DECLARA</p>
      <p class="TextoAcordo">Ratificados os Convênios ICM 50 a 72/87.</p>
    </section>

    <section
      class="publication-preserved-html"
      data-legal-template="ATO_COTEPE_ICMS"
      data-legal-template-version="1.0.0"
      data-legal-variant="annex-structured"
      data-testid="ato-cotepe-105"
    >
      <div class="legal-table-scroll" role="region" tabindex="0" aria-label="Tabela da legislação">
        <table><tbody><tr><td colspan="2" class="TabelaTitulo">Unidade Federada: SÃO PAULO</td></tr></tbody></table>
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


test('DESIGN-01C — ATO COTEPE/ICMS preserva moderno, anexo e histórico', async ({
  page,
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((html) => {
    document.body.innerHTML = html
  }, fixture)

  const standard = page.getByTestId('ato-cotepe-standard')
  await expect(standard.locator('.TituloAcordo')).toHaveCSS('text-align', 'center')
  await expect(standard.locator('.DataPublicao')).toHaveCSS('color', 'rgb(255, 0, 0)')
  expect(
    await standard.locator('.Ementa').evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).marginLeft),
    ),
  ).toBeGreaterThan(0)
  expect(
    await standard.locator('.TextoAcordo').first().evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).textIndent),
    ),
  ).toBeGreaterThan(0)

  const annex = page.getByTestId('ato-cotepe-annex')
  await expect(annex.locator('.AtoCotepeUfHeader')).toHaveCSS('text-align', 'center')
  await expect(annex.locator('tr').nth(1).locator('td').nth(1)).toHaveCSS('text-align', 'left')
  await expect(annex.locator('.legal-table-scroll')).toHaveCSS('overflow-x', 'auto')

  const historical = page.getByTestId('ato-cotepe-historical')
  await expect(historical.locator('.TituloAcordo')).toHaveCSS('font-size', '14px')
  await expect(historical.locator('.AtoCotepeDouHistorico')).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(historical.locator('.Ementa')).toHaveCSS('font-weight', '400')
  await expect(historical.locator('.AtoCotepeDeclara')).toHaveCSS('text-align', 'center')

  const ato105Table = page.getByTestId('ato-cotepe-105').locator('table')
  await expect(ato105Table.locator('.TabelaTitulo')).toHaveCSS('text-align', 'left')
  await expect(ato105Table).toHaveCSS('max-width', '100%')
  await expect(ato105Table).toHaveCSS('margin-left', '0px')

  const viewportOverflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(viewportOverflow.scrollWidth).toBeLessThanOrEqual(viewportOverflow.clientWidth + 1)

  const evidenceDir = path.join('playwright-artifacts', 'screenshots')
  await mkdir(evidenceDir, { recursive: true })
  for (const variant of ['ato-cotepe-standard', 'ato-cotepe-annex', 'ato-cotepe-historical'] as const) {
    await page.getByTestId(variant).screenshot({
      path: path.join(evidenceDir, testInfo.project.name + '-' + variant + '.png'),
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
