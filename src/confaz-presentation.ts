/**
 * CONFAZ acts (convênios, ajustes, protocolos) are shown with the official
 * portal's paragraph styles. Acts stored without the portal classes (from
 * the DOU, plain text, or collected before the classes were kept) are
 * rebuilt here: paragraphs are restored from the act's own structure and
 * each one gets the portal class it would have — title, publication notes,
 * summary (ementa), act text, amendment notes and previous wordings.
 */

const ACT_TYPE = /^(CONV[ÊE]NIO|AJUSTE|PROTOCOLO)\b/i
const PORTAL_CLASS = /\bclass=["'][^"']*\b(TextoAcordo|A5-1TextoAcordo|DataPublicao|Remisso|RedaoAnt)\b/

const TITLE =
  /^(CONV[ÊE]NIO|AJUSTE|PROTOCOLO|ATO\s+COTEPE)\b[^.]{0,90}?(\d+\s*\/\s*\d{2,4}|\bDE\s+\d{4})\s*\.?$/i
const ACT_KIND =
  /^(C\s*O\s*N\s*V\s*[ÊE]\s*N\s*I\s*O|A\s*J\s*U\s*S\s*T\s*E|P\s*R\s*O\s*T\s*O\s*C\s*O\s*L\s*O)$/i
const BODY_START =
  /^(O\s+Conselho|O\s+Ministro|O\s+Presidente|Os?\s+Secret[áa]rios?|A\s+Comiss[ãa]o|CONSIDERANDO\b|"?Cl[áa]usula\b|Art\.?\s*\d)/i
const PREVIOUS_WORDING = /^(Reda[çc][ãa]o|Nova)\s+(original|anterior)\b/i
const NOTE =
  /^(Nova\s+reda[çc][ãa]o|Reda[çc][ãa]o\s+dada|Acrescentad[oa]s?|Acrescid[oa]s?|Convalidad[oa]s?|Autorizad[oa]s?\b|Revogad[oa]s?|Renumerad[oa]s?|Inclu[íi]d[oa]s?|Alterad[oa]s?|Prorrogad[oa]s?|Vide\b|Efeitos\b|Ratifica[çc][ãa]o|Retifica[çc][ãa]o|Republica[çc][ãa]o|Publicad[oa]\b)/i
const ORDINAL =
  '(?:(?:d[ée]cima|vig[ée]sima|trig[ée]sima|quadrag[ée]sima|quinquag[ée]sima)[\\s-]+)?(?:primeira|segunda|terceira|quarta|quinta|sexta|s[ée]tima|oitava|nona|d[ée]cima|vig[ée]sima|trig[ée]sima|quadrag[ée]sima|quinquag[ée]sima|[úu]nica)(?:-[A-Z])?'
// "Cláusula primeira", "Cláusula décima segunda", "Cláusula terceira-A".
const CLAUSE_HEAD = new RegExp(`^"?Cl[áa]usula\\s+${ORDINAL}(?=\\s)`)
// "O Conselho Nacional de Política Fazendária - CONFAZ," and, in Atos
// COTEPE, "O Secretário-Executivo da Secretaria-Executiva do ... - CONFAZ,".
const COUNCIL_HEAD =
  /^(?:O\s+Conselho\s+Nacional|O\s+Secret[áa]rio[-\s]Executivo\s+da\s+Secretaria[-\s]Executiva\s+do\s+Conselho\s+Nacional)\s+de\s+Pol[íi]tica\s+Fazend[áa]ria\s*[-–]\s*CONFAZ,/
// "Art. 1º", "Art. 10." (Atos COTEPE and other acts with articles).
const ARTICLE_HEAD = /^Art\.\s*\d+(?:\s*[º°o]|\.)?(?:-[A-Z])?/

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

const UPPER = 'A-ZÁÉÍÓÚÂÊÔÃÕÇ'
// Where an act published as one block of text starts a new paragraph. Each
// pattern matches the gap (whitespace) between two paragraphs.
const PARAGRAPH_GAPS: RegExp[] = [
  // after the title "CONVÊNIO ICMS Nº 113, DE 23 DE SETEMBRO DE 2026"
  /(?<=^(?:CONV[ÊE]NIO|AJUSTE|PROTOCOLO|ATO\s+COTEPE)\b[^.]{0,90}?\bDE\s+\d{4})\s+/gi,
  /(?<=^(?:CONV[ÊE]NIO|AJUSTE|PROTOCOLO|ATO\s+COTEPE)\b[^.]{0,60}?\d+\s*\/\s*\d{2,4})\s+/gi,
  // before the preamble and after "resolve celebrar o seguinte"
  /\s+(?=(?:O|Os)\s+(?:Conselho\s+Nacional|Ministro\s+de\s+Estado|Secret[áa]rios?\s+de\s+Fazenda|Secret[áa]rio[-\s]Executivo)\b)/g,
  // Atos COTEPE: "CONSIDERANDO ..." and articles
  /(?<=[,;.:])\s+(?=CONSIDERANDO\b)/g,
  /(?<=[.:;"”])\s+(?=Art\.\s*\d+\s*[º°o]?\s)/g,
  /(?<=resolve[^.]{0,60}?\bseguinte)\s+/gi,
  // around the act kind ("C O N V Ê N I O") before the first clause
  /(?<=(?:C\s?O\s?N\s?V\s?[ÊE]\s?N\s?I\s?O|AJUSTE|PROTOCOLO))\s+(?=Cl[áa]usula\s)/g,
  // clauses, items after ":"/";", paragraphs, signatures
  new RegExp(`(?<=[.:;"”])\\s+(?="?Cl[áa]usula\\s+${ORDINAL}\\s)`, 'g'),
  /(?<=[:;])\s+(?=[IVXLC]+\s+[-–]\s)/g,
  /(?<=[.:"”])\s+(?=(?:Par[áa]grafo\s+[úu]nico|§\s*\d))/g,
  /\s+(?=Presidente\s+do\s+CONFAZ\b)/g,
  new RegExp(`(?<=\\.)\\s+(?=[${UPPER}]{2,}(?:\\s+[${UPPER}]{1,}){1,6}\\s*$)`, 'g'),
]

/** Restores the paragraphs of an act published as one block of text. */
export function splitActBlock(text: string): string[] {
  const cuts = new Set<number>()
  for (const pattern of PARAGRAPH_GAPS) {
    for (const match of text.matchAll(pattern)) cuts.add(match.index ?? 0)
  }
  const pieces: string[] = []
  let start = 0
  for (const cut of [...cuts].sort((a, b) => a - b).concat(text.length)) {
    const piece = text.slice(start, cut).trim()
    if (piece) pieces.push(piece)
    start = cut
  }
  return pieces
}

function formatDouDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-')
  return `${day}.${month}.${year}`
}

function leadInBold(paragraph: HTMLParagraphElement, pattern: RegExp): void {
  const first = paragraph.firstChild
  if (!first || first.nodeType !== Node.TEXT_NODE) return
  const text = first.textContent ?? ''
  const match = pattern.exec(text.trimStart())
  if (!match?.[0]) return
  const leading = text.length - text.trimStart().length
  const bold = paragraph.ownerDocument.createElement('b')
  bold.textContent = match[0]
  first.textContent = text.slice(leading + match[0].length)
  paragraph.insertBefore(bold, first)
}

/**
 * HTML of a CONFAZ act with the portal paragraph classes. HTML that already
 * carries the official classes is returned unchanged; otherwise paragraphs
 * are restored and classified (`inferred: true`).
 */
export function confazDisplayHtml(input: {
  html: string | null
  text: string | null
  ementa: string
  publishedOn?: string | null
}): { html: string; inferred: boolean } | null {
  const source = input.html ?? (input.text ? textToParagraphs(input.text) : null)
  if (!source) return null
  if (PORTAL_CLASS.test(source) || typeof DOMParser === 'undefined') {
    return { html: source, inferred: false }
  }

  const doc = new DOMParser().parseFromString(`<body>${source}</body>`, 'text/html')
  const body = doc.body
  if (!body.querySelector('p') && body.textContent?.trim()) {
    body.innerHTML = textToParagraphs(body.textContent)
  }

  // A paragraph holding a whole act (or several of its parts) is split.
  for (const paragraph of Array.from(body.querySelectorAll('p'))) {
    if (
      paragraph.querySelector('table') ||
      paragraph.closest('table') ||
      paragraph.childElementCount > 0
    ) continue
    const text = (paragraph.textContent ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
    if (text.length < 200) continue
    const pieces = splitActBlock(text)
    if (pieces.length < 2) continue
    for (const piece of pieces) {
      const part = doc.createElement('p')
      part.textContent = piece
      paragraph.before(part)
    }
    paragraph.remove()
  }

  // Paragraphs inside tables keep the table layout.
  let paragraphs = Array.from(body.querySelectorAll('p')).filter(
    (p) => (p.textContent ?? '').trim() && !p.closest('table'),
  )
  // The DOU opens some acts with the issuing unit ("Secretaria Executiva")
  // before the act title; the portal does not show it.
  const titleIndex = paragraphs.findIndex((p, index) => {
    const text = (p.textContent ?? '').trim()
    return index < 5 && text.length < 140 && TITLE.test(text)
  })
  if (titleIndex > 0) {
    const unitLines = paragraphs
      .slice(0, titleIndex)
      .filter((p) => (p.textContent ?? '').trim().length < 100 && !NOTE.test((p.textContent ?? '').trim()))
    for (const line of unitLines) line.remove()
    paragraphs = paragraphs.filter((p) => !unitLines.includes(p))
  }

  // A first table row made of one spanning cell is the table's title
  // ("Unidade Federada: MATO GROSSO DO SUL").
  for (const table of Array.from(body.querySelectorAll('table'))) {
    const firstRow = table.querySelector('tr')
    const cells = firstRow ? Array.from(firstRow.children) : []
    if (cells.length === 1 && Number(cells[0]!.getAttribute('colspan') ?? '1') > 1) {
      cells[0]!.classList.add('TabelaTitulo')
    }
  }
  const ementaKey = normalize(input.ementa)
  let seenTitle = false
  let inBody = false
  let hasPublicationNote = false
  let titleParagraph: HTMLParagraphElement | undefined
  // After "Redação anterior/original": the old wording. It spans several
  // paragraphs only when it opens a list (":") — then while items end in ";".
  let expectPreviousWording = false
  let previousWordingList = false

  for (const paragraph of paragraphs) {
    const text = (paragraph.textContent ?? '').replace(/ /g, ' ').trim()
    const key = normalize(text)
    let className: string

    if (text.startsWith('·')) {
      // Closing remarks the portal lists after the signatures.
      className = 'DataPublicao'
    } else if (!inBody && !seenTitle && text.length < 140 && TITLE.test(text)) {
      className = 'TituloAcordo'
      seenTitle = true
      titleParagraph = paragraph
    } else if (ACT_KIND.test(text)) {
      className = 'AcordoTipo'
      inBody = true
    } else if (!inBody && ementaKey.length > 20 && (key === ementaKey || key.startsWith(ementaKey))) {
      className = 'Ementa'
      inBody = true
    } else if (!inBody && NOTE.test(text)) {
      className = 'DataPublicao'
      if (/^Publicad/i.test(text)) hasPublicationNote = true
    } else if (!inBody && !BODY_START.test(text)) {
      // Between the title (and its notes) and the preamble: the summary.
      className = 'Ementa'
      inBody = true
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

    if (className === 'TextoAcordo') {
      leadInBold(paragraph, CLAUSE_HEAD)
      leadInBold(paragraph, COUNCIL_HEAD)
      leadInBold(paragraph, ARTICLE_HEAD)
    }
  }

  // The portal shows the DOU publication right under the title.
  if (titleParagraph && !hasPublicationNote && input.publishedOn) {
    const note = doc.createElement('p')
    note.className = 'DataPublicao'
    note.textContent = `Publicado no DOU de ${formatDouDate(input.publishedOn)}`
    titleParagraph.after(note)
  }

  return { html: body.innerHTML, inferred: true }
}
