import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

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
  </main>
`

test('DESIGN-01B — Convênio ICMS mantém as três variantes e overflow local', async ({
  page,
}, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.evaluate((html) => {
    document.body.innerHTML = html
  }, fixture)

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
