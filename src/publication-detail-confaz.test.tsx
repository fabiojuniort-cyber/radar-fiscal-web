import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProductApiFetch } from './product-api'
import { PublicationDetailPage } from './publication-detail-page'

afterEach(() => cleanup())

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function detail(
  sourceCode: string,
  effectiveUntil: unknown = null,
  actType = 'CONVÊNIO ICMS',
) {
  return {
    publication: {
      id: 'pub-1',
      title: 'Reduz a base de cálculo do ICMS nas saídas dos insumos agropecuários.',
      actType,
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

async function renderDetail(
  sourceCode: string,
  effectiveUntil: unknown = null,
  actType = 'CONVÊNIO ICMS',
) {
  const apiFetch = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === '/api/v1/publications/pub-1'
      ? json(detail(sourceCode, effectiveUntil, actType))
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
  it('uses the CONVENIO_ICMS family contract for CONFAZ convênios', async () => {
    const body = await renderDetail('confaz')
    expect(body).toHaveAttribute('data-legal-template', 'CONVENIO_ICMS')
    expect(body).toHaveAttribute('data-legal-template-version', '1.0.0')
    expect(screen.getByText('Publicado no DOU de 06.11.97.')).toHaveClass('DataPublicao')
  })

  it('uses the same family contract for convênios collected from DOU', async () => {
    const body = await renderDetail('dou')
    expect(body).toHaveAttribute('data-legal-template', 'CONVENIO_ICMS')
    expect(body).not.toHaveAttribute('data-source-style', 'confaz')
  })

  it('uses the dedicated ATO_COTEPE_ICMS family contract', async () => {
    const body = await renderDetail('confaz', null, 'ATO COTEPE/ICMS')
    expect(body).toHaveAttribute('data-legal-template', 'ATO_COTEPE_ICMS')
    expect(body).toHaveAttribute('data-legal-template-version', '1.0.0')
    expect(body).toHaveAttribute('data-legal-variant', 'standard')
    expect(body).not.toHaveAttribute('data-source-style')
  })

  it('keeps unmatched ATO COTEPE families on the generic CONFAZ fallback', async () => {
    const body = await renderDetail('confaz', null, 'ATO COTEPE/MVA')
    expect(body).toHaveAttribute('data-source-style', 'confaz')
    expect(body).not.toHaveAttribute('data-legal-template')
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

describe('NCMs identificados na legislação', () => {
  it('shows only the codes, together, as chips that search the Acervo', async () => {
    const mention = (code: string, description: string) => ({
      code,
      description,
      verificationStatus: 'VERIFIED',
      method: { type: 'REGEX', detectorKey: 'ncm', detectorVersion: '1' },
      confidence: 1,
      excerpt: 'Silos de matéria plástica artificial ou de lona plastificada, com capacidade superior a 300 litros',
    })
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/publications/pub-1') return json(detail('confaz'))
      if (url === '/api/v1/publications/pub-1/ncms') {
        return json({ items: [mention('39173290', 'Outros'), mention('39251000', 'Reservatórios, cisternas')] })
      }
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PublicationDetailPage publicationId="pub-1" apiFetch={apiFetch} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const list = await screen.findByRole('list')
    const chips = within(list).getAllByRole('listitem')
    expect(chips.map((chip) => chip.textContent)).toEqual(['3917.32.90', '3925.10.00'])
    // Description and excerpt are not printed; the description stays as a hint.
    expect(screen.queryByText(/Silos de matéria plástica/)).not.toBeInTheDocument()
    expect(chips[1]).toHaveAttribute('title', 'Reservatórios, cisternas · buscar no Acervo')
    expect(screen.getByText(/não comprova a vigência dos dispositivos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('listitem', { name: 'Buscar NCM 3917.32.90 no Acervo' }))
  })
})

describe('Marcações no texto da legislação', () => {
  it('fails closed: legacy NCM and tax tags cannot create green marks without official proof', async () => {
    const base = detail('confaz')
    const withText = {
      ...base,
      version: {
        ...base.version,
        presentation: {
          ...base.version.presentation,
          html:
            '<p class="RedaoAnt">Redação anterior com isenção</p>' +
            '<p>Fica concedida isenção do ICMS para o NCM 3917.32.90.</p>',
        },
      },
    }
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/publications/pub-1') return json(withText)
      if (url === '/api/v1/publications/pub-1/ncms') {
        return json({
          items: [
            { code: '39173290', description: 'Outros tubos', verificationStatus: 'CATALOG_MATCHED', method: { type: 'RULE', detectorKey: 'ncm', detectorVersion: '1.1.0' } },
            { code: '39251000', description: 'Reservatórios', verificationStatus: 'CATALOG_MATCHED', method: { type: 'RULE', detectorKey: 'ncm', detectorVersion: '1.1.0' } },
          ],
        })
      }
      if (url === '/api/v1/publications/pub-1/taxonomy') {
        const tag = (
          label: string,
          type: string,
          highlight: { terms: string[]; ncmPrefixes: string[] },
          dimensionCode = 'theme',
        ) => ({
          kind: 'CONCEPT', conceptCode: `x.${label}`, groupCode: null, label, dimensionCode, groupLabel: null,
          origin: 'AUTOMATIC', assertionId: null, removed: false, reason: { type, term: null, excerpt: null }, highlight,
        })
        return json({
          publicationId: 'pub-1', publicationVersionId: 'v1', release: null, status: 'CLASSIFIED', classifiedAt: null,
          sections: [{ name: 'Temas', order: 1, tags: [
            tag('Isenção', 'TEXT', { terms: ['Isenção'], ncmPrefixes: [] }),
            tag('Tubos plásticos', 'NCM', { terms: [], ncmPrefixes: ['3917'] }, 'product'),
            tag('Fertilizantes', 'TEXT', { terms: ['Fertilizantes'], ncmPrefixes: [] }, 'product'),
          ] }],
        })
      }
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PublicationDetailPage publicationId="pub-1" apiFetch={apiFetch} />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await screen.findByText(/vigência de cada trecho não foi comprovada/i)
    expect(container.querySelectorAll('mark.legal-mark')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /marcações/i })).not.toBeInTheDocument()
    const chips = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(chips.map((chip) => chip.textContent)).toEqual(['3917.32.90', '3925.10.00'])
    expect(screen.queryByText(/extraídos do texto vigente/)).not.toBeInTheDocument()
    // Non-attested taxonomy and NCM data remain queryable, never highlighted.
    expect(await screen.findByText('Produtos / NCMs')).toBeInTheDocument()
    expect(await screen.findByText('2 itens')).toBeInTheDocument()
  })
  it('rejects CSS current status and PENDING tags outside the controlled CONFAZ review', async () => {
    const source = detail('dou')
    source.version.presentation.html =
      '<p data-legal-status="current">Citação histórica NCM 7307.19.20</p>' +
      '<table><tr><th data-legal-status="revoked"><p>ANEXO II</p></th></tr>' +
      '<tr><td>8450.11.00</td></tr></table>'
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/publications/pub-1') return json(source)
      if (url === '/api/v1/publications/pub-1/ncms') {
        return json({ items: [{
          code: '73071920', description: 'Tubo', verificationStatus: 'CATALOG_MATCHED',
          method: { type: 'RULE', detectorKey: 'ncm', detectorVersion: '1.1.0' },
        }] })
      }
      if (url === '/api/v1/publications/pub-1/taxonomy') {
        return json({ publicationId: 'pub-1', publicationVersionId: 'v1',
          release: null, status: 'PENDING', classifiedAt: null,
          sections: [{ name: 'Temas', order: 1, tags: [] }] })
      }
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter><PublicationDetailPage publicationId="pub-1" apiFetch={apiFetch} /></MemoryRouter>
      </QueryClientProvider>,
    )
    await screen.findByText(/vigência de cada trecho não foi comprovada/i)
    expect(container.querySelectorAll('mark.legal-mark')).toHaveLength(0)
    expect(screen.queryByText(/extraídos do texto vigente/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /marcações/i })).not.toBeInTheDocument()
    expect(await screen.findByRole('listitem', { name: 'Buscar NCM 7307.19.20 no Acervo' })).toBeInTheDocument()
  })

})
