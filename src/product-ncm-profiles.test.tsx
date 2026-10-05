import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductNcmProfiles } from './product-ncm-profiles'
import type { ProductApiFetch } from './product-api'

afterEach(() => {
  cleanup()
})

function renderProfiles(apiFetch: ProductApiFetch, onSegmentChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductNcmProfiles
        apiFetch={apiFetch}
        tenantId="11111111-1111-4111-8111-111111111111"
        companyId="22222222-2222-4222-8222-222222222222"
        cnaes={[{
          code: '0111301',
          description: 'Cultivo de arroz',
        }]}
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
}

describe('ProductNcmProfiles', () => {
  it('creates a product profile using an NCM selected from the official catalog', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let saved = false

    const apiFetch = vi.fn(async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input)
      calls.push({ url, init })

      if (url.startsWith('/api/v1/ncm?')) {
        return new Response(JSON.stringify({
          items: [{
            entryId: '33333333-3333-4333-8333-333333333333',
            code: '10063011',
            officialCode: '1006.30.11',
            description: 'Arroz semibranqueado ou branqueado, polido ou brunido',
          }],
          edition: { code: '2026-10', validFrom: '2026-10-01' },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }

      if (
        url === '/api/v1/companies/22222222-2222-4222-8222-222222222222/product-profiles' &&
        init?.method === 'POST'
      ) {
        saved = true
        return new Response(JSON.stringify({
          id: '44444444-4444-4444-8444-444444444444',
          companyId: '22222222-2222-4222-8222-222222222222',
          cnaeCode: '0111301',
          cnaeDescription: 'Cultivo de arroz',
          productLabel: 'Arroz beneficiado',
          taxonomy: {
            releaseId: null,
            sectorConceptId: null,
            productConceptId: null,
          },
          ncms: [{
            entryId: '33333333-3333-4333-8333-333333333333',
            code: '10063011',
            officialCode: '1006.30.11',
            description: 'Arroz semibranqueado ou branqueado, polido ou brunido',
            isPrimary: false,
            assignmentSource: 'MANUAL',
          }],
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        }), { status: 201, headers: { 'content-type': 'application/json' } })
      }

      if (url.endsWith('/product-profiles')) {
        return new Response(JSON.stringify({
          items: saved ? [{
            id: '44444444-4444-4444-8444-444444444444',
            companyId: '22222222-2222-4222-8222-222222222222',
            cnaeCode: '0111301',
            cnaeDescription: 'Cultivo de arroz',
            productLabel: 'Arroz beneficiado',
            taxonomy: {
              releaseId: null,
              sectorConceptId: null,
              productConceptId: null,
            },
            ncms: [{
              entryId: '33333333-3333-4333-8333-333333333333',
              code: '10063011',
              officialCode: '1006.30.11',
              description: 'Arroz semibranqueado ou branqueado, polido ou brunido',
              isPrimary: false,
              assignmentSource: 'MANUAL',
            }],
            createdAt: '2026-10-01T12:00:00.000Z',
            updatedAt: '2026-10-01T12:00:00.000Z',
          }] : [],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }

      throw new Error(`Unexpected request: ${url}`)
    }) as ProductApiFetch

    const onSegmentChange = vi.fn()
    renderProfiles(apiFetch, onSegmentChange)

    expect(await screen.findByText('Cultivo de arroz')).toBeInTheDocument()
    // Segment of the CNAE comes from the Segmento table and can be changed.
    const segment = screen.getByRole('combobox', { name: 'Segmento do CNAE 0111301' })
    expect(segment).toHaveValue('sector.trifaros_agro')
    expect(screen.getByText('Pelo CNAE')).toBeInTheDocument()
    fireEvent.change(segment, { target: { value: 'sector.trifaros_ali' } })
    expect(onSegmentChange).toHaveBeenCalledWith('0111301', 'sector.trifaros_ali')

    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar produto e NCM' }),
    )

    // Products come from the Produtos table, the CNAE's segment first.
    const options = screen.getByRole('listbox', { name: 'Produtos disponíveis' })
    expect(options).toHaveTextContent(/Do segmento Agropecuária.*Arroz beneficiado.*Outros produtos.*Cerveja/)
    expect(screen.getByRole('button', { name: 'Salvar produto e NCM' })).toBeDisabled()
    fireEvent.click(screen.getByRole('option', { name: /Arroz beneficiado/ }))

    // NCMs offered are the catalog NCMs under the product's codes.
    const ncm = await screen.findByRole('checkbox', { name: /1006\.30\.11.*Arroz semibranqueado/i })
    fireEvent.click(ncm)

    expect(
      screen.getByRole('button', { name: 'Remover NCM 1006.30.11' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar produto e NCM' }),
    )

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Editar produto Arroz beneficiado' }),
      ).toBeInTheDocument()
    })

    const ncmCall = calls.find((call) => call.url.startsWith('/api/v1/ncm?'))
    expect(new URLSearchParams(ncmCall!.url.split('?')[1]).get('prefixes')).toBe('100630')

    const postCall = calls.find(
      (call) => call.url.endsWith('/product-profiles') && call.init?.method === 'POST',
    )
    expect(postCall).toBeDefined()

    const headers = new Headers(postCall?.init?.headers)
    expect(headers.get('x-tenant-id')).toBe(
      '11111111-1111-4111-8111-111111111111',
    )

    expect(JSON.parse(String(postCall?.init?.body))).toEqual({
      cnaeCode: '0111301',
      productLabel: 'Arroz beneficiado',
      productConceptCode: 'product.arroz_beneficiado',
      ncmCodes: ['10063011'],
    })
  })

  it('renders existing products and NCMs for the linked CNAE', async () => {
    const apiFetch = vi.fn(async () =>
      new Response(JSON.stringify({
        items: [{
          id: '44444444-4444-4444-8444-444444444444',
          companyId: '22222222-2222-4222-8222-222222222222',
          cnaeCode: '0111301',
          cnaeDescription: 'Cultivo de arroz',
          productLabel: 'Arroz',
          taxonomy: {
            releaseId: null,
            sectorConceptId: null,
            productConceptId: null,
          },
          ncms: [{
            entryId: '33333333-3333-4333-8333-333333333333',
            code: '10062099',
            officialCode: '1006.20.99',
            description: 'Outros arrozes descascados',
            isPrimary: false,
            assignmentSource: 'MANUAL',
          }],
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as ProductApiFetch

    renderProfiles(apiFetch)

    expect(
      await screen.findByRole('button', { name: 'Editar produto Arroz' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1006.20.99')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Remover produto Arroz' }),
    ).toBeInTheDocument()
  })
})
