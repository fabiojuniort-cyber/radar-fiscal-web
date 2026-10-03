import {
  confazDisplayHtml,
  isConfazAct,
} from './confaz-presentation'

export type LegalPresentationTemplateId =
  | 'CONVENIO_ICMS'

export type LegalPresentationVariant =
  | 'standard'
  | 'annex-structured'
  | 'consolidated'
  | 'preserved-text'

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
