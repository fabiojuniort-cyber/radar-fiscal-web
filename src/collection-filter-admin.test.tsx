import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CollectionFilterAdminPage } from './collection-filter-admin'
import type { ProductApiFetch } from './product-api'

afterEach(() => cleanup())

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage(apiFetch: ProductApiFetch) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CollectionFilterAdminPage apiFetch={apiFetch} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const adminMe = {
  platformAdmin: true,
  taxonomyCurator: true,
  licenseBypass: true,
  curatorDatabase: true,
}

const policyId = '11111111-1111-4111-8111-111111111111'
const newTypeId = '22222222-2222-4222-8222-222222222222'

function state() {
  return {
    policies: [
      {
        id: policyId,
        version: 1,
        revision: 2,
        status: 'DRAFT',
      },
    ],
    documents: {
      [policyId]: {
        id: policyId,
        version: 1,
        revision: 2,
        status: 'DRAFT',
        contextWindowWords: 12,
        weakScoreThreshold: 3,
        locationWeights: { title: 3, summary: 2, body: 1 },
        changeNotes: 'Revisão atual',
        rules: [
          {
            sourceCode: 'dou',
            section: 'DO1',
            canonicalType: 'PORTARIA',
            mode: 'KEEP_IF_TAX_TERM',
            helpText: null,
          },
        ],
        aliases: [],
        terms: [
          {
            text: 'ICMS',
            normalizedTerm: 'ICMS',
            strength: 'STRONG',
            sourceCode: null,
            section: null,
            canonicalType: null,
            locationScope: 'ANY',
          },
        ],
      },
    },
    simulations: [],
    newTypesOpen: 1,
  }
}

describe('Filtro de Coleta administrativo', () => {
  it('bloqueia usuário sem PLATFORM_ADMIN', async () => {
    const apiFetch = vi.fn(async () =>
      json({ ...adminMe, platformAdmin: false }),
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)
    expect(
      await screen.findByText('Acesso restrito'),
    ).toBeInTheDocument()
  })

  it('carrega rascunho, salva edição e resolve novo tipo', async () => {
    let resolved = false
    const calls: Array<{ url: string; init?: RequestInit }> = []

    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        calls.push({ url, init })

        if (url === '/api/v1/admin/me') return json(adminMe)
        if (url === '/api/v1/admin/collection-filter/state') {
          return json(state())
        }
        if (url.includes('/new-types?status=OPEN')) {
          return json({
            items: resolved
              ? []
              : [
                  {
                    id: newTypeId,
                    source_code: 'dou',
                    section: 'DO1',
                    normalized_type: 'ATO NOVO',
                    sample_raw_type: 'Ato Novo',
                    occurrence_count: 4,
                    first_seen_at: '2026-10-06T10:00:00Z',
                    last_seen_at: '2026-10-06T12:00:00Z',
                    sample_publication_ids: [],
                    status: 'OPEN',
                    resolved_at: null,
                  },
                ],
          })
        }
        if (url === '/api/v1/admin/collection-filter/draft') {
          return json({
            policyId,
            version: 1,
            revision: 3,
          })
        }
        if (url.endsWith(`/new-types/${newTypeId}/resolve`)) {
          const body = JSON.parse(String(init?.body))
          expect(body).toEqual({
            status: 'RESOLVED',
            canonicalType: 'ATO NOVO',
          })
          resolved = true
          return json({
            id: newTypeId,
            status: 'RESOLVED',
            canonicalType: 'ATO NOVO',
          })
        }
        return json({ error: 'unexpected' }, 500)
      },
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)

    expect(
      await screen.findByText('PORTARIA'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Manter só se tiver termo tributário'),
    ).toBeInTheDocument()

    const notes = screen.getByPlaceholderText(
      'O que mudou nesta revisão?',
    )
    fireEvent.change(notes, {
      target: { value: 'Ajuste revisado' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar rascunho' }),
    )

    await waitFor(() => {
      const saveCall = calls.find(
        (call) =>
          call.url === '/api/v1/admin/collection-filter/draft' &&
          call.init?.method === 'PUT',
      )
      expect(saveCall).toBeTruthy()
      const body = JSON.parse(String(saveCall?.init?.body))
      expect(body.changeNotes).toBe('Ajuste revisado')
      expect(body.rules[0].canonicalType).toBe('PORTARIA')
    })

    fireEvent.click(
      screen.getByRole('button', {
        name: /Novos tipos/,
      }),
    )
    expect(
      await screen.findByText('Ato Novo'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Classificar' }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Ato Novo')).not.toBeInTheDocument()
    })
  })

  it('explica o bloqueio de aprovação sem simulação recente', async () => {
    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/v1/admin/me') return json(adminMe)
        if (url === '/api/v1/admin/collection-filter/state') {
          return json(state())
        }
        if (url.includes('/new-types?status=OPEN')) {
          return json({ items: [] })
        }
        if (
          url === '/api/v1/admin/collection-filter/approve' &&
          init?.method === 'POST'
        ) {
          return json(
            {
              error:
                'collection_filter_fresh_simulation_required',
            },
            409,
          )
        }
        return json({ error: 'unexpected' }, 500)
      },
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)

    const approve = await screen.findByRole('button', {
      name: 'Aprovar política',
    })
    fireEvent.click(approve)

    expect(
      await screen.findByText(
        'É necessário concluir uma nova simulação desta revisão antes de aprovar.',
      ),
    ).toBeInTheDocument()
  })
})
