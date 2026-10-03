import { describe, expect, it } from 'vitest'

import { isConfazAct, textToParagraphs, withConfazParagraphClasses } from './confaz-presentation'

const EMENTA = 'Reduz a base de cálculo do ICMS nas saídas dos insumos agropecuários que especifica, e dá outras providências.'

function classesOf(html: string): Array<[string, string]> {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return Array.from(doc.querySelectorAll('p')).map((p) => [p.className, (p.textContent ?? '').slice(0, 24)])
}

describe('CONFAZ paragraph styles for acts stored without the portal classes', () => {
  it('infers the portal class of each paragraph from what it says', () => {
    const html = [
      'CONVÊNIO ICMS 100/97',
      'Publicado no DOU de 06.11.97.',
      'Prorrogado, até 31.12.27, pelo Conv. ICMS 79/25.',
      EMENTA,
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

    expect(classesOf(withConfazParagraphClasses(html, EMENTA)).map(([c]) => c)).toEqual([
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
    expect(withConfazParagraphClasses(html, EMENTA)).toBe(html)
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
