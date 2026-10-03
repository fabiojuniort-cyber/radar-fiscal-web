import { describe, expect, it } from 'vitest'

import {
  renderLegalPresentation,
  selectLegalPresentationTemplate,
} from './legal-presentation'

const baseInput = {
  agency: 'CONFAZ',
  actType: 'CONVÊNIO ICMS',
  sourceCodes: ['confaz'],
  presentationFormat: 'SANITIZED_HTML' as const,
  text: null,
  ementa: 'Ementa oficial do convênio para teste.',
  publishedOn: '2026-10-01',
}

describe('legal presentation template registry', () => {
  it('selects CONVENIO_ICMS only from an unambiguous act type', () => {
    expect(selectLegalPresentationTemplate({ actType: 'CONVÊNIO ICMS' })?.id).toBe(
      'CONVENIO_ICMS',
    )
    expect(selectLegalPresentationTemplate({ actType: 'CONVENIO_ICMS' })?.id).toBe(
      'CONVENIO_ICMS',
    )
    expect(selectLegalPresentationTemplate({ actType: 'CONVENIO ICMS 114/26' })?.id).toBe(
      'CONVENIO_ICMS',
    )

    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE/ICMS' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'AJUSTE SINIEF' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'PROTOCOLO ICMS' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'CONVENIO_ICMS_X' })).toBeNull()
  })

  it('refuses HTML when the presentation contract is not SANITIZED_HTML', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      presentationFormat: null,
      html: '<p>não autorizado como HTML</p>',
    })

    expect(result.html).toBeNull()
  })

  it('uses the standard Convênio ICMS contract for a current DOU act', () => {
    const html = [
      '<p>CONVÊNIO ICMS Nº 114, DE 30 DE SETEMBRO DE 2026</p>',
      '<p>Autoriza a redução de juros e multas e a remissão parcial do imposto, na forma que especifica.</p>',
      '<p>O Conselho Nacional de Política Fazendária - CONFAZ, na sua 432ª Reunião Extraordinária, resolve celebrar o seguinte</p>',
      '<p>C O N V Ê N I O</p>',
      '<p>Cláusula primeira O Estado do Rio de Janeiro fica autorizado a reduzir os juros.</p>',
    ].join('')

    const result = renderLegalPresentation({
      ...baseInput,
      sourceCodes: ['dou'],
      html,
      ementa: 'Autoriza a redução de juros e multas e a remissão parcial do imposto, na forma que especifica.',
    })

    expect(result.templateId).toBe('CONVENIO_ICMS')
    expect(result.templateVersion).toBe('1.0.0')
    expect(result.variant).toBe('standard')
    expect(result.inferredStructure).toBe(true)
    expect(result.html).toContain('class="TituloAcordo"')
    expect(result.html).toContain('Publicado no DOU de 01.10.2026')
  })

  it('does not synthesize a DOU note for a non-DOU origin', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      html:
        '<p>CONVÊNIO ICMS Nº 114, DE 30 DE SETEMBRO DE 2026</p>' +
        '<p>Ementa oficial do convênio para teste.</p>' +
        '<p>O Conselho Nacional de Política Fazendária - CONFAZ, resolve celebrar o seguinte</p>',
    })

    expect(result.html).not.toContain('Publicado no DOU')
  })

  it('detects the consolidated historical presentation used by 100/97', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      html: [
        '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>',
        '<p class="DataPublicao">Publicado no DOU de 06.11.97.</p>',
        '<p class="Ementa">Reduz a base de cálculo do ICMS.</p>',
        '<p class="TextoAcordo">Cláusula primeira Texto vigente.</p>',
        '<p class="Remisso">Nova redação dada pelo Conv. ICMS 79/25.</p>',
        '<p class="RemissoAnt">Redação original.</p>',
        '<p class="RedaoAnt">Cláusula primeira Texto original.</p>',
      ].join(''),
    })

    expect(result.variant).toBe('consolidated')
    expect(result.inferredStructure).toBe(false)
    expect(result.html).toContain('class="RedaoAnt"')
  })

  it('detects the structured-annex variant without using year or act number', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      html: [
        '<p class="TituloAcordo">CONVÊNIO ICMS XX/XX</p>',
        '<p class="TextoAcordo">Texto introdutório preservado.</p>',
        '<p>Cláusula primeira</p>',
        '<p>Texto da cláusula.</p>',
        '<table><tbody>',
        '<tr><td rowspan="2">ITEM</td><td colspan="2">ANEXO</td></tr>',
        '<tr><td>A</td><td>B</td></tr>',
        '</tbody></table>',
      ].join(''),
    })

    expect(result.variant).toBe('annex-structured')
    expect(result.html).toContain('class="legal-table-scroll"')
    expect(result.html).toContain('role="region"')
    expect(result.html).toContain('rowspan="2"')
    expect(result.html).toContain('colspan="2"')
  })

  it('does not infer consolidated history from class names mentioned as text', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      html: [
        '<p class="TituloAcordo">CONVÊNIO ICMS Nº 1, DE 2026</p>',
        '<p class="TextoAcordo">O identificador RemissoAnt aparece apenas como texto.</p>',
      ].join(''),
    })

    expect(result.variant).toBe('standard')
  })

  it('keeps PRESERVED_TEXT as text instead of interpreting markup', () => {
    const text = 'Linha 1\n\n  <script>alert("não executar")</script>\nLinha 4'
    const result = renderLegalPresentation({
      ...baseInput,
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text,
    })

    expect(result.templateId).toBe('CONVENIO_ICMS')
    expect(result.variant).toBe('preserved-text')
    expect(result.inferredStructure).toBe(false)
    expect(result.html).toBeNull()
  })

  it('does not flatten rich inline markup from a long sanitized paragraph', () => {
    const longText = 'conteúdo oficial '.repeat(18)
    const html =
      '<p>CONVÊNIO ICMS Nº 1, DE 2026</p>' +
      `<p>${longText}<a href="https://example.gov.br/ref">referência</a> <em>ênfase</em></p>`

    const result = renderLegalPresentation({
      ...baseInput,
      html,
    })

    expect(result.inferredStructure).toBe(true)
    expect(result.html).toContain('<a href="https://example.gov.br/ref">referência</a>')
    expect(result.html).toContain('<em>ênfase</em>')
  })

  it('keeps Ato COTEPE on the existing CONFAZ fallback', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      html: '<p>ATO COTEPE/ICMS Nº 105, DE 1º DE OUTUBRO DE 2026</p>',
    })

    expect(result.templateId).toBeNull()
    expect(result.sourceStyle).toBe('confaz')
  })
})
