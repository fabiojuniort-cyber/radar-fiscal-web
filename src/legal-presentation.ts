import {
  confazDisplayHtml,
  isConfazAct,
  textToParagraphs,
} from './confaz-presentation'

export type LegalPresentationTemplateId =
  | 'CONVENIO_ICMS'
  | 'ATO_COTEPE_PMPF'
  | 'ATO_COTEPE_ICMS'

export type LegalPresentationVariant =
  | 'standard'
  | 'annex-structured'
  | 'consolidated'
  | 'preserved-text'
  | 'pmpf-table'
  | 'historical-declaration'

export type LegalPresentationInput = {
  agency: string | null
  actType: string | null
  sourceCodes: string[]
  presentationFormat: 'SANITIZED_HTML' | 'PRESERVED_TEXT' | null
  html: string | null
  text: string | null
  ementa: string
  publishedOn?: string | null
}

export type LegalPresentationResult = {
  html: string | null
  inferredStructure: boolean
  templateId: LegalPresentationTemplateId | null
  templateVersion: string | null
  variant: LegalPresentationVariant | null
  sourceStyle?: 'confaz'
}

export type LegalPresentationTemplate = {
  id: LegalPresentationTemplateId
  version: string
  matches: (input: Pick<LegalPresentationInput, 'actType'>) => boolean
  render: (
    input: LegalPresentationInput,
  ) => Omit<LegalPresentationResult, 'templateId' | 'templateVersion' | 'sourceStyle'>
}

const normalizeCode = (value: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_')

const HISTORY_CLASSES = new Set([
  'Remisso',
  'RemissoAnt',
  'RedaoAnt',
  'A8-1Remissao',
  'A8-2RemissaoAnt',
  'A8-3RedacaoAnt',
])

const OFFICIAL_EMENTA_CLASS =
  /\bclass=["'][^"']*\bEmenta\b[^"']*["']/i

const ISOLATED_CLAUSE =
  /<p\b[^>]*>\s*(?:<(?:b|strong)\b[^>]*>\s*)?Cl[áa]usula\s+(?:primeira|segunda|terceira|quarta|quinta|sexta|s[ée]tima|oitava|nona|d[ée]cima|[úu]nica)(?:\s*<\/(?:b|strong)>)?\s*<\/p>/i

function hasHistoryClass(html: string): boolean {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
    return Array.from(doc.body.querySelectorAll('[class]')).some((element) =>
      Array.from(element.classList).some((className) => HISTORY_CLASSES.has(className)),
    )
  }

  return /\bclass=["'][^"']*\b(?:Remisso|RemissoAnt|RedaoAnt|A8-1Remissao|A8-2RemissaoAnt|A8-3RedacaoAnt)\b[^"']*["']/i.test(
    html,
  )
}

function wrapLegalTables(html: string): string {
  if (typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  for (const table of Array.from(doc.body.querySelectorAll('table'))) {
    if (table.closest('.legal-table-scroll')) continue
    const wrapper = doc.createElement('div')
    wrapper.className = 'legal-table-scroll'
    wrapper.setAttribute('role', 'region')
    wrapper.setAttribute('tabindex', '0')
    wrapper.setAttribute('aria-label', 'Tabela da legislação')
    table.before(wrapper)
    wrapper.append(table)
  }
  return doc.body.innerHTML
}

const PMPF_UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR',
  'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
] as const

const PMPF_HEADER =
  /ITEM\s+UF\s+QAV\s+AEHC\s+GNV\s+GNI\s+[ÓO]LEO\s+COMBUST[ÍI]VEL\s+\(R\$\/\s*litro\)\s+\(R\$\/\s*litro\)\s+\(R\$\/\s*m³\)\s+\(R\$\/\s*m³\)\s+\(R\$\/\s*litro\)\s+\(R\$\/\s*Kg\)/i

function stripLegacyPmpfUnitPrefix(text: string): string {
  return text.replace(
    /^\s*Secretaria\s+Executiva\s+(?=ATO\s+COTEPE\s*\/\s*PMPF\b)/i,
    '',
  )
}

function pmpfSourceHtml(input: LegalPresentationInput): string | null {
  if (input.presentationFormat === 'PRESERVED_TEXT') {
    return input.text ? textToParagraphs(stripLegacyPmpfUnitPrefix(input.text)) : null
  }
  if (input.presentationFormat !== 'SANITIZED_HTML' || !input.html) return null
  if (typeof DOMParser === 'undefined') return input.html

  const doc = new DOMParser().parseFromString(`<body>${input.html}</body>`, 'text/html')
  const paragraphs = Array.from(doc.body.querySelectorAll('p'))
  const glued = paragraphs.find((paragraph, index) =>
    index < 3 &&
    /^\s*Secretaria\s+Executiva\s+ATO\s+COTEPE\s*\/\s*PMPF\b/i.test(
      paragraph.textContent ?? '',
    ),
  )
  if (glued && glued.childElementCount === 0) {
    glued.textContent = stripLegacyPmpfUnitPrefix(glued.textContent ?? '')
  }
  return doc.body.innerHTML
}

function rebuildPmpfTable(html: string): { html: string; rebuilt: boolean } {
  if (typeof DOMParser === 'undefined' || /<table\b/i.test(html)) {
    return { html, rebuilt: false }
  }

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const paragraph = Array.from(doc.body.querySelectorAll('p')).find((candidate) =>
    PMPF_HEADER.test((candidate.textContent ?? '').replace(/\u00a0/g, ' ')),
  )
  if (!paragraph || paragraph.childElementCount > 0) {
    return { html, rebuilt: false }
  }

  const text = (paragraph.textContent ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const header = PMPF_HEADER.exec(text)
  if (header?.index === undefined) return { html, rebuilt: false }

  const numericValue = '\\*{0,2}(?:[-–—]|\\d{1,2},\\d{4})(?![\\d,])'
  const rowPattern = new RegExp(
    `(?:^|\\s)(\\d{1,2})\\s+(${PMPF_UFS.join('|')})` +
      Array.from({ length: 6 }, () => `\\s+(${numericValue})`).join(''),
    'g',
  )
  rowPattern.lastIndex = header.index + header[0].length

  const matches = Array.from(text.matchAll(rowPattern))
  const firstRowIndex = matches[0]?.index
  const lastRow = matches.at(-1)
  if (
    matches.length !== PMPF_UFS.length ||
    firstRowIndex === undefined ||
    !lastRow ||
    lastRow.index === undefined ||
    matches.some((match, index) =>
      Number(match[1]) !== index + 1 || match[2] !== PMPF_UFS[index],
    )
  ) {
    return { html, rebuilt: false }
  }

  // Fail closed: nothing except whitespace may occur between the validated
  // header and row 1, or between two rows. This prevents silently dropping an
  // unexpected seventh value, note or malformed cell from a legacy capture.
  let previousEnd = header.index + header[0].length
  for (const match of matches) {
    if (match.index === undefined || text.slice(previousEnd, match.index).trim()) {
      return { html, rebuilt: false }
    }
    previousEnd = match.index + match[0].length
  }

  const prefix = text.slice(0, header.index).trim()
  const suffix = text.slice(previousEnd).trim()
  const recognizedSuffix =
    !suffix ||
    /^(?:Notas\s+Explicativas\b|[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}){1,}\b)/.test(suffix)
  if (!recognizedSuffix) return { html, rebuilt: false }

  const makeParagraph = (value: string) => {
    const next = doc.createElement('p')
    next.className = paragraph.className
    next.textContent = value
    return next
  }

  const table = doc.createElement('table')
  const thead = doc.createElement('thead')
  const head1 = doc.createElement('tr')
  const head2 = doc.createElement('tr')
  const makeHead = (label: string) => {
    const th = doc.createElement('th')
    th.textContent = label
    return th
  }
  const item = makeHead('ITEM')
  const uf = makeHead('UF')
  item.rowSpan = 2
  uf.rowSpan = 2
  head1.append(item, uf)
  for (const label of ['QAV', 'AEHC', 'GNV', 'GNI']) head1.append(makeHead(label))
  const oil = makeHead('ÓLEO COMBUSTÍVEL')
  oil.colSpan = 2
  head1.append(oil)
  for (const unit of [
    '(R$/ litro)',
    '(R$/ litro)',
    '(R$/ m³)',
    '(R$/ m³)',
    '(R$/ litro)',
    '(R$/ Kg)',
  ]) {
    head2.append(makeHead(unit))
  }
  thead.append(head1, head2)

  const tbody = doc.createElement('tbody')
  for (const match of matches) {
    const row = doc.createElement('tr')
    for (const value of match.slice(1, 9)) {
      const cell = doc.createElement('td')
      cell.textContent = value ?? ''
      row.append(cell)
    }
    tbody.append(row)
  }
  table.append(thead, tbody)

  const replacements: Node[] = []
  if (prefix) replacements.push(makeParagraph(prefix))
  replacements.push(table)
  if (suffix) replacements.push(makeParagraph(suffix))
  paragraph.replaceWith(...replacements)

  return { html: doc.body.innerHTML, rebuilt: true }
}

function convenioVariant(
  sourceHtml: string | null,
  renderedHtml: string,
): LegalPresentationVariant {
  if (hasHistoryClass(renderedHtml)) {
    return 'consolidated'
  }

  if (
    sourceHtml &&
    /<table\b/i.test(sourceHtml) &&
    ISOLATED_CLAUSE.test(sourceHtml) &&
    !OFFICIAL_EMENTA_CLASS.test(sourceHtml)
  ) {
    return 'annex-structured'
  }

  return 'standard'
}


function prepareAtoCotepeIcmsSource(html: string): {
  html: string
  historical: boolean
  hasTable: boolean
} {
  const historicalText =
    /ATO\s+COTEPE\s*\/\s*ICM(?!S)\b/i.test(html) ||
    />\s*DECLARA\s*</i.test(html)

  if (typeof DOMParser === 'undefined') {
    return {
      html,
      historical: historicalText,
      hasTable: /<table\b/i.test(html),
    }
  }

  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html')
  const paragraphs = Array.from(doc.body.querySelectorAll('p'))
  let historical = historicalText

  for (const paragraph of paragraphs) {
    const text = (paragraph.textContent ?? '').replace(/\s+/g, ' ').trim()

    if (/^ATO\s+COTEPE\s*\/\s*ICMS?\b/i.test(text)) {
      paragraph.classList.add('TituloAcordo')
    }

    if (/^ATO\s+COTEPE\s*\/\s*ICM(?!S)\b/i.test(text)) {
      historical = true
      paragraph.classList.add('AtoCotepeTituloHistorico')

      if (/\(DOU\s+[^)]+\)/i.test(text)) {
        const firstBreak = paragraph.querySelector('br')
        if (firstBreak) {
          const note = doc.createElement('span')
          note.className = 'AtoCotepeDouHistorico'
          let node = firstBreak.nextSibling
          while (node) {
            const next = node.nextSibling
            note.append(node)
            node = next
          }
          firstBreak.after(note)
        } else if (paragraph.childElementCount === 0) {
          const match = /^(.*?)(\s*\(DOU\s+[^)]+\)\s*)$/i.exec(text)
          if (match?.[1] && match[2]) {
            paragraph.textContent = match[1].trim()
            paragraph.append(doc.createElement('br'))
            const note = doc.createElement('span')
            note.className = 'AtoCotepeDouHistorico'
            note.textContent = match[2].trim()
            paragraph.append(note)
          }
        }
      }
    }

    if (/^DECLARA\s*:?\s*$/i.test(text)) {
      historical = true
      paragraph.classList.add('AtoCotepeDeclara')
    }

    if (/^Anexo\s+[úu]nico\s*$/i.test(text)) {
      paragraph.classList.add('AtoCotepeAnexoTitulo')
    }
  }

  for (const row of Array.from(doc.body.querySelectorAll('table tr'))) {
    const cells = Array.from(row.children).filter((element) =>
      element.matches('td, th'),
    )
    if (cells.length !== 1) continue
    const cell = cells[0] as HTMLTableCellElement
    const label = (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (
      cell.colSpan > 1 &&
      !label.includes(':') &&
      /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{2,}$/.test(label)
    ) {
      cell.classList.add('AtoCotepeUfHeader')
    }
  }

  return {
    html: doc.body.innerHTML,
    historical,
    hasTable: doc.body.querySelector('table') !== null,
  }
}

const atoCotepeIcmsTemplate: LegalPresentationTemplate = {
  id: 'ATO_COTEPE_ICMS',
  version: '1.0.0',
  matches: ({ actType }) => {
    const code = normalizeCode(actType)
    return code === 'ATO_COTEPE_ICMS' || code === 'ATO_COTEPE_ICM'
  },
  render: (input) => {
    if (input.presentationFormat === 'PRESERVED_TEXT') {
      return {
        html: null,
        inferredStructure: false,
        variant: 'preserved-text',
      }
    }

    if (input.presentationFormat !== 'SANITIZED_HTML' || !input.html) {
      return {
        html: null,
        inferredStructure: false,
        variant: 'standard',
      }
    }

    const prepared = prepareAtoCotepeIcmsSource(input.html)
    const hasInlineHistoricalDou =
      prepared.historical && /\(DOU\s+[^)]+\)/i.test(prepared.html)

    const view = confazDisplayHtml({
      html: prepared.html,
      text: null,
      ementa: input.ementa,
      publishedOn:
        input.sourceCodes.includes('dou') && !hasInlineHistoricalDou
          ? input.publishedOn
          : null,
    })

    if (!view) {
      return {
        html: null,
        inferredStructure: false,
        variant: prepared.historical
          ? 'historical-declaration'
          : prepared.hasTable
            ? 'annex-structured'
            : 'standard',
      }
    }

    return {
      html: wrapLegalTables(view.html),
      inferredStructure: view.inferred,
      variant: prepared.historical
        ? 'historical-declaration'
        : prepared.hasTable
          ? 'annex-structured'
          : 'standard',
    }
  },
}

const atoCotepePmpfTemplate: LegalPresentationTemplate = {
  id: 'ATO_COTEPE_PMPF',
  version: '1.0.0',
  matches: ({ actType }) => normalizeCode(actType) === 'ATO_COTEPE_PMPF',
  render: (input) => {
    const sourceHtml = pmpfSourceHtml(input)
    if (!sourceHtml) {
      return {
        html: null,
        inferredStructure: false,
        variant: input.presentationFormat === 'PRESERVED_TEXT' ? 'preserved-text' : 'standard',
      }
    }

    const view = confazDisplayHtml({
      html: sourceHtml,
      text: null,
      ementa: input.ementa,
      publishedOn: input.sourceCodes.includes('dou') ? input.publishedOn : null,
    })
    if (!view) {
      return {
        html: null,
        inferredStructure: false,
        variant: 'standard',
      }
    }

    const restored = rebuildPmpfTable(view.html)
    const displayHtml = wrapLegalTables(restored.html)
    return {
      html: displayHtml,
      inferredStructure: view.inferred || restored.rebuilt,
      variant: /<table\b/i.test(displayHtml) ? 'pmpf-table' : 'standard',
    }
  },
}

const convenioIcmsTemplate: LegalPresentationTemplate = {
  id: 'CONVENIO_ICMS',
  version: '1.0.0',
  matches: ({ actType }) => {
    const code = normalizeCode(actType)
    return (
      code === 'CONVENIO_ICMS' ||
      /^CONVENIO_ICMS_\d{1,3}_\d{2,4}$/.test(code)
    )
  },
  render: (input) => {
    if (input.presentationFormat === 'PRESERVED_TEXT') {
      return {
        html: null,
        inferredStructure: false,
        variant: 'preserved-text',
      }
    }

    if (input.presentationFormat !== 'SANITIZED_HTML' || !input.html) {
      return {
        html: null,
        inferredStructure: false,
        variant: 'standard',
      }
    }

    const view = confazDisplayHtml({
      html: input.html,
      text: null,
      ementa: input.ementa,
      publishedOn: input.sourceCodes.includes('dou')
        ? input.publishedOn
        : null,
    })

    if (!view) {
      return {
        html: null,
        inferredStructure: false,
        variant: 'standard',
      }
    }

    const displayHtml = wrapLegalTables(view.html)
    return {
      html: displayHtml,
      inferredStructure: view.inferred,
      variant: convenioVariant(input.html, displayHtml),
    }
  },
}

/**
 * Registry of visual contracts for legal families under controlled
 * TriBusca audit. A document only receives a family template when its act type is
 * an unambiguous match; source/agency alone never selects a family template.
 */
export const LEGAL_PRESENTATION_TEMPLATES: readonly LegalPresentationTemplate[] = [
  convenioIcmsTemplate,
  atoCotepeIcmsTemplate,
  atoCotepePmpfTemplate,
]

export function selectLegalPresentationTemplate(
  input: Pick<LegalPresentationInput, 'actType'>,
): LegalPresentationTemplate | null {
  return (
    LEGAL_PRESENTATION_TEMPLATES.find((template) => template.matches(input)) ??
    null
  )
}

/**
 * Prepares the official body for display. CONFAZ types that do not yet have
 * their own homologated family template keep the pre-existing CONFAZ fallback,
 * so introducing CONVENIO_ICMS cannot change Ato COTEPE/Ajuste/Protocolo.
 */
export function renderLegalPresentation(
  input: LegalPresentationInput,
): LegalPresentationResult {
  const template = selectLegalPresentationTemplate(input)

  if (template) {
    const result = template.render(input)
    return {
      ...result,
      templateId: template.id,
      templateVersion: template.version,
    }
  }

  if (
    isConfazAct({
      agency: input.agency,
      actType: input.actType,
      sourceCodes: input.sourceCodes,
    })
  ) {
    const view = confazDisplayHtml({
      html: input.html,
      text: input.text,
      ementa: input.ementa,
      publishedOn: input.publishedOn,
    })

    return {
      html: view?.html ?? input.html,
      inferredStructure: view?.inferred ?? false,
      templateId: null,
      templateVersion: null,
      variant: null,
      sourceStyle: 'confaz',
    }
  }

  return {
    html: input.html,
    inferredStructure: false,
    templateId: null,
    templateVersion: null,
    variant: null,
  }
}
