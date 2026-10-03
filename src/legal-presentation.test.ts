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

    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE/ICMS' })?.id).toBe(
      'ATO_COTEPE_ICMS',
    )
    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE/ICM' })?.id).toBe(
      'ATO_COTEPE_ICMS',
    )
    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE/PMPF' })?.id).toBe(
      'ATO_COTEPE_PMPF',
    )
    expect(selectLegalPresentationTemplate({ actType: 'AJUSTE SINIEF' })?.id).toBe(
      'AJUSTE_SINIEF',
    )
    expect(selectLegalPresentationTemplate({ actType: 'AJUSTE SINIEF 33/26' })?.id).toBe(
      'AJUSTE_SINIEF',
    )
    expect(selectLegalPresentationTemplate({ actType: 'PROTOCOLO ICMS' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'CONVENIO_ICMS_X' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE' })).toBeNull()
    expect(selectLegalPresentationTemplate({ actType: 'ATO COTEPE/MVA' })).toBeNull()
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

  it('restores the fixed PMPF table from a legacy flattened capture', () => {
    // Values transcribed from the official CONFAZ PMPF 26/2026 table used
    // as the visual reference for this regression.
    const rows = [
      '1 AC - **4,9363 - - - -',
      '2 AL 3,4910 5,1155 4,5764 - - -',
      '3 AM - *5,1620 *3,3810 *1,8336 - -',
      '4 AP - 5,8100 - - - -',
      '5 BA - 4,5900 3,6940 - - -',
      '6 CE - 4,9850 5,1334 - - -',
      '7 DF - *4,4600 6,7800 - - -',
      '8 ES - **4,6593 *4,4795 - - -',
      '9 GO - *4,0929 - - - -',
      '10 MA - **4,9900 - - - -',
      '11 MG *8,0232 *4,2808 *5,1447 - - -',
      '12 MS *6,9523 *3,9505 *4,5776 - - -',
      '13 MT **7,1276 3,7943 **3,8069 3,6700 - -',
      '14 PA - 4,5793 - - - -',
      '15 PB *6,2783 **4,6475 **5,0573 - 4,9389 4,9389',
      '16 PE - **4,8900 - - - -',
      '17 PI 5,6800 4,6400 - - - -',
      '18 PR - *4,0351 *4,7651 - - -',
      '19 RJ 2,4456 *4,7200 **4,4800 - - -',
      '20 RN - 5,2500 5,0300 - - -',
      '21 RO - 5,0790 - - 4,0864 -',
      '22 RR *8,2200 **5,3500 - - - -',
      '23 RS - **4,2493 *5,3458 - - -',
      '24 SC - **4,2957 **4,7648 - - -',
      '25 SE *7,4090 **5,2590 *4,8090 - - -',
      '26 SP - *3,7700 - - - -',
      '27 TO *9,8200 **4,9600 - - - -',
    ].join(' ')
    const text = [
      'Secretaria Executiva ATO COTEPE/PMPF Nº 26, DE 24 DE SETEMBRO DE 2026',
      'Preço médio ponderado ao consumidor final (PMPF) de combustíveis.',
      'O Secretário Executivo da Secretaria Executiva do Conselho Nacional de Política Fazendária - CONFAZ, no uso das atribuições legais;',
      'CONSIDERANDO as informações recebidas das unidades federadas, TORNA PÚBLICO que os Estados adotarão os seguintes preços:',
      'ITEM UF QAV AEHC GNV GNI ÓLEO COMBUSTÍVEL (R$/ litro) (R$/ litro) (R$/ m³) (R$/ m³) (R$/ litro) (R$/ Kg)',
      rows,
      'Notas Explicativas: a) * valores alterados de PMPF; b) ** valores alterados de PMPF que apresentam redução.',
    ].join(' ')

    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/PMPF',
      sourceCodes: ['dou'],
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text,
      ementa: 'Preço médio ponderado ao consumidor final (PMPF) de combustíveis.',
      publishedOn: '2026-09-25',
    })

    expect(result.templateId).toBe('ATO_COTEPE_PMPF')
    expect(result.templateVersion).toBe('1.0.0')
    expect(result.variant).toBe('pmpf-table')
    expect(result.inferredStructure).toBe(true)
    expect(result.html).toContain('<table>')
    expect(result.html).toContain('rowspan="2"')
    expect(result.html).toContain('colspan="2"')
    expect(result.html).toContain('<td>27</td><td>TO</td><td>*9,8200</td><td>**4,9600</td>')
    expect(result.html).toContain('<td>15</td><td>PB</td><td>*6,2783</td><td>**4,6475</td><td>**5,0573</td><td>-</td><td>4,9389</td><td>4,9389</td>')
    expect(result.html).toContain('Notas Explicativas:')
    expect(result.html).toContain('class="TituloAcordo"')
    expect(result.html).not.toContain('Secretaria Executiva ATO COTEPE/PMPF')
    expect(result.html).toContain('Publicado no DOU de 25.09.2026')
  })

  it('does not invent a PMPF table from an incomplete 26-row sequence', () => {
    const ufs = [
      'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
      'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP',
    ]
    const rows = ufs
      .map((uf, index) => `${index + 1} ${uf} - 4,0000 - - - -`)
      .join(' ')

    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/PMPF',
      sourceCodes: ['dou'],
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text:
        'ATO COTEPE/PMPF Nº 1, DE 1 DE JANEIRO DE 2026 ' +
        'ITEM UF QAV AEHC GNV GNI ÓLEO COMBUSTÍVEL ' +
        rows,
    })

    expect(result.templateId).toBe('ATO_COTEPE_PMPF')
    expect(result.variant).toBe('standard')
    expect(result.html).not.toContain('<table')
  })

  it('keeps legacy PMPF text intact when a row has an unexpected extra value', () => {
    const ufs = [
      'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
      'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
    ]
    const rows = ufs
      .map((uf, index) =>
        `${index + 1} ${uf} - 4,0000 - - - -${index === 0 ? ' 9,9999' : ''}`,
      )
      .join(' ')
    const text =
      'ATO COTEPE/PMPF Nº 1, DE 1 DE JANEIRO DE 2026 ' +
      'ITEM UF QAV AEHC GNV GNI ÓLEO COMBUSTÍVEL ' +
      '(R$/ litro) (R$/ litro) (R$/ m³) (R$/ m³) (R$/ litro) (R$/ Kg) ' +
      rows

    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/PMPF',
      sourceCodes: ['dou'],
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text,
    })

    expect(result.variant).toBe('standard')
    expect(result.html).not.toContain('<table')
    expect(result.html).toContain('9,9999')
  })

  it('rejects extra data after the final PMPF cell instead of moving it to notes', () => {
    const ufs = [
      'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
      'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
      'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
    ]
    const rows = ufs
      .map((uf, index) => `${index + 1} ${uf} - 4,0000 - - - -`)
      .join(' ')
    const text =
      'ATO COTEPE/PMPF Nº 1, DE 1 DE JANEIRO DE 2026 ' +
      'ITEM UF QAV AEHC GNV GNI ÓLEO COMBUSTÍVEL ' +
      '(R$/ litro) (R$/ litro) (R$/ m³) (R$/ m³) (R$/ litro) (R$/ Kg) ' +
      rows + ' 9,8765'

    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/PMPF',
      sourceCodes: ['dou'],
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text,
    })

    expect(result.variant).toBe('standard')
    expect(result.html).not.toContain('<table')
    expect(result.html).toContain('9,8765')
  })

  it('does not flatten rich markup while attempting a legacy PMPF repair', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/PMPF',
      sourceCodes: ['dou'],
      html:
        '<p>Secretaria Executiva ATO COTEPE/PMPF Nº 1, DE 1 DE JANEIRO DE 2026</p>' +
        '<p>ITEM UF QAV AEHC GNV GNI ÓLEO COMBUSTÍVEL ' +
        '(R$/ litro) (R$/ litro) (R$/ m³) (R$/ m³) (R$/ litro) (R$/ Kg) ' +
        '<strong>conteúdo oficial preservado</strong></p>',
    })

    expect(result.html).toContain('<strong>conteúdo oficial preservado</strong>')
    expect(result.html).not.toContain('<table')
  })

  it('uses the standard ATO COTEPE/ICMS contract for a modern text act', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      sourceCodes: ['dou'],
      ementa: 'Altera o Ato COTEPE/ICMS 06/12.',
      html: [
        '<p>ATO COTEPE/ICMS 68/19, DE 20 DE DEZEMBRO DE 2019</p>',
        '<p>Altera o Ato COTEPE/ICMS 06/12.</p>',
        '<p>O Diretor do Conselho Nacional de Política Fazendária - CONFAZ resolve tornar público:</p>',
        '<p>Art. 1º Fica alterado o §1º do art. 1º.</p>',
      ].join(''),
      publishedOn: '2019-12-23',
    })

    expect(result.templateId).toBe('ATO_COTEPE_ICMS')
    expect(result.templateVersion).toBe('1.0.0')
    expect(result.variant).toBe('standard')
    expect(result.html).toContain('class="TituloAcordo"')
    expect(result.html).toContain('Publicado no DOU de 23.12.2019')
  })

  it('does not switch a modern ATO COTEPE/ICMS to historical because its body cites an old ICM act', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      html: [
        '<p>ATO COTEPE/ICMS Nº 1, DE 2 DE JANEIRO DE 2026</p>',
        '<p>Ementa moderna suficientemente longa para classificação.</p>',
        '<p>ATO COTEPE/ICM Nº 05/87 é citado apenas como referência no corpo deste ato.</p>',
        '<p>Art. 1º Texto normativo atual.</p>',
      ].join(''),
      ementa: 'Ementa moderna suficientemente longa para classificação.',
    })

    expect(result.variant).toBe('standard')
  })

  it('preserves and marks the structured Annex table used by ATO COTEPE/ICMS 100/2026', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      ementa: 'Altera relação de empresas nacionais beneficiárias.',
      html: [
        '<p class="TituloAcordo">ATO COTEPE/ICMS Nº 100, DE 15 DE SETEMBRO DE 2026</p>',
        '<p class="DataPublicao">Publicação no DOU de 16.09.26.</p>',
        '<p class="Ementa">Altera relação de empresas nacionais beneficiárias.</p>',
        '<p class="TextoAcordo"><b>Art. 1º</b> O item 814 fica acrescido.</p>',
        '<p>“Anexo único</p>',
        '<table><tbody>',
        '<tr><td colspan="2">SÃO PAULO</td></tr>',
        '<tr><td>814.</td><td>DIVISION TURBOS BRASIL LTDA<br>CNPJ: 17.524.167/0001-54<br>IE: 669.738.227.110</td></tr>',
        '</tbody></table>',
      ].join(''),
    })

    expect(result.variant).toBe('annex-structured')
    expect(result.html).toContain('class="AtoCotepeAnexoTitulo"')
    expect(result.html).toContain('AtoCotepeEmpresaTable')
    expect(result.html).toContain('AtoCotepeUfHeader')
    expect(result.html).toContain('class="legal-table-scroll"')
    expect(result.html).toContain('colspan="2"')
    expect(result.html).toContain('DIVISION TURBOS BRASIL LTDA<br>CNPJ:')
  })

  it('preserves the historical ICM declaration and does not duplicate its inline DOU note', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICM',
      sourceCodes: ['dou'],
      ementa: 'Ratifica os Convênios ICM de nºs 50 a 72/87.',
      publishedOn: '1987-12-30',
      html: [
        '<p>ATO COTEPE/ICM Nº 05/87, DE 30 DE DEZEMBRO DE 1987<br>(DOU 30.12.87)</p>',
        '<p>Ratifica os Convênios ICM de nºs 50 a 72/87.</p>',
        '<p>O Presidente da Comissão Técnica Permanente do ICMS - COTEPE/ICMS, no uso da atribuição regimental,</p>',
        '<p>DECLARA</p>',
        '<p>Ratificados os Convênios ICM 50 a 72/87.</p>',
      ].join(''),
    })

    expect(result.templateId).toBe('ATO_COTEPE_ICMS')
    expect(result.variant).toBe('historical-declaration')
    expect(result.html).toContain('AtoCotepeTituloHistorico')
    expect(result.html).toContain('AtoCotepeDouHistorico')
    expect(result.html).toContain('AtoCotepeDeclara')
    expect(result.html).toContain('class="Ementa"')
    expect(result.html).toContain('Ratifica os Convênios ICM de nºs 50 a 72/87.')
    expect(result.html?.match(/DOU 30\.12\.87/g)).toHaveLength(1)
    expect(result.html).not.toContain('Publicado no DOU de 30.12.1987')
  })

  it('keeps ATO COTEPE/ICMS PRESERVED_TEXT outside the HTML path', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text: '<script>alert("não executar")</script>',
    })

    expect(result.templateId).toBe('ATO_COTEPE_ICMS')
    expect(result.variant).toBe('preserved-text')
    expect(result.html).toBeNull()
  })

  it('keeps the approved ATO COTEPE 105 table-title class without reclassifying it as a UF header', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'ATO COTEPE/ICMS',
      html: [
        '<p class="TituloAcordo">ATO COTEPE/ICMS Nº 105, DE 1º DE OUTUBRO DE 2026</p>',
        '<table><tbody>',
        '<tr><td class="TabelaTitulo" colspan="2">Unidade Federada: SÃO PAULO</td></tr>',
        '<tr><td colspan="2">DESCRIÇÃO DOS PRODUTOS</td></tr>',
        '<tr><td>1</td><td>Conteúdo</td></tr>',
        '</tbody></table>',
      ].join(''),
    })

    expect(result.templateId).toBe('ATO_COTEPE_ICMS')
    expect(result.variant).toBe('annex-structured')
    expect(result.html).toContain('class="TabelaTitulo"')
    expect(result.html).not.toContain('AtoCotepeEmpresaTable')
    expect(result.html).not.toContain('AtoCotepeUfHeader')
  })

  it('uses the standard AJUSTE_SINIEF contract for a current adjustment', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'AJUSTE SINIEF',
      sourceCodes: ['dou'],
      ementa: 'Altera o Ajuste SINIEF 19/16, que institui documento fiscal eletrônico.',
      publishedOn: '2026-09-08',
      html: [
        '<p>AJUSTE SINIEF Nº 33, DE 4 DE SETEMBRO DE 2026</p>',
        '<p>Altera o Ajuste SINIEF 19/16, que institui documento fiscal eletrônico.</p>',
        '<p>O Conselho Nacional de Política Fazendária - CONFAZ resolve celebrar o seguinte</p>',
        '<p>A J U S T E</p>',
        '<p>Cláusula primeira Fica alterada a cláusula primeira.</p>',
      ].join(''),
    })

    expect(result.templateId).toBe('AJUSTE_SINIEF')
    expect(result.templateVersion).toBe('1.0.0')
    expect(result.variant).toBe('standard')
    expect(result.html).toContain('class="TituloAcordo"')
    expect(result.html).toContain('Publicado no DOU de 08.09.2026')
    expect(result.html).toContain('class="AcordoTipo"')
  })

  it('detects AJUSTE_SINIEF consolidation only from real history classes', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'AJUSTE SINIEF',
      ementa: 'Institui regime especial para a emissão de documento fiscal eletrônico.',
      html: [
        '<p class="TituloAcordo">AJUSTE SINIEF 01/19, DE 5 DE ABRIL DE 2019</p>',
        '<p class="DataPublicao">Publicado no DOU de 09.04.19.</p>',
        '<p class="DataPublicao">Alterado pelos Ajustes SINIEF 10/20, 20/21 e 30/22.</p>',
        '<p class="Ementa">Institui regime especial para a emissão de documento fiscal eletrônico.</p>',
        '<p class="TextoAcordo">O Conselho Nacional de Política Fazendária resolve celebrar o seguinte</p>',
        '<p class="AcordoTipo">A J U S T E</p>',
        '<p class="TextoAcordo">Cláusula primeira Texto vigente.</p>',
        '<p class="Remisso">Nova redação dada pelo Ajuste SINIEF 10/20.</p>',
        '<p class="RemissoAnt">Redação original.</p>',
        '<p class="RedaoAnt">Cláusula primeira Texto original.</p>',
      ].join(''),
    })

    expect(result.variant).toBe('consolidated')
    expect(result.html).toContain('class="Remisso"')
    expect(result.html).toContain('class="RedaoAnt"')
  })

  it('does not classify AJUSTE_SINIEF as consolidated merely because it has many editorial notes', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'AJUSTE SINIEF',
      ementa: 'Altera procedimento fiscal na forma que especifica.',
      html: [
        '<p class="TituloAcordo">AJUSTE SINIEF Nº 28, DE 6 DE DEZEMBRO DE 2024</p>',
        '<p class="DataPublicao">Publicado no DOU de 12.12.24.</p>',
        '<p class="DataPublicao">Ratificação nacional publicada no DOU.</p>',
        '<p class="DataPublicao">Retificação publicada no DOU.</p>',
        '<p class="Ementa">Altera procedimento fiscal na forma que especifica.</p>',
        '<p class="AcordoTipo">A J U S T E</p>',
        '<p class="TextoAcordo">Cláusula primeira Texto vigente.</p>',
      ].join(''),
    })

    expect(result.variant).toBe('standard')
  })

  it('keeps AJUSTE_SINIEF PRESERVED_TEXT outside the HTML path', () => {
    const result = renderLegalPresentation({
      ...baseInput,
      actType: 'AJUSTE SINIEF',
      presentationFormat: 'PRESERVED_TEXT',
      html: null,
      text: '<script>alert("não executar")</script>',
    })

    expect(result.templateId).toBe('AJUSTE_SINIEF')
    expect(result.variant).toBe('preserved-text')
    expect(result.html).toBeNull()
  })

})
