import { describe, expect, it } from 'vitest'

import { confazDisplayHtml, isConfazAct, splitActBlock, textToParagraphs } from './confaz-presentation'

const EMENTA_100 = 'Reduz a base de cálculo do ICMS nas saídas dos insumos agropecuários que especifica, e dá outras providências.'

function paragraphsOf(html: string): Array<[string, string]> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('p')).map((p) => [p.className, (p.textContent ?? '').trim()])
}

// Conv. ICMS 113/26 as stored from the DOU: the whole act in one paragraph.
const CV113_BLOCK =
  'CONVÊNIO ICMS Nº 113, DE 23 DE SETEMBRO DE 2026 Dispõe sobre a adesão do Estado de Santa Catarina e altera o Convênio ICMS nº 79, de 3 de julho de 2026, que autoriza a concessão de isenção do ICMS nas operações internas relativas às aquisições de armas e munições por órgãos da Administração Pública Direta de Municípios Paulistas e suas Fundações e Autarquias. ' +
  'O Conselho Nacional de Política Fazendária - CONFAZ, na sua 431ª Reunião Extraordinária, realizada em Brasília, DF, nos dias 21 e 23 de setembro de 2026, tendo em vista o disposto na Lei Complementar nº 24, de 7 de janeiro de 1975, resolve celebrar o seguinte CONVÊNIO ' +
  'Cláusula primeira O Estado de Santa Catarina fica incluído nas disposições do Convênio ICMS nº 79, de 3 de julho de 2026, publicado no Diário Oficial da União de 8 de julho de 2026. ' +
  'Cláusula segunda Os dispositivos a seguir indicados do Convênio ICMS nº 79/26 passam a vigorar com as seguintes redações: I - a ementa: "Autoriza a concessão de isenção do ICMS."; II - o "caput" da cláusula primeira: "Cláusula primeira Os Estados do Pará, Santa Catarina e São Paulo ficam autorizados a conceder isenção.". ' +
  'Cláusula terceira Este convênio entra em vigor na data da publicação de sua ratificação nacional no Diário Oficial da União. ' +
  'Presidente do CONFAZ - Ursula Dias Peres, em exercício, Acre - Breno Geovane Azevedo Caetano, Tocantins - Paulo Henrique Souza Vargas. CARLOS HENRIQUE DE AZEVEDO OLIVEIRA'

describe('CONFAZ acts stored without the portal classes', () => {
  it('restores the paragraphs of an act published as one block (DOU)', () => {
    expect(splitActBlock(CV113_BLOCK).map((p) => p.slice(0, 32))).toEqual([
      'CONVÊNIO ICMS Nº 113, DE 23 DE S',
      'Dispõe sobre a adesão do Estado ',
      'O Conselho Nacional de Política ',
      'CONVÊNIO',
      'Cláusula primeira O Estado de Sa',
      'Cláusula segunda Os dispositivos',
      'I - a ementa: "Autoriza a conces',
      'II - o "caput" da cláusula prime',
      '"Cláusula primeira Os Estados do',
      'Cláusula terceira Este convênio ',
      'Presidente do CONFAZ - Ursula Di',
      'CARLOS HENRIQUE DE AZEVEDO OLIVE',
    ])
  })

  it('lays out a one-block DOU act like the CONFAZ portal', () => {
    const view = confazDisplayHtml({
      html: `<section><p>${CV113_BLOCK}</p></section>`,
      text: null,
      ementa: 'CONVÊNIO ICMS Nº 113, DE 23 DE SETEMBRO DE 2026',
      publishedOn: '2026-09-24',
    })!
    expect(view.inferred).toBe(true)
    const paragraphs = paragraphsOf(view.html)
    expect(paragraphs.slice(0, 5).map(([c]) => c)).toEqual([
      'TituloAcordo',
      'DataPublicao',
      'Ementa',
      'TextoAcordo',
      'AcordoTipo',
    ])
    expect(paragraphs[1]![1]).toBe('Publicado no DOU de 24.09.2026')
    expect(view.html).toContain('<b>Cláusula primeira</b> O Estado de Santa Catarina')
    expect(view.html).toContain('<b>O Conselho Nacional de Política Fazendária - CONFAZ,</b>')
  })

  it('classifies a DOU act that already has paragraphs (Conv. ICMS 114/26)', () => {
    const html = [
      'CONVÊNIO ICMS Nº 114, DE 30 DE SETEMBRO DE 2026',
      'Autoriza a redução de juros e multas e a remissão parcial do imposto, na forma que especifica.',
      'O Conselho Nacional de Política Fazendária - CONFAZ, na sua 432ª Reunião Extraordinária, resolve celebrar o seguinte',
      'C O N V Ê N I O',
      'Cláusula primeira O Estado do Rio de Janeiro fica autorizado a reduzir os juros.',
      'Cláusula sétima Este convênio entra em vigor na data da publicação de sua ratificação nacional.',
    ]
      .map((line) => `<p>${line}</p>`)
      .join('')
    const view = confazDisplayHtml({ html, text: null, ementa: 'Autoriza a redução de juros', publishedOn: '2026-10-01' })!
    expect(paragraphsOf(view.html).map(([c]) => c)).toEqual([
      'TituloAcordo',
      'DataPublicao',
      'Ementa',
      'TextoAcordo',
      'AcordoTipo',
      'TextoAcordo',
      'TextoAcordo',
    ])
  })

  it('marks notes and previous wordings of older acts', () => {
    const html = [
      'CONVÊNIO ICMS 100/97',
      'Publicado no DOU de 06.11.97.',
      'Prorrogado, até 31.12.27, pelo Conv. ICMS 79/25.',
      EMENTA_100,
      'O Conselho Nacional de Política Fazendária - CONFAZ, na sua 88ª reunião ordinária, resolve celebrar o seguinte',
      'C O N V Ê N I O',
      'Nova redação dada à cláusula sétima pelo Conv. ICMS 79/25, efeitos a partir de 25.07.25.',
      'Cláusula sétima Este convênio entra em vigor na data da publicação, vigendo até 31 de dezembro de 2027.',
      'Redação original, efeitos até 24.07.25.',
      'Cláusula sétima Este convênio entra em vigor na data da publicação, vigendo até 30 de abril de 1999:',
      'I - primeiro item;',
      'II - segundo item.',
      'Cláusula oitava Texto atual.',
    ]
      .map((line) => `<p>${line}</p>`)
      .join('')
    const view = confazDisplayHtml({ html, text: null, ementa: EMENTA_100, publishedOn: '1997-11-06' })!
    expect(paragraphsOf(view.html).map(([c]) => c)).toEqual([
      'TituloAcordo',
      'DataPublicao',
      'DataPublicao',
      'Ementa',
      'TextoAcordo',
      'AcordoTipo',
      'Remisso',
      'TextoAcordo',
      'RemissoAnt',
      'RedaoAnt',
      'RedaoAnt',
      'RedaoAnt',
      'TextoAcordo',
    ])
  })

  it('keeps HTML that already has the official classes', () => {
    const html = '<p class="TextoAcordo">Cláusula primeira</p><p>Outro</p>'
    expect(confazDisplayHtml({ html, text: null, ementa: EMENTA_100 })).toEqual({ html, inferred: false })
  })

  it('turns plain stored text into paragraphs, escaping it', () => {
    expect(textToParagraphs('Cláusula primeira <x>\n\n  Cláusula segunda  ')).toBe(
      '<p>Cláusula primeira &lt;x&gt;</p><p>Cláusula segunda</p>',
    )
  })

  it('applies to every convênio, ajuste and protocolo, whatever the source', () => {
    expect(isConfazAct({ agency: null, actType: 'CONVÊNIO ICMS', sourceCodes: ['dou'] })).toBe(true)
    expect(isConfazAct({ agency: 'CONFAZ', actType: 'ATO COTEPE/ICMS', sourceCodes: ['dou'] })).toBe(true)
    expect(isConfazAct({ agency: null, actType: 'AJUSTE SINIEF', sourceCodes: [] })).toBe(true)
    expect(isConfazAct({ agency: 'RFB', actType: 'INSTRUÇÃO NORMATIVA', sourceCodes: ['dou'] })).toBe(false)
  })
})
