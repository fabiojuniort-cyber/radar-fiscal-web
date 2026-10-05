import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PublicationAffinityBadge } from './publication-affinity'
import type { ProductApiFetch } from './product-api'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const account = {
  tenant: { id: 't1', name: 'Conta', slug: 'conta', status: 'ACTIVE' },
  onboarding: null,
  companies: [
    { id: 'c1', legalName: 'Agro Um S.A.', tradeName: null, cnpj: '1', isActive: true, establishmentCount: 1, businessLocationCode: null },
    { id: 'c2', legalName: 'Serviços Dois Ltda', tradeName: 'Dois', cnpj: '2', isActive: true, establishmentCount: 1, businessLocationCode: null },
  ],
}

function renderBadge(affinityByCompany: Record<string, unknown>) {
  const calls: Array<{ url: string; tenant: string | null }> = []
  const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, tenant: new Headers(init?.headers).get('X-Tenant-Id') })
    if (url === '/api/v1/account') return json(account)
    const match = /\/companies\/([^/]+)\/publications\/pub-1\/affinity$/.exec(url)
    if (match) return json(affinityByCompany[match[1]!])
    return json({ error: 'not_found' }, 404)
  }) as unknown as ProductApiFetch
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PublicationAffinityBadge apiFetch={apiFetch} tenantId="t1" publicationId="pub-1" />
    </QueryClientProvider>,
  )
  return calls
}

const high = {
  company: { id: 'c2', name: 'Dois' },
  status: 'OK',
  level: 'HIGH',
  score: 8,
  matches: [
    { code: 'sector.agribusiness', label: 'Agronegócio', dimensionCode: 'sector', weight: 3, via: 'SAME_ITEM' },
    { code: 'fertilizantes', label: 'Fertilizantes', dimensionCode: 'product', weight: 3, via: 'PRODUCT_GROUP' },
    { code: 'tax.icms', label: 'ICMS', dimensionCode: 'tax', weight: 2, via: 'SAME_ITEM' },
  ],
}

describe('Afinidade da legislação com a empresa', () => {
  it('uses the company selected in the panel and explains the level', async () => {
    sessionStorage.setItem('tribusca.panel.state', JSON.stringify({ screen: 'acervo', selectedCompanyId: 'c2' }))
    const calls = renderBadge({ c2: high })

    expect(await screen.findByText('Alta')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Empresa' })).toHaveValue('c2')
    expect(calls.find((call) => call.url.includes('/affinity'))).toEqual({
      url: '/api/v1/companies/c2/publications/pub-1/affinity',
      tenant: 't1',
    })

    fireEvent.click(screen.getByRole('button', { name: /Por quê/ }))
    const list = screen.getByRole('list', { name: 'Tags em comum com o perfil' })
    expect(list).toHaveTextContent('SegmentoAgronegócio+3')
    expect(list).toHaveTextContent('grupo de um produto do perfil')
  })

  it('switches company, keeps the choice for the panel and asks for the profile when missing', async () => {
    renderBadge({
      c1: { company: { id: 'c1', name: 'Agro Um S.A.' }, status: 'NO_PROFILE', level: null, score: 0, matches: [] },
      c2: high,
    })

    expect(await screen.findByText('Perfil tributário não preenchido')).toBeInTheDocument()
    expect(screen.getByText(/Complete o perfil tributário de Agro Um S.A./)).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Empresa' }), { target: { value: 'c2' } })
    expect(await screen.findByText('Alta')).toBeInTheDocument()
    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem('tribusca.panel.state')!)).toMatchObject({ selectedCompanyId: 'c2' }),
    )
  })
})
