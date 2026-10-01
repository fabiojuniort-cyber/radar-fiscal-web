import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProductNcmProfile } from './product-ncm-profile'
import type { ProductApiFetch } from './product-api'

afterEach(() => {
  cleanup()
})

function renderProfile(apiFetch: ProductApiFetch) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductNcmProfile
        apiFetch={apiFetch}
        tenantId="tenant-1"
        companyId="company-1"
        cnaes={[{ code: '0111301', description: 'Cultivo de arroz' }]}
        sectorForCnae={() => 'Agronegócio'}
      />
    </QueryClientProvider>,
  )
}

describe('ProductNcmProfile', () => {
  it('renders persisted product/NCM data and creates another product from the official catalog', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === '/api/v1/companies/company-1/product-profiles' && !init?.method) {
        return new Response(JSON.stringify({
          items: [{
            id: 'profile-1',
            companyId: 'company-1',
            cnaeCode: '0111301',
            cnaeDescription: 'Cultivo de arroz',
            productLabel: 'Arroz beneficiado',
            taxonomy: {
              releaseId: null,
              sectorConceptId: null,
              productConceptId: null,
            },
            ncms: [{
              entryId: 'entry-1',
              code: '10063011',
              officialCode: '1006.30.11',
              description: 'Arroz semibranqueado ou branqueado.',
              isPrimary: true,
              assignmentSource: 'MANUAL',
            }],
            createdAt: '2026-10-01T12:00:00.000Z',
            updatedAt: '2026-10-01T12:00:00.000Z',
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }

      if (url.startsWith('/api/v1/ncm?')) {
        return new Response(JSON.stringify({
          items: [{
            entryId: 'entry-2',
            code: '10062099',
            officialCode: '1006.20.99',
            description: 'Outros arrozes descascados.',
          }],
          edition: { code: '2026-10-01-test', validFrom: '2026-10-01' },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      }

      if (url === '/api/v1/companies/company-1/product-profiles' && init?.method === 'POST') {
        return new Response(JSON.stringify({
          id: 'profile-2',
          companyId: 'company-1',
          cnaeCode: '0111301',
          cnaeDescription: 'Cultivo de arroz',
          productLabel: 'Arroz em casca',
          taxonomy: {
            releaseId: null,
            sectorConceptId: null,
            productConceptId: null,
          },
          ncms: [{
            entryId: 'entry-2',
            code: '10062099',
            officialCode: '1006.20.99',
            description: 'Outros arrozes descascados.',
            isPrimary: true,
            assignmentSource: 'MANUAL',
          }],
          createdAt: '2026-10-01T12:00:00.000Z',
          updatedAt: '2026-10-01T12:00:00.000Z',
        }), { status: 201, headers: { 'content-type': 'application/json' } })
      }

      throw new Error(`Unexpected request: ${url}`)
    }) as ProductApiFetch

    renderProfile(apiFetch)

    expect(await screen.findByText('Arroz beneficiado')).toBeInTheDocument()
    expect(screen.getByText('1006.30.11')).toBeInTheDocument()
    expect(screen.getByText('Agronegócio')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Adicionar$/ }))
    fireEvent.change(screen.getByLabelText('Produto'), {
      target: { value: 'Arroz em casca' },
    })
    fireEvent.change(screen.getByLabelText('Pesquisar NCM oficial'), {
      target: { value: '10062099' },
    })

    expect(await screen.findByText('Outros arrozes descascados.')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Outros arrozes descascados.'))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar produto e NCM' }))

    await waitFor(() => {
      const postCall = apiFetch.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(postCall).toBeTruthy()
      expect(postCall?.[0]).toBe('/api/v1/companies/company-1/product-profiles')
      expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
        cnaeCode: '0111301',
        productLabel: 'Arroz em casca',
        ncmCodes: ['10062099'],
      })
    })
  })
})
