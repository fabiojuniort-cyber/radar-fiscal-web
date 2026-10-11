import type { CollectionFilterRule, CollectionFilterTerm } from './collection-filter-api'

export const excludedFilterSources = new Set(['doe-sp', 'doe-sp-legado'])
export const RULE_HEADERS = ['sourceCode', 'section', 'canonicalType', 'mode', 'helpText']
export const TERM_HEADERS = ['text', 'strength', 'sourceCode', 'section', 'canonicalType', 'locationScope']
export const normalizeFilterText = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
const unsafeCell = (s: string) => /^[\s]*[=+\-@']/.test(s)

export function encodeFilterCsv(headers: string[], rows: string[][]) {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(value => {
    const escaped = unsafeCell(value) ? "'" + value : value
    return '"' + escaped.replace(/"/g, '""') + '"'
  }).join(';')).join('\r\n')
}

export function parseFilterCsv(text: string): string[][] {
  if (text.length > 2 * 1024 * 1024) throw new Error('Arquivo excede o limite de 2 MB.')
  text = text.replace(/^\uFEFF/, '')
  const firstLine = text.split(/\r?\n/, 1)[0]
  const delimiter = firstLine.includes(';') ? ';' : ','
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false; let endedQuote = false
  const pushCell = () => { row.push(cell.startsWith("'") && unsafeCell(cell.slice(1)) ? cell.slice(1) : cell); cell = ''; endedQuote = false }
  const pushRow = () => { pushCell(); if (row.some(v => v !== '')) rows.push(row); row = []; if (rows.length > 10001) throw new Error('Máximo de 10.000 registros por arquivo.') }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') { if (text[i+1] === '"') { cell += '"'; i++ } else { quoted = false; endedQuote = true } }
      else cell += char
    } else if (char === '"') {
      if (cell || endedQuote) throw new Error('Aspas inválidas no CSV.')
      quoted = true
    } else if (char === delimiter) pushCell()
    else if (char === '\n' || char === '\r') { if (char === '\r' && text[i+1] === '\n') i++; pushRow() }
    else { if (endedQuote) throw new Error('Conteúdo após fechamento de aspas.'); cell += char }
  }
  if (quoted) throw new Error('Aspas não fechadas no CSV.')
  if (cell || row.length || endedQuote) pushRow()
  if (rows.length < 2) throw new Error('O CSV precisa conter cabeçalho e registros.')
  return rows
}

export function decodeFilterCsv(kind: 'rules' | 'terms', text: string, sources: string[], typesForSource: (source: string) => string[]) {
  const rows = parseFilterCsv(text); const headers = kind === 'rules' ? RULE_HEADERS : TERM_HEADERS
  if (rows[0].join('\0') !== headers.join('\0')) throw new Error('Cabeçalho inválido. Use o CSV exportado desta tabela como modelo.')
  const keys = new Set<string>()
  const rules: CollectionFilterRule[] = []; const terms: CollectionFilterTerm[] = []
  rows.slice(1).forEach((cells, index) => {
    const fail = (message: string): never => { throw new Error(`Registro ${index + 1}: ${message}`) }
    if (cells.length !== headers.length || cells.some(v => v.length > 2000 || v.includes('\0'))) fail('quantidade de colunas ou tamanho de campo inválido.')
    const value = Object.fromEntries(headers.map((h,i) => [h,cells[i]]))
    const source = value.sourceCode.trim().toLowerCase()
    const type = normalizeFilterText(value.canonicalType)
    const section = value.section.trim()
    if (excludedFilterSources.has(source)) fail('fonte fora do escopo do Filtro de Coleta.')
    if (source && !sources.includes(source)) fail('fonte não cadastrada.')
    if (type && !typesForSource(source).map(normalizeFilterText).includes(type)) fail('tipo não encontrado para esta fonte.')
    if (kind === 'rules') {
      if (!source || !type || !['KEEP_ALWAYS','KEEP_IF_TAX_TERM','EXCLUDE_UNLESS_STRONG','EXCLUDE_ALWAYS'].includes(value.mode)) fail('fonte, tipo ou modo inválido.')
      const key = [source, normalizeFilterText(section), type].join('\0')
      if (keys.has(key)) fail('regra duplicada no arquivo.')
      keys.add(key)
      rules.push({ sourceCode: source, section, canonicalType: type, mode: value.mode as CollectionFilterRule['mode'], helpText: value.helpText || null })
    } else {
      const term = value.text.trim(); const normalized = normalizeFilterText(term)
      if (!normalized || !['STRONG','WEAK','NEGATIVE'].includes(value.strength) || !['ANY','TITLE','SUMMARY','BODY'].includes(value.locationScope)) fail('termo, força ou localização inválida.')
      if (value.strength !== 'NEGATIVE' && ['CNPJ','CPF','PROCESSO','PROCESSO ADMINISTRATIVO','NUMERO DO PROCESSO','VALOR','VALOR TOTAL','VALOR GLOBAL'].includes(normalized)) fail('este termo não pode preservar um ato isoladamente.')
      const key = [normalized,source,normalizeFilterText(section),type,value.locationScope].join('\0')
      if (keys.has(key)) fail('termo duplicado ou conflitante no arquivo.')
      keys.add(key)
      terms.push({ text: term, strength: value.strength as CollectionFilterTerm['strength'], sourceCode: source || null, section: section || null, canonicalType: type || null, locationScope: value.locationScope as CollectionFilterTerm['locationScope'] })
    }
  })
  return { rules, terms }
}

export function downloadFilterCsv(name: string, headers: string[], rows: string[][]) {
  const url = URL.createObjectURL(new Blob([encodeFilterCsv(headers, rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const filterRuleKey = (r: CollectionFilterRule) => [r.sourceCode.toLowerCase(),normalizeFilterText(r.section),normalizeFilterText(r.canonicalType)].join('\0')
export const filterTermKey = (t: CollectionFilterTerm) => [normalizeFilterText(t.text),(t.sourceCode || '').toLowerCase(),normalizeFilterText(t.section || ''),normalizeFilterText(t.canonicalType || ''),t.locationScope || 'ANY'].join('\0')
export function mergeFilterRows<T>(existing: T[], incoming: T[], key: (row: T) => string) {
  const result = new Map(existing.map(row => [key(row),row])); incoming.forEach(row => result.set(key(row), row)); return [...result.values()]
}
