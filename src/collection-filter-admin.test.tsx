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
  it('preserva os critérios aprovados não padrão ao criar um rascunho com os campos ocultos', async () => {
    const current = state()
    current.policies[0].status = 'APPROVED'
    Object.assign(current.documents[policyId], { status:'APPROVED', contextWindowWords:27, weakScoreThreshold:8, locationWeights:{title:7,summary:5,body:2} })
    let saved: Record<string, unknown> | undefined
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if(url === '/api/v1/admin/me') return json(adminMe)
      if(url.endsWith('/state')) return json(current)
      if(url.endsWith('/draft') && init?.method === 'PUT') { saved = JSON.parse(String(init.body)); return json({policyId,version:2,revision:1}) }
      if(url.includes('/facets')) return json({sources:[{code:'dou',name:'DOU'}],actTypes:['PORTARIA'],ufs:[]})
      return json({items:[]})
    }) as unknown as ProductApiFetch
    renderPage(apiFetch)
    await screen.findByRole('cell', {name:'PORTARIA'})
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('O que mudou nesta revisão?'), {target:{value:'Só interface'}})
    fireEvent.click(screen.getByRole('button',{name:'Salvar rascunho'}))
    await waitFor(()=>expect(saved).toMatchObject({contextWindowWords:27,weakScoreThreshold:8,locationWeights:{title:7,summary:5,body:2},changeNotes:'Só interface'}))
    expect(saved?.rules).toEqual(current.documents[policyId].rules)
    expect(saved?.terms).toEqual(current.documents[policyId].terms)
  })

  it('não permite salvar antes de carregar a política nem depois de erro de leitura', async () => {
    let finish!: (response:Response)=>void
    const pending=new Promise<Response>(resolve=>{finish=resolve})
    const writes:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const url=String(input)
      if(init?.method && init.method!=='GET') writes.push(url)
      if(url==='/api/v1/admin/me')return json(adminMe)
      if(url.endsWith('/state'))return pending
      return json({items:[]})
    }) as unknown as ProductApiFetch
    renderPage(apiFetch)
    await screen.findByText('Carregando a política…')
    const save=screen.getByRole('button',{name:'Salvar rascunho'})
    expect(save).toBeDisabled();fireEvent.click(save);expect(writes).toEqual([])
    finish(json({error:'unavailable'},503))
    await screen.findByText('Não foi possível carregar a política. Tente novamente antes de editar.')
    expect(screen.getByRole('button',{name:'Salvar rascunho'})).toBeDisabled()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(writes).toEqual([])
  })

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
      await screen.findByRole('cell', { name: 'PORTARIA' }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Modo PORTARIA'),
    ).toHaveValue('KEEP_IF_TAX_TERM')

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

    expect(screen.getByRole('dialog', { name: 'Classificar novo tipo' })).toBeInTheDocument()
    expect(resolved).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar classificação' }))
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
          url === `/api/v1/admin/collection-filter/drafts/${policyId}/approve` &&
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
    await waitFor(() => expect(approve).toBeEnabled())
    fireEvent.click(approve)

    expect(
      await screen.findByText(
        'É necessário concluir uma nova simulação desta revisão antes de aprovar.',
      ),
    ).toBeInTheDocument()
  })

  it('revisa amostra concluída e marca erro com decisão esperada', async () => {
    const simulationId = '33333333-3333-4333-8333-333333333333'
    const publicationId = '44444444-4444-4444-8444-444444444444'
    let marked = false

    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/v1/admin/me') return json(adminMe)
        if (url === '/api/v1/admin/collection-filter/state') {
          return json({
            ...state(),
            simulations: [
              {
                id: simulationId,
                policy_id: policyId,
                policy_revision: 2,
                status: 'COMPLETED',
                scope: 'FULL_ARCHIVE',
                review_mode: 'SAMPLE',
                metrics: {
                  inspected: 100,
                  keep: 70,
                  discard: 30,
                  unknownType: 4,
                },
                error_code: null,
                created_at: '2026-10-07T01:00:00Z',
                completed_at: '2026-10-07T01:05:00Z',
              },
            ],
          })
        }
        if (url.includes('/new-types?status=OPEN')) {
          return json({ items: [] })
        }
        if (
          url.startsWith(
            `/api/v1/admin/collection-filter/simulations/${simulationId}/items?`,
          ) &&
          !init?.method
        ) {
          return json({
            items: [
              {
                simulation_id: simulationId,
                publication_id: publicationId,
                source_code: 'dou',
                section: 'DO1',
                raw_type: 'PORTARIA',
                canonical_type: 'PORTARIA',
                decision: 'DISCARD',
                reason_code: 'WEAK_SCORE_BELOW_THRESHOLD',
                decisive_term: null,
                excerpt: 'Trecho administrativo de exemplo.',
                title: 'Portaria de teste da simulação',
                published_on: '2026-10-06',
                official_url: 'https://example.test/portaria',
                review_sample: true,
                marked_error: marked,
                expected_decision: marked ? 'KEEP' : null,
                note: marked ? 'Deveria ser mantida.' : null,
              },
            ],
          })
        }
        if (
          url ===
            `/api/v1/admin/collection-filter/simulations/${simulationId}/items/${publicationId}/feedback` &&
          init?.method === 'PUT'
        ) {
          const body = JSON.parse(String(init.body))
          expect(body).toEqual({
            markedError: true,
            expectedDecision: 'KEEP',
            note: 'Deveria ser mantida.',
          })
          marked = true
          return json({
            simulation_id: simulationId,
            publication_id: publicationId,
            marked_error: true,
            expected_decision: 'KEEP',
            note: 'Deveria ser mantida.',
          })
        }
        return json({ error: 'unexpected' }, 500)
      },
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)

    await screen.findByRole('cell', { name: 'PORTARIA' })
    fireEvent.click(
      screen.getByRole('button', { name: 'Simulações' }),
    )

    expect(
      await screen.findByText('Portaria de teste da simulação'),
    ).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()

    fireEvent.change(
      screen.getByPlaceholderText('Motivo da correção'),
      { target: { value: 'Deveria ser mantida.' } },
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar erro' }),
    )

    expect(
      await screen.findByRole('button', {
        name: 'Marcar como correto',
      }),
    ).toBeInTheDocument()
  })

})

