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

function renderProfiles(apiFetch: ProductApiFetch) {
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
        sectorLabel={() => 'Agronegócio'}
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

    renderProfiles(apiFetch)

    expect(await screen.findByText('Cultivo de arroz')).toBeInTheDocument()
    expect(screen.getByText('Agronegócio')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar produto e NCM' }),
    )

    fireEvent.change(
      screen.getByPlaceholderText('Ex.: Arroz, soja, fertilizante NPK'),
      { target: { value: 'Arroz beneficiado' } },
    )

    fireEvent.change(
      screen.getByLabelText('Pesquisar NCM oficial'),
      { target: { value: '10063011' } },
    )

    const ncmResult = await screen.findByRole('button', {
      name: /1006\.30\.11.*Arroz semibranqueado/i,
    })
    fireEvent.click(ncmResult)

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
