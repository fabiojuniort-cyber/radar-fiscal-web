/**
 * CONFAZ acts (convênios, ajustes, protocolos) are shown with the official
 * portal's paragraph styles. Acts stored before the portal classes were kept
 * (or collected from another source) have no classes: here each paragraph
 * gets the portal class it would have, from what the text says — publication
 * notes, amendment notes, previous wordings and the act text itself.
 */

const ACT_TYPE = /^(CONV[ÊE]NIO|AJUSTE|PROTOCOLO)\b/i
const PORTAL_CLASS = /\bclass=["'][^"']*\b(TextoAcordo|A5-1TextoAcordo|DataPublicao|Remisso|RedaoAnt)\b/

const TITLE = /^(CONV[ÊE]NIO|AJUSTE(\s+SINIEF)?|PROTOCOLO)\b.{0,60}\d+\s*\/\s*\d{2,4}\s*$/i
const ACT_KIND = /^(C\s*O\s*N\s*V\s*[ÊE]\s*N\s*I\s*O|A\s*J\s*U\s*S\s*T\s*E|P\s*R\s*O\s*T\s*O\s*C\s*O\s*L\s*O)$/i
const BODY_START = /^(O\s+Conselho|O\s+Ministro|O\s+Presidente|Os\s+Secret[áa]rios|Cl[áa]usula\b|Art\.?\s*\d)/i
const PREVIOUS_WORDING = /^(Reda[çc][ãa]o|Nova)\s+(original|anterior)\b/i
const NOTE =
  /^(Nova\s+reda[çc][ãa]o|Reda[çc][ãa]o\s+dada|Acrescentad[oa]s?|Acrescid[oa]s?|Convalidad[oa]s?|Autorizad[oa]s?\b|Revogad[oa]s?|Renumerad[oa]s?|Inclu[íi]d[oa]s?|Alterad[oa]s?|Prorrogad[oa]s?|Vide\b|Efeitos\b|Ratifica[çc][ãa]o|Retifica[çc][ãa]o|Republica[çc][ãa]o|Publicad[oa]\b)/i

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

export function isConfazAct(input: {
  agency: string | null
  actType: string | null
  sourceCodes: string[]
}): boolean {
  return (
    input.sourceCodes.includes('confaz') ||
    normalize(input.agency ?? '') === 'confaz' ||
    ACT_TYPE.test(input.actType ?? '')
  )
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Plain text (one paragraph per line) as HTML paragraphs. */
export function textToParagraphs(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('')
}

/**
 * Adds the portal paragraph classes to CONFAZ HTML that has none. HTML that
 * already carries the official classes is returned unchanged.
 */
export function withConfazParagraphClasses(html: string, ementa: string): string {
  if (PORTAL_CLASS.test(html) || typeof DOMParser === 'undefined') return html

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const paragraphs = Array.from(doc.body.querySelectorAll('p'))
  const ementaKey = normalize(ementa)
  let inBody = false
  // After "Redação anterior/original": the old wording. It spans several
  // paragraphs only when it opens a list (":") — then while items end in ";".
  let expectPreviousWording = false
  let previousWordingList = false

  paragraphs.forEach((paragraph, index) => {
    const text = (paragraph.textContent ?? '').replace(/\u00a0/g, ' ').trim()
    if (!text) return
    const key = normalize(text)
    let className: string

    if (text.startsWith('·')) {
      // Closing remarks the portal lists after the signatures.
      className = 'DataPublicao'
    } else if (!inBody && index < 3 && TITLE.test(text)) {
      className = 'TituloAcordo'
    } else if (ACT_KIND.test(text)) {
      className = 'AcordoTipo'
      inBody = true
    } else if (!inBody && ementaKey.length > 20 && (key === ementaKey || key.startsWith(ementaKey))) {
      className = 'Ementa'
      inBody = true
    } else if (!inBody && ementaKey.length <= 20 && !NOTE.test(text) && !BODY_START.test(text) && text.length >= 80) {
      // No stored summary to compare with: the first long paragraph.
      className = 'Ementa'
      inBody = true
    } else if (!inBody && !BODY_START.test(text)) {
      // Before the summary everything is a publication/amendment note.
      className = 'DataPublicao'
    } else if (PREVIOUS_WORDING.test(text)) {
      className = 'RemissoAnt'
      inBody = true
    } else if (expectPreviousWording && !NOTE.test(text)) {
      className = 'RedaoAnt'
    } else if (NOTE.test(text)) {
      className = 'Remisso'
    } else {
      className = 'TextoAcordo'
      inBody = true
    }

    previousWordingList =
      className === 'RedaoAnt' && (/:$/.test(text) || (previousWordingList && /;$/.test(text)))
    expectPreviousWording = className === 'RemissoAnt' || previousWordingList
    paragraph.className = className
  })

  return doc.body.innerHTML
}
