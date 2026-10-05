import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductNcmProfiles } from './product-ncm-profiles'
import type { ProductApiFetch } from './product-api'

afterEach(() => {
  cleanup()
})

const companyId = '22222222-2222-4222-8222-222222222222'
const profilesUrl = `/api/v1/companies/${companyId}/product-profiles`
const cnaeNcmsUrl = `/api/v1/companies/${companyId}/cnae-ncms`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const riceNcm = {
  entryId: '33333333-3333-4333-8333-333333333333',
  code: '10063011',
  officialCode: '1006.30.11',
  description: 'Arroz semibranqueado ou branqueado, polido ou brunido',
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    companyId,
    cnaeCode: '0111301',
    cnaeDescription: 'Cultivo de arroz',
    productLabel: 'Arroz beneficiado',
    productConceptCode: 'product.arroz_beneficiado',
    taxonomy: { releaseId: null, sectorConceptId: null, productConceptId: null },
    ncms: [],
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

function setup(state: { profiles?: unknown[]; cnaeNcms?: unknown[] } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const method = init?.method ?? 'GET'
    if (url.startsWith('/api/v1/ncm?')) return json({ items: [riceNcm], edition: null })
    if (url === profilesUrl && method === 'GET') return json({ items: state.profiles ?? [] })
    if (url.startsWith(profilesUrl) && (method === 'POST' || method === 'PUT')) return json(profile(), 201)
    if (url.startsWith(profilesUrl) && method === 'DELETE') return new Response(null, { status: 204 })
    if (url === cnaeNcmsUrl && method === 'GET') return json({ items: state.cnaeNcms ?? [] })
    if (url === cnaeNcmsUrl && method === 'POST') return json({ items: [] }, 201)
    if (url.startsWith(cnaeNcmsUrl) && method === 'DELETE') return new Response(null, { status: 204 })
    throw new Error(`Unexpected request: ${method} ${url}`)
  }) as ProductApiFetch

  const onSegmentChange = vi.fn()
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <ProductNcmProfiles
        apiFetch={apiFetch}
        tenantId="11111111-1111-4111-8111-111111111111"
        companyId={companyId}
        cnaes={[{ code: '0111301', description: 'Cultivo de arroz' }]}
        segmentOptions={[
          { code: 'sector.trifaros_agro', label: 'Agropecuária, pesca e insumos agrícolas' },
          { code: 'sector.trifaros_ali', label: 'Alimentos, bebidas e tabaco' },
        ]}
        segmentFor={() => ({ code: 'sector.trifaros_agro', suggested: true })}
        onSegmentChange={onSegmentChange}
        products={[
          {
            code: 'product.arroz_beneficiado',
            label: 'Arroz beneficiado',
            groupLabel: 'Grãos',
            segmentCodes: ['sector.trifaros_agro'],
            officialCodes: ['100630'],
          },
          {
            code: 'product.cerveja',
            label: 'Cerveja',
            groupLabel: 'Bebidas',
            segmentCodes: ['sector.trifaros_ali'],
            officialCodes: ['2203'],
          },
        ]}
      />
    </QueryClientProvider>,
  )
  const body = (method: string, url: string) =>
    JSON.parse(String(calls.find((call) => call.init?.method === method && call.url === url)!.init!.body))
  return { calls, onSegmentChange, body }
}

describe('ProductNcmProfiles', () => {
  it('changes the CNAE segment from the Segmento table', async () => {
    const { onSegmentChange } = setup()
    const segment = await screen.findByRole('combobox', { name: 'Segmento do CNAE 0111301' })
    expect(segment).toHaveValue('sector.trifaros_agro')
    expect(screen.getByText('Pelo CNAE')).toBeInTheDocument()
    fireEvent.change(segment, { target: { value: 'sector.trifaros_ali' } })
    expect(onSegmentChange).toHaveBeenCalledWith('0111301', 'sector.trifaros_ali')
  })

  it('adds a product of the Produtos table in its own popup, without NCM', async () => {
    const { calls, body } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar produto' }))

    const dialog = screen.getByRole('dialog', { name: 'Adicionar produto' })
    expect(within(dialog).queryByText(/NCM do catálogo|Pesquisar NCM/)).not.toBeInTheDocument()
    const options = within(dialog).getByRole('listbox', { name: 'Produtos disponíveis' })
    expect(options).toHaveTextContent(/Do segmento Agropecuária.*Arroz beneficiado.*Outros produtos.*Cerveja/)
    expect(within(dialog).getByRole('button', { name: 'Salvar produto' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('option', { name: /Arroz beneficiado/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true))
    expect(body('POST', profilesUrl)).toEqual({
      cnaeCode: '0111301',
      productLabel: 'Arroz beneficiado',
      productConceptCode: 'product.arroz_beneficiado',
      ncmCodes: [],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('adds a manual product typed by the user', async () => {
    const { calls, body } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar produto' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Produto novo (manual)' }))
    fireEvent.change(screen.getByLabelText(/Nome do produto/), { target: { value: 'Fertilizante foliar próprio' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))

    await waitFor(() => expect(calls.some((call) => call.init?.method === 'POST')).toBe(true))
    expect(body('POST', profilesUrl)).toEqual({
      cnaeCode: '0111301',
      productLabel: 'Fertilizante foliar próprio',
      productConceptCode: null,
      ncmCodes: [],
    })
  })

  it('adds NCMs to the CNAE in a separate popup, from the products and the official catalog', async () => {
    const { calls, body } = setup({ profiles: [profile()] })
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar NCM' }))

    const dialog = screen.getByRole('dialog', { name: 'Adicionar NCM' })
    // Suggested from the CNAE's products (Produtos table codes).
    const suggested = await within(dialog).findByRole('group', { name: 'NCMs dos produtos' })
    fireEvent.click(within(suggested).getByRole('checkbox', { name: /1006\.30\.11/ }))
    const prefixCall = calls.find((call) => call.url.includes('prefixes='))!
    expect(new URLSearchParams(prefixCall.url.split('?')[1]).get('prefixes')).toBe('100630')

    // Not linked to a product: saved to the CNAE.
    expect(within(dialog).getByLabelText(/Vincular a um produto/)).toHaveValue('')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar NCM' }))
    await waitFor(() => expect(calls.some((call) => call.url === cnaeNcmsUrl && call.init?.method === 'POST')).toBe(true))
    expect(body('POST', cnaeNcmsUrl)).toEqual({ cnaeCode: '0111301', ncmCodes: ['10063011'] })
  })

  it('can link the new NCM to one of the CNAE products', async () => {
    const { calls, body } = setup({ profiles: [profile()] })
    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar NCM' }))
    const dialog = screen.getByRole('dialog', { name: 'Adicionar NCM' })
    fireEvent.change(within(dialog).getByLabelText('Pesquisar NCM oficial'), { target: { value: '10063011' } })
    const found = await within(dialog).findByRole('group', { name: 'NCMs encontrados' })
    fireEvent.click(within(found).getByRole('checkbox', { name: /1006\.30\.11/ }))
    fireEvent.change(within(dialog).getByLabelText(/Vincular a um produto/), {
      target: { value: '44444444-4444-4444-8444-444444444444' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar NCM' }))

    const url = `${profilesUrl}/44444444-4444-4444-8444-444444444444`
    await waitFor(() => expect(calls.some((call) => call.url === url && call.init?.method === 'PUT')).toBe(true))
    expect(body('PUT', url)).toEqual({
      cnaeCode: '0111301',
      productLabel: 'Arroz beneficiado',
      productConceptCode: 'product.arroz_beneficiado',
      ncmCodes: ['10063011'],
    })
  })

  it('lists products and NCMs of the CNAE and removes an NCM from the table', async () => {
    const { calls } = setup({
      profiles: [profile({ productLabel: 'Arroz', productConceptCode: null, ncms: [{ ...riceNcm, code: '10062099', officialCode: '1006.20.99', isPrimary: false, assignmentSource: 'MANUAL' }] })],
      cnaeNcms: [{ id: '66666666-6666-4666-8666-666666666666', cnaeCode: '0111301', entryId: riceNcm.entryId, code: riceNcm.code, officialCode: riceNcm.officialCode, description: riceNcm.description }],
    })

    expect(await screen.findByRole('button', { name: 'Editar produto Arroz' })).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
    expect(screen.getByText('1006.20.99')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Remover NCM 1006.30.11' }))
    await waitFor(() =>
      expect(
        calls.some((call) => call.url === `${cnaeNcmsUrl}/66666666-6666-4666-8666-666666666666` && call.init?.method === 'DELETE'),
      ).toBe(true),
    )
  })
})
