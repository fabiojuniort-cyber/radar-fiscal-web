import type { PublicationTaxonomy } from './taxonomy-api'

/**
 * Marks in the legislation text what produced each taxonomy tag (terms of
 * the tag and the NCM codes of the act), like a highlighter pen. Only the
 * current wording is marked: CONFAZ "redação anterior" paragraphs and the
 * table rows they belong to are left as they are, as the classifier and
 * the NCM detector ignore them too.
 */

export interface TermRule {
  /** Normalized term (no accents, lowercase, words split by one space). */
  needle: string
  labels: string[]
}

export interface NcmRule {
  code: string
  description: string | null
  products: string[]
}

export interface HighlightRules {
  terms: TermRule[]
  ncms: Map<string, NcmRule>
}

export interface HighlightResult {
  html: string
  marks: number
  /** NCM codes of the rules that were found (and marked) in the text. */
  markedNcms: Set<string>
}

const PREVIOUS_WORDING_CLASSES = new Set(['RedaoAnt', 'A8-3RedacaoAnt', 'RemissoAnt', 'A8-2RemissaoAnt'])
const PREVIOUS_WORDING_TABLE_CLASS = /^(?:A\d+-\d+)?Tabela[A-Za-z]*verde$/

function isPreviousWordingClass(token: string) {
  return PREVIOUS_WORDING_CLASSES.has(token) || PREVIOUS_WORDING_TABLE_CLASS.test(token)
}

function hasPreviousWordingClass(element: Element) {
  return Array.from(element.classList).some(isPreviousWordingClass)
}

/** Same normalization as the classifier, with a map back to raw positions. */
export function normalizeWithIndex(raw: string): { text: string; rawIndex: number[] } {
  let text = ''
  const rawIndex: number[] = []
  let pendingSpace = false
  for (let index = 0; index < raw.length; index += 1) {
    const decomposed = raw[index]!.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR')
    for (const char of decomposed) {
      if (/[a-z0-9]/.test(char)) {
        if (pendingSpace && text.length > 0) {
          text += ' '
          rawIndex.push(index)
        }
        pendingSpace = false
        text += char
        rawIndex.push(index)
      } else {
        pendingSpace = true
      }
    }
  }
  return { text, rawIndex }
}

export function normalizeTerm(term: string) {
  return normalizeWithIndex(term).text
}

// A term that is also a Roman numeral ("II" = Imposto de Importação) is how
// acts number their items ("inciso II", "II - às saídas"); not a mention.
const ROMAN = /^[ivxlcdm]+$/
const ENUMERATION_BEFORE =
  /(?:\b(?:incisos?|al[íi]neas?|itens?|anexos?|cap[íi]tulos?|t[íi]tulos?|se[çc][õo]es|se[çc][ãa]o|partes?|livros?|art(?:igo)?s?\.?|n[ºo°]\.?)|\b[ivxlcdm]+\s*(?:,|e|a|ou|-|–|—))\s*$/i
const ENUMERATION_AFTER = /^\s*(?:[-–—)]|,\s*[ivxlcdm]+\b|(?:e|a|ou)\s+[ivxlcdm]+\b)/i

function isEnumeration(raw: string, start: number, end: number) {
  const before = raw.slice(Math.max(0, start - 30), start)
  const after = raw.slice(end, end + 12)
  if (/\(\s*$/.test(before)) return false
  if (/(?:^|\n)\s*$/.test(before)) return true
  return ENUMERATION_BEFORE.test(before) || ENUMERATION_AFTER.test(after)
}

const NCM_RE = /(?<![\d.])(\d{8}|\d{4}\.\d{2}\.\d{2}|\d{4}\.\d{4})(?![\d]|\.\d)/g

export function formatNcm(code: string) {
  return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}`
}

/**
 * Rules from the act's tags and NCMs. Products found through an NCM go in
 * the NCM mark (not as separate tags); other tags mark their terms.
 */
export function buildHighlightRules(
  taxonomy: PublicationTaxonomy | undefined,
  ncms: ReadonlyArray<{ code: string; description: string | null }>,
): HighlightRules {
  const byNeedle = new Map<string, Set<string>>()
  const ncmProducts: Array<{ prefixes: string[]; label: string }> = []
  for (const section of taxonomy?.sections ?? []) {
    for (const tag of section.tags) {
      if (tag.removed || !tag.highlight) continue
      for (const term of tag.highlight.terms) {
        const needle = normalizeTerm(term)
        // One or two characters ("IS", "II") only count as a whole word, and
        // pure numbers would mark every article number: skip them.
        if (needle.length < 2 || /^\d+$/.test(needle)) continue
        const labels = byNeedle.get(needle) ?? new Set<string>()
        labels.add(tag.label)
        byNeedle.set(needle, labels)
      }
      if (tag.highlight.ncmPrefixes.length > 0) {
        ncmProducts.push({ prefixes: tag.highlight.ncmPrefixes, label: tag.label })
      }
    }
  }

  const rules = new Map<string, NcmRule>()
  for (const ncm of ncms) {
    const products = ncmProducts
      .filter((product) => product.prefixes.some((prefix) => ncm.code.startsWith(prefix)))
      .map((product) => product.label)
    rules.set(ncm.code, { code: ncm.code, description: ncm.description, products: [...new Set(products)].sort((a, b) => a.localeCompare(b, 'pt-BR')) })
  }

  return {
    // Longer terms first, so "redução de base de cálculo" wins over "base de cálculo".
    terms: [...byNeedle]
      .map(([needle, labels]) => ({ needle, labels: [...labels].sort((a, b) => a.localeCompare(b, 'pt-BR')) }))
      .sort((a, b) => b.needle.length - a.needle.length),
    ncms: rules,
  }
}

interface Range {
  start: number
  end: number
  title: string
  ncm?: string
}

function termRanges(raw: string, rules: TermRule[]): Range[] {
  const normalized = normalizeWithIndex(raw)
  const haystack = ` ${normalized.text} `
  const ranges: Range[] = []
  for (const rule of rules) {
    const roman = ROMAN.test(rule.needle)
    for (
      let position = haystack.indexOf(` ${rule.needle} `);
      position >= 0;
      position = haystack.indexOf(` ${rule.needle} `, position + 1)
    ) {
      const start = normalized.rawIndex[position] ?? 0
      const end = (normalized.rawIndex[position + rule.needle.length - 1] ?? start) + 1
      if (roman && isEnumeration(raw, start, end)) continue
      ranges.push({ start, end, title: rule.labels.join(' · ') })
    }
  }
  return ranges
}

function ncmRanges(raw: string, ncms: Map<string, NcmRule>): Range[] {
  const ranges: Range[] = []
  for (const match of raw.matchAll(NCM_RE)) {
    const code = match[1]!.replace(/\D/g, '')
    const rule = ncms.get(code)
    if (!rule) continue
    const parts = [`NCM ${formatNcm(code)}`]
    if (rule.description) parts.push(rule.description)
    if (rule.products.length > 0) parts.push(`Produto: ${rule.products.join(', ')}`)
    parts.push('clique para buscar no Acervo')
    ranges.push({ start: match.index!, end: match.index! + match[0].length, title: parts.join(' · '), ncm: code })
  }
  return ranges
}

/** Keeps the first of overlapping ranges (NCMs first, then longer terms). */
function withoutOverlaps(ranges: Range[]): Range[] {
  const kept: Range[] = []
  for (const range of ranges) {
    if (kept.some((other) => range.start < other.end && other.start < range.end)) continue
    kept.push(range)
  }
  return kept.sort((a, b) => a.start - b.start)
}

function isPreviousWording(node: Node): boolean {
  for (let element = node.parentElement; element; element = element.parentElement) {
    if (hasPreviousWordingClass(element)) return true
    if (element.tagName === 'TR') {
      const row = element
      if (Array.from(row.querySelectorAll('[class]')).some(hasPreviousWordingClass)) return true
    }
  }
  return false
}

/**
 * Wraps every match in <mark class="legal-mark">. Text inside links,
 * scripts and existing marks is left alone.
 */
export function highlightLegalHtml(html: string, rules: HighlightRules): HighlightResult {
  const result: HighlightResult = { html, marks: 0, markedNcms: new Set() }
  if (rules.terms.length === 0 && rules.ncms.size === 0) return result

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node as Text)

  for (const node of nodes) {
    const raw = node.data
    if (!raw.trim()) continue
    if (node.parentElement?.closest('a, mark, script, style')) continue
    if (isPreviousWording(node)) continue
    const ranges = withoutOverlaps([...ncmRanges(raw, rules.ncms), ...termRanges(raw, rules.terms)])
    if (ranges.length === 0) continue

    const fragment = doc.createDocumentFragment()
    let cursor = 0
    for (const range of ranges) {
      if (range.start > cursor) fragment.append(raw.slice(cursor, range.start))
      const mark = doc.createElement('mark')
      mark.className = 'legal-mark'
      mark.title = range.title
      mark.dataset.markKind = range.ncm ? 'ncm' : 'term'
      if (range.ncm) {
        mark.dataset.ncmCode = range.ncm
        result.markedNcms.add(range.ncm)
      }
      mark.textContent = raw.slice(range.start, range.end)
      fragment.append(mark)
      result.marks += 1
      cursor = range.end
    }
    if (cursor < raw.length) fragment.append(raw.slice(cursor))
    node.replaceWith(fragment)
  }

  result.html = doc.body.innerHTML
  return result
}

export function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
