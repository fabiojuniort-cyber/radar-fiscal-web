import { describe, expect, it } from 'vitest'

import { buildHighlightRules, highlightLegalHtml } from './legal-highlights'
import type { PublicationTag, PublicationTaxonomy } from './taxonomy-api'

function tag(label: string, highlight: PublicationTag['highlight'], type: PublicationTag['reason']['type'] = 'TEXT'): PublicationTag {
  return {
    kind: 'CONCEPT',
    conceptCode: `x.${label}`,
    groupCode: null,
    label,
    dimensionCode: 'theme',
    groupLabel: null,
    origin: 'AUTOMATIC',
    assertionId: null,
    removed: false,
    reason: { type, term: null, excerpt: null },
    highlight,
  }
}

function taxonomy(tags: PublicationTag[]): PublicationTaxonomy {
  return { sections: [{ name: 'Temas', order: 1, tags }] } as unknown as PublicationTaxonomy
}

describe('highlightLegalHtml', () => {
  it('marks every term of a tag and the NCMs, ignoring case and accents', () => {
    const rules = buildHighlightRules(
      taxonomy([
        tag('Isenção', { terms: ['Isenção', 'isento'], ncmPrefixes: [] }),
        tag('Alumínio', { terms: [], ncmPrefixes: ['7612'] }, 'NCM'),
      ]),
      [{ code: '76129090', description: 'Outros recipientes' }],
    )
    const result = highlightLegalHtml(
      '<p>Fica concedida ISENCAO do ICMS. O produto é isento.</p><table><tr><td>7612.90.90</td></tr></table>',
      rules,
    )
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    const marks = Array.from(doc.querySelectorAll('mark.legal-mark'))
    expect(marks.map((mark) => mark.textContent)).toEqual(['ISENCAO', 'isento', '7612.90.90'])
    expect(marks[0]!.getAttribute('title')).toBe('Isenção')
    expect(marks[2]!.getAttribute('data-ncm-code')).toBe('76129090')
    expect(marks[2]!.getAttribute('title')).toContain('Produto: Alumínio')
    expect(result.marks).toBe(3)
    expect([...result.markedNcms]).toEqual(['76129090'])
  })

  it('leaves the previous wording (and its table rows) unmarked', () => {
    const rules = buildHighlightRules(taxonomy([tag('Isenção', { terms: ['isenção'], ncmPrefixes: [] })]), [
      { code: '44219000', description: null },
    ])
    const result = highlightLegalHtml(
      '<p class="RedaoAnt">Redação anterior: isenção</p>' +
        '<table><tr><td class="A8-3TabelaTextoverde">4421.90.00</td><td>isenção</td></tr></table>' +
        '<p>Isenção vigente</p>',
      rules,
    )
    expect(result.marks).toBe(1)
    expect(result.markedNcms.size).toBe(0)
    expect(result.html).toContain('<mark class="legal-mark" title="Isenção" data-mark-kind="term">Isenção</mark> vigente')
  })

  it('ignores CONFAZ title, ementa, publication history and editorial amendment notes', () => {
    const rules = buildHighlightRules(
      taxonomy([
        tag('ICMS', { terms: ['ICMS'], ncmPrefixes: [] }),
        tag('Fertilizantes', { terms: ['fertilizantes'], ncmPrefixes: [] }),
        tag('Revogado', { terms: ['revogado'], ncmPrefixes: [] }),
      ]),
      [],
    )
    const result = highlightLegalHtml(
      '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>' +
        '<p class="Ementa">Reduz a base de cálculo do ICMS para fertilizantes.</p>' +
        '<p class="DataPublicao">Alterado pelo Convênio ICMS 26/21.</p>' +
        '<p class="Remisso">Nova redação dada pelo Convênio ICMS 79/25.</p>' +
        '<p class="TextoAcordo">II - REVOGADO</p>' +
        '<p class="TextoAcordo">Fica reduzida a base de cálculo do ICMS nas saídas de fertilizantes.</p>',
      rules,
    )
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark.legal-mark')).map((mark) => mark.textContent)).toEqual([
      'ICMS',
      'fertilizantes',
    ])
    expect(result.marks).toBe(3)
  })

  it('mirrors the real CONFAZ classes used by CV100/97 and CV52/91', () => {
    const rules = buildHighlightRules(
      taxonomy([
        tag('ICMS', { terms: ['ICMS'], ncmPrefixes: [] }),
        tag('Fertilizantes', { terms: ['fertilizantes'], ncmPrefixes: [] }),
        tag('Revogação', { terms: ['revogada', 'revogadas'], ncmPrefixes: [] }),
      ]),
      [{ code: '84501100', description: 'Máquinas de lavar roupa' }],
    )
    const result = highlightLegalHtml(
      '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>' +
        '<p class="DataPublicao">Alterado pelos Convs. ICMS 26/21 e 79/25; ICMS.</p>' +
        '<p class="A2DataPublicacao">Prorrogado até 31.12.27; fertilizantes.</p>' +
        '<p class="A8-1Remissao">Nova redação dada pelo Conv. ICMS 99/04.</p>' +
        '<p class="A5-1TextoAcordo">I - fertilizantes sujeitos ao ICMS.</p>' +
        '<p class="A8-2RemissaoAnt">Redação original, efeitos até 18.10.04.</p>' +
        '<p class="A8-3RedacaoAnt">I - fertilizantes na redação anterior.</p>' +
        '<table><tr><td><p class="TabelaSubtituloverde">39.1</p></td>' +
        '<td><p class="Tabelajustificadoverde">Máquinas antigas</p></td>' +
        '<td><p class="TabelaSubtituloverde">8450.11.00</p></td></tr></table>' +
        '<p class="TextoAcordo">Cláusula terceira REVOGADA</p>' +
        '<p class="TextoAcordo">Ficam revogadas as disposições em contrário.</p>',
      rules,
    )
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark.legal-mark')).map((mark) => mark.textContent)).toEqual([
      'fertilizantes',
      'ICMS',
      'revogadas',
    ])
    expect(result.markedNcms.size).toBe(0)
    expect(result.marks).toBe(2)
  })

  it('prefers the longer term and skips Roman-numeral enumerations', () => {
    const rules = buildHighlightRules(
      taxonomy([
        tag('Base de cálculo', { terms: ['base de cálculo'], ncmPrefixes: [] }),
        tag('Redução de base de cálculo', { terms: ['redução de base de cálculo'], ncmPrefixes: [] }),
        tag('Imposto de Importação', { terms: ['II'], ncmPrefixes: [] }),
      ]),
      [],
    )
    const result = highlightLegalHtml('<p>inciso II - redução de base de cálculo; o II (Imposto de Importação)</p>', rules)
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark')).map((mark) => mark.textContent)).toEqual([
      'redução de base de cálculo',
      'II',
    ])
  })

  it('does nothing without rules, curator tags or removed tags', () => {
    const removed = { ...tag('Isenção', { terms: ['isenção'], ncmPrefixes: [] }), removed: true }
    const curatorTag = { ...tag('Crédito', undefined), origin: 'CURATOR' as const }
    const rules = buildHighlightRules(taxonomy([removed, curatorTag]), [])
    expect(highlightLegalHtml('<p>isenção e crédito</p>', rules)).toEqual({
      html: '<p>isenção e crédito</p>',
      marks: 0,
      markedNcms: new Set(),
    })
  })
})
