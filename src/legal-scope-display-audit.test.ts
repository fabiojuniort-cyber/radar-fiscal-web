import { createHash, webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { renderLegalPresentation } from './legal-presentation'
import { auditLegalScopeDisplay } from './legal-scope-display-audit'

const sha = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')
const sourceHtml =
  '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p>' +
  '<p class="TextoAcordo">Crédito presumido para grãos.</p>'
const heading = 'CONVÊNIO ICMS 100/97'
const clause = 'Crédito presumido para grãos.'

function candidate() {
  return {
    schemaVersion: 1,
    status: 'VERIFIED_PARTIAL',
    publicationVersionId: 'version-1',
    attestationId: 'attestation-1',
    htmlSha256: sha(sourceHtml),
    referenceDate: '2026-10-08',
    recheckOn: '2026-10-20',
    verifiedAt: '2026-10-07T12:00:00.000Z',
    offsetBasis: 'SOURCE_SANITIZED_HTML_UTF16',
    highlightsAuthorized: false,
    currentSegments: [{
      start: heading.length,
      end: heading.length + clause.length,
      textSha256: sha(clause),
      status: 'CURRENT',
    }],
  }
}

function input() {
  return {
    sourceSanitizedHtml: sourceHtml,
    displayHtml: sourceHtml,
    presentationFormat: 'SANITIZED_HTML',
    publicationVersionId: 'version-1',
    asOf: '2026-10-08',
    scope: candidate(),
  }
}

beforeEach(() => vi.stubGlobal('crypto', webcrypto))
afterEach(() => vi.unstubAllGlobals())

describe('TAX13 F2 scope-to-DOM mapping (draft only)', () => {
  it('audits a single source text node but NEVER authorizes a mark', async () => {
    const result = await auditLegalScopeDisplay(input())
    expect(result.status).toBe('DRAFT_ONLY')
    expect(result.highlightsAuthorized).toBe(false)
    if (result.status === 'DRAFT_ONLY') {
      expect(result.segments).toEqual([{
        start: heading.length, end: heading.length + clause.length, text: clause,
      }])
    }
  })

  it('rejects missing/unverified and forged positive authorization', async () => {
    for (const scope of [
      undefined, { ...candidate(), highlightsAuthorized: true },
      { ...candidate(), status: 'UNVERIFIED' },
      { ...candidate(), offsetBasis: 'HTML_BYTES' },
    ]) {
      const result = await auditLegalScopeDisplay({ ...input(), scope })
      expect(result.status).toBe('BLOCKED')
      expect(result.highlightsAuthorized).toBe(false)
    }
  })

  it('blocks versions, formats and dates not matching the audited source', async () => {
    for (const example of [
      { ...input(), publicationVersionId: 'version-other' },
      { ...input(), presentationFormat: 'PRESERVED_TEXT' },
      { ...input(), asOf: '2026-10-20' },
      { ...input(), asOf: '2026-02-30' },
    ]) {
      expect((await auditLegalScopeDisplay(example)).status).toBe('BLOCKED')
    }
  })

  it('rejects a visibly identical sentence if DOM markup has changed', async () => {
    const result = await auditLegalScopeDisplay({
      ...input(),
      displayHtml: sourceHtml.replace('<p class="TextoAcordo">', '<div class="TextoAcordo">')
        .replace('grãos.</p>', 'grãos.</div>'),
    })
    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'DISPLAY_TRANSFORMED' })
  })

  it('refuses CONFAZ template transformations such as table wrappers', async () => {
    const html = sourceHtml + '<table><tr><td>NCM 3102.10.90</td></tr></table>'
    const display = renderLegalPresentation({
      agency: 'CONFAZ',
      actType: 'CONVÊNIO ICMS',
      sourceCodes: ['confaz'],
      presentationFormat: 'SANITIZED_HTML',
      html,
      text: null,
      ementa: 'Ementa para teste de layout',
      publishedOn: '2026-10-08',
    })
    expect(display.html).not.toBe(html)
    const result = await auditLegalScopeDisplay({
      ...input(), sourceSanitizedHtml: html, displayHtml: display.html,
      scope: { ...candidate(), htmlSha256: sha(html) },
    })
    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'DISPLAY_TRANSFORMED' })
  })

  it('blocks changed HTML hash or altered fragment hash', async () => {
    const forgedHtml = await auditLegalScopeDisplay({
      ...input(), scope: { ...candidate(), htmlSha256: sha('different HTML') },
    })
    const forgedFragment = await auditLegalScopeDisplay({
      ...input(), scope: {
        ...candidate(), currentSegments: [{
          ...candidate().currentSegments[0]!, textSha256: sha('another clause'),
        }],
      },
    })
    expect(forgedHtml).toMatchObject({ status: 'BLOCKED', reason: 'HTML_HASH_MISMATCH' })
    expect(forgedFragment).toMatchObject({ status: 'BLOCKED', reason: 'TEXT_HASH_MISMATCH' })
  })

  it('never joins CURRENT across clauses or adjacent table cells', async () => {
    for (const html of [
      '<p>Crédito</p><p>presumido</p>',
      '<table><tr><td>Crédito</td><td>presumido</td></tr></table>',
    ]) {
      const joined = 'Créditopresumido'
      const result = await auditLegalScopeDisplay({
        ...input(), sourceSanitizedHtml: html, displayHtml: html,
        scope: {
          ...candidate(), htmlSha256: sha(html),
          currentSegments: [{
            start: 0, end: joined.length, textSha256: sha(joined), status: 'CURRENT',
          }],
        },
      })
      expect(result).toMatchObject({ status: 'BLOCKED', reason: 'CROSSES_TEXT_NODES' })
    }
  })

  it('refuses revoked/history/editorial nodes even with a forged current status', async () => {
    for (const html of [
      '<p class="RedaoAnt">NCM 8451.21.00 revogado</p>',
      '<p class="TituloAcordo" data-legal-status="current">CONVÊNIO ICMS 100/97</p>',
      '<table><tr><td class="TabelaSubtituloverde">8451.21.00</td></tr></table>',
    ]) {
      const plain = html.replace(/<[^>]*>/g, '')
      const result = await auditLegalScopeDisplay({
        ...input(), sourceSanitizedHtml: html, displayHtml: html,
        scope: {
          ...candidate(), htmlSha256: sha(html),
          currentSegments: [{
            start: 0, end: plain.length, textSha256: sha(plain), status: 'CURRENT',
          }],
        },
      })
      expect(result).toMatchObject({ status: 'BLOCKED', reason: 'EDITORIAL_OR_HISTORY' })
    }
  })

  it('uses JS UTF-16 offsets for emoji and Unicode legal text', async () => {
    const html = '<p>🌾 Soja</p>'
    const text = '🌾 Soja'
    const result = await auditLegalScopeDisplay({
      ...input(), sourceSanitizedHtml: html, displayHtml: html,
      scope: {
        ...candidate(), htmlSha256: sha(html),
        currentSegments: [{ start: 0, end: text.length, textSha256: sha(text), status: 'CURRENT' }],
      },
    })
    expect(result.status).toBe('DRAFT_ONLY')
    expect(result.highlightsAuthorized).toBe(false)
  })

  it('fails closed if the browser does not expose cryptographic hashing', async () => {
    vi.stubGlobal('crypto', {})
    expect(await auditLegalScopeDisplay(input())).toMatchObject({
      status: 'BLOCKED', reason: 'CRYPTO_UNAVAILABLE',
    })
  })
})
