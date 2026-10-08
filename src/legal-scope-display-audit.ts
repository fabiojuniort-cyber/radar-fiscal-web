/**
 * TAX13/F2: diagnostic-only scope-to-DOM mapping. Not connected to the
 * public publication renderer and CANNOT enable green highlights.
 * The frontend reworks legal HTML; raw UTF-16 offsets must never be copied
 * onto a transformed presentation without proof of text-node identity.
 */
export type DisplayAuditReason =
  | 'INVALID_SCOPE' | 'UNAUTHORIZED' | 'FORMAT_UNVERIFIED'
  | 'VERSION_MISMATCH' | 'DATE_UNVERIFIED' | 'DISPLAY_TRANSFORMED'
  | 'CRYPTO_UNAVAILABLE' | 'HTML_HASH_MISMATCH' | 'INVALID_SEGMENTS'
  | 'CROSSES_TEXT_NODES' | 'EDITORIAL_OR_HISTORY' | 'TEXT_HASH_MISMATCH'
  | 'ENTITY_OFFSETS_UNVERIFIED'

export type DisplayAuditResult =
  | { status: 'BLOCKED'; reason: DisplayAuditReason; highlightsAuthorized: false; segments: [] }
  | {
      status: 'DRAFT_ONLY'
      reason: 'REQUIRES_INDEPENDENT_R2_AND_PUBLIC_AUTHORIZATION'
      highlightsAuthorized: false
      /** Diagnostics only, never use to create marks in F2. */
      segments: Array<{ start: number; end: number; text: string }>
    }

export type DisplayAuditInput = {
  sourceSanitizedHtml: string | null
  displayHtml: string | null
  presentationFormat: string | null
  publicationVersionId: string | null
  asOf: string
  /** Treat the future API payload as untrusted. */
  scope: unknown
}

const HASH = /^[0-9a-f]{64}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const EXCLUDED = new Set([
  'TituloAcordo', 'AcordoTipo', 'Ementa', 'DataPublicao',
  'A2DataPublicacao', 'Remisso', 'A8-1Remissao', 'Subtitulo',
  'A6-1Subtitulo', 'RedaoAnt', 'A8-3RedacaoAnt',
  'RemissoAnt', 'A8-2RemissaoAnt',
])
const TABLE_HISTORY = /^(?:A\d+-\d+)?Tabela[A-Za-z]*verde$/
/**
 * Browser DOMParser may coalesce an HTML entity into its neighboring text
 * node while the backend htmlparser2 emits distinct ontext callbacks.
 * Refuse to assert a source-to-display offset mapping in that situation.
 */
const ENTITY_REF = /&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i
const ANNEX_HEADING = /^anexo\s+(?:único|unico|[ivxlcdm]+|\d+)(?=\s*$|\s*[-–—:.(])/iu
const ANNEX_HISTORY = /\b(?:revogad[oa]s?|redação\s+(?:anterior|original)|texto\s+anterior|substitu[íi]d[oa]s?|sem\s+(?:efeito|vigência))\b/iu
const EDITORIAL_START = /^(?:publicad[oa]s?\s+(?:no|na|em)|ratificad[oa]s?\s+(?:no|na|pel[oa]s?)|alterad[oa]s?\s+(?:pel[oa]s?|por)|prorrogad[oa]s?\s+at[eé]|redação\s+anterior\b|nova\s+redação\s+dada\s+pel[oa])/iu
const REVOKED_PLACEHOLDER = /^(?:(?:cl[áa]usula|art(?:igo)?\.?|par[áa]grafo|inciso|al[íi]nea|item)\s+[\p{L}\p{N}º°ª.-]+|§\s*\d+[º°ª]?|[ivxlcdm]+|[a-z]|\d+[º°ª]?)\s*(?:[-–—:]\s*)?revogad[oa]s?\.?$/iu
const ACT_IDENTIFIER = /^(?:convênio(?:\s+icms)?|ajuste\s+sinief|ato\s+cotepe(?:\/icms)?|protocolo\s+icms|lei(?:\s+complementar)?|decreto|portaria|resolução)\s+(?:n[ºo°.]?\s*)?\d+(?:[./-]\d+)*(?:\s*,?\s+de\s+\d{1,2}\s+de\s+[\p{L}]+\s+de\s+\d{4})?\.?$/iu

function standaloneEditorial(value: string): boolean {
  const line = value.replace(/\s+/g, ' ').trim()
  return ANNEX_HEADING.test(line) || EDITORIAL_START.test(line) ||
    REVOKED_PLACEHOLDER.test(line) || ACT_IDENTIFIER.test(line)
}

const blocked = (reason: DisplayAuditReason): DisplayAuditResult =>
  ({ status: 'BLOCKED', reason, highlightsAuthorized: false, segments: [] })

function record(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validDate(v: unknown): v is string {
  if (typeof v !== 'string' || !DATE.test(v)) return false
  const date = new Date(v + 'T00:00:00.000Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v
}

async function sha256(value: string): Promise<string | null> {
  try {
    if (!globalThis.crypto?.subtle) return null
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode(value))
    return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function excludedNode(node: Text): boolean {
  for (let e = node.parentElement; e; e = e.parentElement) {
    const status = e.getAttribute('data-legal-status')
    if (status !== null && status !== 'current') return true
    if (e.classList.contains('legal-mark')) return true
    if ([...e.classList].some((name) => EXCLUDED.has(name) || TABLE_HISTORY.test(name))) {
      return true
    }
  }
  return false
}

/** Verifies identity but always returns a NON-RENDERABLE diagnostic draft. */
export async function auditLegalScopeDisplay(input: DisplayAuditInput): Promise<DisplayAuditResult> {
  const s = input.scope
  if (!record(s) || s.schemaVersion !== 1 ||
      (s.status !== 'VERIFIED_PARTIAL' && s.status !== 'VERIFIED_COMPLETE') ||
      s.offsetBasis !== 'SOURCE_SANITIZED_HTML_UTF16') return blocked('INVALID_SCOPE')
  if (s.highlightsAuthorized !== false) return blocked('UNAUTHORIZED')
  if (input.presentationFormat !== 'SANITIZED_HTML' ||
      !input.sourceSanitizedHtml || !input.displayHtml) return blocked('FORMAT_UNVERIFIED')
  if (!input.publicationVersionId || s.publicationVersionId !== input.publicationVersionId ||
      typeof s.attestationId !== 'string' || !s.attestationId.length) {
    return blocked('VERSION_MISMATCH')
  }
  if (!validDate(input.asOf) || !validDate(s.referenceDate) ||
      input.asOf !== s.referenceDate || !validDate(s.recheckOn) ||
      s.recheckOn <= input.asOf) return blocked('DATE_UNVERIFIED')
  // A template can wrap tables or rebuild presentation; a matching visible
  // sentence alone is insufficient to safely project ledger offsets.
  if (input.sourceSanitizedHtml !== input.displayHtml) return blocked('DISPLAY_TRANSFORMED')
  if (ENTITY_REF.test(input.sourceSanitizedHtml)) return blocked('ENTITY_OFFSETS_UNVERIFIED')
  if (typeof s.htmlSha256 !== 'string' || !HASH.test(s.htmlSha256)) return blocked('INVALID_SCOPE')
  const htmlHash = await sha256(input.sourceSanitizedHtml)
  if (htmlHash === null) return blocked('CRYPTO_UNAVAILABLE')
  if (htmlHash !== s.htmlSha256) return blocked('HTML_HASH_MISMATCH')
  if (!Array.isArray(s.currentSegments) || !s.currentSegments.length ||
      s.currentSegments.length > 5000) return blocked('INVALID_SEGMENTS')
  if (typeof DOMParser === 'undefined' || typeof NodeFilter === 'undefined') {
    return blocked('CROSSES_TEXT_NODES')
  }
  const doc = new DOMParser().parseFromString(input.displayHtml, 'text/html')
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number; end: number; nonNormative: boolean }> = []
  let offset = 0
  let historicalAnnex = false
  let cursor = walker.nextNode()
  while (cursor) {
    const value = cursor.nodeValue ?? ''
    const n = value.length
    if (n > 0) {
      const line = value.replace(/\s+/g, ' ').trim()
      if (ANNEX_HEADING.test(line)) historicalAnnex = ANNEX_HISTORY.test(line)
      nodes.push({
        node: cursor as Text,
        start: offset,
        end: offset + n,
        nonNormative: historicalAnnex || standaloneEditorial(value),
      })
      offset += n
    }
    cursor = walker.nextNode()
  }
  const segments: Array<{ start: number; end: number; text: string }> = []
  let lastEnd = 0
  for (const item of s.currentSegments) {
    if (!record(item) || typeof item.start !== 'number' ||
        typeof item.end !== 'number' || typeof item.textSha256 !== 'string') {
      return blocked('INVALID_SEGMENTS')
    }
    if (item.status !== 'CURRENT' ||
        !Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end) ||
        item.start < lastEnd || item.end <= item.start || item.end > offset ||
        !HASH.test(item.textSha256)) {
      return blocked('INVALID_SEGMENTS')
    }
    // Capture narrowed values outside the callback; the untrusted record
    // is not treated as a stable, typed object inside a closure.
    const start = item.start
    const end = item.end
    lastEnd = end
    const node = nodes.find((n) => n.start <= start && n.end >= end)
    if (!node) return blocked('CROSSES_TEXT_NODES')
    if (node.nonNormative || excludedNode(node.node)) {
      return blocked('EDITORIAL_OR_HISTORY')
    }
    const text = (node.node.nodeValue ?? '').slice(start - node.start, end - node.start)
    const hash = await sha256(text)
    if (hash === null) return blocked('CRYPTO_UNAVAILABLE')
    if (hash !== item.textSha256) return blocked('TEXT_HASH_MISMATCH')
    segments.push({ start, end, text })
  }
  return {
    status: 'DRAFT_ONLY',
    reason: 'REQUIRES_INDEPENDENT_R2_AND_PUBLIC_AUTHORIZATION',
    highlightsAuthorized: false,
    segments,
  }
}
