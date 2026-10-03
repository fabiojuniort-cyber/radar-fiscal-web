import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProductApiFetch } from './product-api'
import { PublicationDetailPage } from './publication-detail-page'

afterEach(() => cleanup())

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function detail(sourceCode: string, effectiveUntil: unknown = null) {
  return {
    publication: {
      id: 'pub-1',
      title: 'Reduz a base de cálculo do ICMS nas saídas dos insumos agropecuários.',
      actType: 'CONVÊNIO ICMS',
      actNumber: '100/1997',
      agency: 'CONFAZ',
      jurisdictionLevel: 'FEDERAL',
      uf: null,
      publishedOn: '1997-11-06',
      effectiveOn: '1997-11-06',
      effectiveUntil,
      officialUrl: 'https://www.confaz.fazenda.gov.br/legislacao/convenios/1997/CV100_97',
      firstCollectedAt: '2026-10-03T06:18:40Z',
      lastSeenAt: '2026-10-03T06:18:40Z',
    },
    version: {
      id: 'v1',
      versionNo: 1,
      versionCount: 1,
      contentText: 'CONVÊNIO ICMS 100/97',
      excerpt: null,
      capturedAt: '2026-10-03T06:18:40Z',
      presentation: {
        version: 1,
        format: 'SANITIZED_HTML',
        preservesWhitespace: true,
        html: '<p class="TituloAcordo">CONVÊNIO ICMS 100/97</p><p class="DataPublicao">Publicado no DOU de 06.11.97.</p>',
      },
    },
    origins: [
      {
        sourceCode,
        sourceName: sourceCode.toUpperCase(),
        officialUrl: 'https://www.confaz.fazenda.gov.br/legislacao/convenios/1997/CV100_97',
        externalId: '/legislacao/convenios/1997/CV100_97',
        firstSeenAt: '2026-10-03T06:18:40Z',
        lastSeenAt: '2026-10-03T06:18:40Z',
      },
    ],
  }
}

async function renderDetail(sourceCode: string, effectiveUntil: unknown = null) {
  const apiFetch = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === '/api/v1/publications/pub-1'
      ? json(detail(sourceCode, effectiveUntil))
      : json({ error: 'not_found' }, 404),
  ) as unknown as ProductApiFetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PublicationDetailPage publicationId="pub-1" apiFetch={apiFetch} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return (await screen.findByText('Publicado no DOU de 06.11.97.')).closest('.publication-preserved-html')
}

describe('Texto da legislação com identidade da fonte oficial', () => {
  it('uses the CONFAZ portal style for CONFAZ acts', async () => {
    const body = await renderDetail('confaz')
    expect(body).toHaveAttribute('data-source-style', 'confaz')
    expect(screen.getByText('Publicado no DOU de 06.11.97.')).toHaveClass('DataPublicao')
  })

  it('uses the CONFAZ style for convênios collected from other sources too', async () => {
    const body = await renderDetail('dou')
    expect(body).toHaveAttribute('data-source-style', 'confaz')
  })

  it('shows until when the act is in force, from its current wording', async () => {
    await renderDetail('confaz', { date: '2027-12-31', basis: 'CURRENT_VALIDITY_CLAUSE', amendedBy: 'Conv. ICMS 79/25' })
    const validity = screen.getByText(/Vigência:/)
    expect(validity).toHaveTextContent('Vigência: 06/11/1997 até 31/12/2027')
    expect(validity).toHaveAttribute('title', 'Prazo dado pelo Conv. ICMS 79/25')
  })

  it('keeps only the start date when the end is unknown', async () => {
    await renderDetail('confaz')
    expect(screen.getByText(/Vigência:/)).toHaveTextContent(/^Vigência: 06\/11\/1997$/)
  })
})
