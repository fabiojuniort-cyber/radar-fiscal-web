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
    expect(result.marks).toBe(2)
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
    expect(result.marks).toBe(3)
  })

  it('marks NCMs in operative annexes but not in revoked/historical annexes', () => {
    const rules = buildHighlightRules(
      taxonomy([tag('Fertilizantes', { terms: ['fertilizantes'], ncmPrefixes: [] })]),
      [
        { code: '31021090', description: 'Adubos' },
        { code: '87019000', description: 'Máquinas antigas' },
        { code: '10063011', description: 'Arroz' },
      ],
    )
    const html = [
      '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>',
      '<p>ANEXO I</p>',
      '<table><tr><td>fertilizantes</td><td>3102.10.90</td></tr></table>',
      '<p>ANEXO II - REVOGADO</p>',
      '<table><tr><td>fertilizantes históricos</td><td>8701.90.00</td></tr></table>',
      '<p>ANEXO III</p>',
      '<table><tr><td>Arroz atual</td><td>1006.30.11</td></tr></table>',
    ].join('')
    const result = highlightLegalHtml(html, rules)
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark.legal-mark')).map(mark => mark.textContent)).toEqual([
      'fertilizantes', '3102.10.90', '1006.30.11',
    ])
    expect([...result.markedNcms].sort()).toEqual(['10063011', '31021090'])
    expect(result.marks).toBe(3)
  })

  it('does not mark words or NCMs in a single annex containing former wording', () => {
    const rules = buildHighlightRules(
      taxonomy([tag('Fertilizantes', { terms: ['fertilizantes'], ncmPrefixes: [] })]),
      [{ code: '87019000', description: 'Máquinas' }],
    )
    const result = highlightLegalHtml(
      '<p>ANEXO ÚNICO — Redação anterior</p><table><tr><td>fertilizantes</td><td>8701.90.00</td></tr></table>',
      rules,
    )
    expect(result.marks).toBe(0)
    expect(result.markedNcms.size).toBe(0)
  })

  it('highlights only explicitly current cells in a mixed annex while preserving full display', () => {
    const rules = buildHighlightRules(
      taxonomy([tag('Fertilizantes', { terms: ['fertilizantes'], ncmPrefixes: [] })]),
      [
        { code: '87019000', description: null },
        { code: '31021090', description: null },
        { code: '39251000', description: null },
      ],
    )
    const source = [
      '<p data-legal-status="editorial">Histórico fertilizantes 8701.90.00</p>',
      '<p>ANEXO I</p>',
      '<table><tr>',
      '<td data-legal-status="previous">fertilizantes 8701.90.00</td>',
      '<td data-legal-status="current">fertilizantes 3102.10.90</td>',
      '<td data-legal-status="unverified">vigência não comprovada 3925.10.00</td>',
      '</tr></table>',
    ].join('')
    const result = highlightLegalHtml(source, rules)
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark.legal-mark')).map(mark => mark.textContent)).toEqual([
      'fertilizantes', '3102.10.90',
    ])
    expect([...result.markedNcms]).toEqual(['31021090'])
    expect(result.html).toContain('fertilizantes 8701.90.00')
    expect(result.html).toContain('vigência não comprovada 3925.10.00')
  })

  it('excludes unstyled annex content after a previous-wording annex heading', () => {
    const rules = buildHighlightRules(taxonomy([]), [
      { code: '87019000', description: null },
      { code: '31021090', description: null },
    ])
    const result = highlightLegalHtml(
      '<p data-legal-status="previous">ANEXO II</p>' +
      '<table><tr><td>8701.90.00</td></tr></table>' +
      '<p>ANEXO III</p><table><tr><td>3102.10.90</td></tr></table>',
      rules,
    )
    expect([...result.markedNcms]).toEqual(['31021090'])
    expect(result.marks).toBe(1)
  })

  it('excludes generic legal act titles and editorial history in non-CONFAZ HTML', () => {
    const rules = buildHighlightRules(
      taxonomy([tag('IBS', { terms: ['IBS'], ncmPrefixes: [] })]),
      [
        { code: '87019000', description: null },
        { code: '31021090', description: null },
      ],
    )
    const result = highlightLegalHtml(
      '<h1>LEI COMPLEMENTAR Nº 214, DE 16 DE JANEIRO DE 2025</h1>' +
      '<p>Publicado no Diário Oficial em 17/01/2025, NCM 8701.90.00.</p>' +
      '<p>Art. 1º Aplica-se o IBS aos produtos NCM 3102.10.90.</p>',
      rules,
    )
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(Array.from(doc.querySelectorAll('mark.legal-mark')).map(mark => mark.textContent)).toEqual([
      'IBS', '3102.10.90',
    ])
    expect([...result.markedNcms]).toEqual(['31021090'])
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
