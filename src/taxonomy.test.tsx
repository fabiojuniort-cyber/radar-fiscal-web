import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchCatalogArchive } from './catalog-api'
import type { ProductApiFetch } from './product-api'
import { PublicationTaxonomySection, reasonText } from './publication-taxonomy'
import { TaxonomyAdminPage } from './taxonomy-admin'
import { formatOfficialCode, setArchiveTagState, type PublicationTag } from './taxonomy-api'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
})

function json(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderWithProviders(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>,
  )
}

const release = {
  id: 'rel-12',
  version: 'v1.2.0',
  status: 'DRAFT',
  createdAt: '2026-10-02T12:00:00.000Z',
  publishedAt: null,
  previousReleaseId: 'rel-11',
  changeNotes: null,
}

const view = {
  release,
  dimensions: [
    {
      id: 'd1',
      code: 'product',
      name: 'Produto',
      description: null,
      revisionNo: 1,
      configured: true,
      profileVisible: true,
      profileOrder: 2,
      helpText: 'Produtos que a empresa compra, vende ou fabrica.',
      detailSection: 'Produtos',
      detailOrder: 4,
      usesGroups: true,
      officialCodeType: 'NCM',
      conceptCount: 2,
    },
  ],
  groups: [
    {
      id: 'g1',
      dimensionCode: 'product',
      code: 'fertilizantes',
      label: 'Fertilizantes e corretivos',
      displayOrder: 1,
      helpText: null,
      detailSection: null,
      officialCodes: ['31'],
      segmentCodes: [],
    },
  ],
  concepts: [
    {
      releaseConceptId: 'rc1',
      code: 'product.urea',
      dimensionCode: 'product',
      label: 'Ureia',
      definition: 'Ureia',
      positiveExample: null,
      negativeExample: null,
      governanceStatus: 'PROPOSED',
      evidenceStatus: 'NOT_ASSESSED',
      notes: null,
      releaseNotes: 'Sugestão TAX-11 — conferir antes de publicar.',
      membershipStatus: 'INCLUDED',
      groupId: 'g1',
      groupCode: 'fertilizantes',
      profileVisible: true,
      displayOrder: 1,
      helpText: null,
      classifyByLabel: true,
      officialCodes: ['310210'],
      aliases: [
        { text: 'carbamida', aliasType: 'EXACT_LEXICAL' },
        { text: 'adubo nitrogenado', aliasType: 'SEARCH_RELATED' },
      ],
    },
  ],
}

const state = {
  published: { ...release, id: 'rel-11', version: 'v1.1.0', status: 'PUBLISHED', publishedAt: '2026-10-02T04:50:00.000Z' },
  draft: release,
  settings: {
    classificationEnabled: false,
    classificationExcludedSources: ['doe-sp'],
    updatedAt: {},
    updatedBy: {},
  },
  engine: { key: 'tribusca.taxonomy.curated', version: '2.0.0' },
  progress: { total: 100, classified: 0, pending: 100, withoutTags: 0, failed: 0, excluded: 10 },
  catalogs: [
    { code: 'NCM', name: 'NCM', loaded: true, editionCode: 'e1', validFrom: '2026-09-01', loadedAt: null, entries: 15000, source: 'AUTOMATIC' },
    { code: 'CNAE', name: null, loaded: false, editionCode: null, validFrom: null, loadedAt: null, entries: 0, source: 'AUTOMATIC' },
    { code: 'CCLASSTRIB', name: null, loaded: false, editionCode: null, validFrom: null, loadedAt: null, entries: 0, source: 'UPLOAD' },
  ],
  curatorDatabase: true,
}

describe('Curadoria da taxonomia', () => {
  it('blocks users without the curator role', async () => {
    const apiFetch = vi.fn(async () => json({ taxonomyCurator: false, curatorDatabase: true })) as unknown as ProductApiFetch
    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument()
  })

  it('edits the table like a spreadsheet: change cells, add synonyms, insert and delete rows, save all at once', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, ...(init ? { init } : {}) })
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: true, curatorDatabase: true })
      if (url === '/api/v1/admin/taxonomy/state') return json(state)
      if (url === '/api/v1/admin/taxonomy/releases/rel-12') return json(view)
      if (url.endsWith('/dimensions/product/rows')) {
        return json({ created: ['product.gesso'], updated: 1, retired: 0, groupsCreated: 0 })
      }
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)

    expect(await screen.findByText('Curadoria da Taxonomia')).toBeInTheDocument()
    expect(await screen.findByText('Desligada')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Fertilizantes e corretivos')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Ureia')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3102.10')).toBeInTheDocument()
    expect(screen.getByText('carbamida')).toBeInTheDocument()
    // One kind of synonym: every stored synonym shows in the grid, untagged.
    expect(screen.getByText('adubo nitrogenado').closest('.tc-chip')).not.toHaveClass('is-search-only')
    expect(screen.queryByText('só busca')).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Código TriFaros/ })).toBeInTheDocument()

    // Edit a cell and add two synonyms at once (comma separated).
    fireEvent.change(screen.getByDisplayValue('3102.10'), { target: { value: '3102.10, 3102.90' } })
    fireEvent.change(screen.getAllByLabelText('Adicionar sinônimo')[0]!, { target: { value: 'ureia granulada;' } })
    fireEvent.change(screen.getAllByLabelText('Adicionar sinônimo')[0]!, { target: { value: 'ureia agrícola' } })
    fireEvent.keyDown(screen.getAllByLabelText('Adicionar sinônimo')[0]!, { key: 'Enter' })
    expect(screen.getByText('ureia granulada')).toBeInTheDocument()

    // Insert a row (code is generated on save) and an empty one that is deleted.
    fireEvent.click(screen.getByRole('button', { name: /Inserir linha/ }))
    fireEvent.change(screen.getByPlaceholderText('nome do item'), { target: { value: 'Gesso' } })
    expect(screen.getByText('gerado ao salvar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Inserir linha/ }))
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selecionar nova linha' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: /Excluir selecionadas/ }))

    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações \(2\)/ }))

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/dimensions/product/rows'))).toBe(true))
    const body = JSON.parse(String(calls.find((call) => call.url.endsWith('/rows'))!.init!.body))
    expect(body.justification).toBe('Curadoria da taxonomia')
    expect(body.retire).toEqual([])
    expect(body.rows).toHaveLength(2)
    expect(body.rows[0]).toMatchObject({ code: null, label: 'Gesso', group: null })
    expect(body.rows[1]).toMatchObject({
      code: 'product.urea',
      group: 'Fertilizantes e corretivos',
      officialCodes: ['3102.10', '3102.90'],
      aliases: [
        { text: 'carbamida', aliasType: 'EXACT_LEXICAL' },
        { text: 'adubo nitrogenado', aliasType: 'SEARCH_RELATED' },
        { text: 'ureia granulada', aliasType: 'EXACT_LEXICAL' },
        { text: 'ureia agrícola', aliasType: 'EXACT_LEXICAL' },
      ],
    })
    expect(await screen.findByText(/Salvo no rascunho: 1 novos · 1 alterados/)).toBeInTheDocument()
  })

  it('links the Segmento column to the Segmento table: drop-down per group, saved with the grid', async () => {
    const sectorConcept = (code: string, label: string, officialCodes: string[], releaseConceptId: string) => ({
      ...view.concepts[0]!,
      releaseConceptId,
      code,
      dimensionCode: 'sector',
      label,
      groupId: null,
      groupCode: null,
      officialCodes,
      aliases: [],
    })
    const withSegment = {
      ...view,
      dimensions: [
        ...view.dimensions,
        {
          ...view.dimensions[0]!,
          id: 'd2',
          code: 'sector',
          name: 'Segmento',
          detailSection: 'Segmentos',
          detailOrder: 1,
          usesGroups: false,
          officialCodeType: 'CNAE',
          conceptCount: 3,
        },
      ],
      groups: [{ ...view.groups[0]!, segmentCodes: ['sector.agribusiness'] }],
      concepts: [
        ...view.concepts,
        sectorConcept('sector.agribusiness', 'Agronegócio', ['01'], 'rc2'),
        sectorConcept('sector.trifaros_agro', 'Agropecuária, pesca e insumos agrícolas', [], 'rc3'),
        // A CNAE activity is not a segment: never offered.
        sectorConcept('sector.cultivo_de_arroz', 'Cultivo de arroz', ['0111301'], 'rc4'),
      ],
    }
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, ...(init ? { init } : {}) })
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: true, curatorDatabase: true })
      if (url === '/api/v1/admin/taxonomy/state') return json(state)
      if (url === '/api/v1/admin/taxonomy/releases/rel-12') return json(withSegment)
      if (url.endsWith('/dimensions/product/rows')) {
        return json({ created: [], updated: 0, retired: 0, groupsCreated: 0, groupsUpdated: 1 })
      }
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)

    expect(await screen.findByDisplayValue('Ureia')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim())
    expect(headers.filter(Boolean).slice(0, 3)).toEqual(['Segmento', 'Grupo', 'Item'])
    const row = screen.getByDisplayValue('Ureia').closest('tr')!
    const select = within(row).getByRole('combobox', { name: 'Segmento' })
    expect(select).toHaveValue('sector.agribusiness')
    const offered = within(select).getAllByRole('option').map((option) => option.textContent)
    expect(offered).toEqual(['— sem segmento —', 'Agronegócio', 'Agropecuária, pesca e insumos agrícolas'])

    fireEvent.change(select, { target: { value: 'sector.trifaros_agro' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações \(1\)/ }))

    await waitFor(() => expect(calls.some((call) => call.url.endsWith('/dimensions/product/rows'))).toBe(true))
    const body = JSON.parse(String(calls.find((call) => call.url.endsWith('/rows'))!.init!.body))
    expect(body.groupSegments).toEqual([{ group: 'Fertilizantes e corretivos', segmentCodes: ['sector.trifaros_agro'] }])
    expect(await screen.findByText(/segmento de 1 grupo/)).toBeInTheDocument()
  })

  it('shows the Segmento column only in the Segmento and Produtos tables', async () => {
    const segment = { ...view.concepts[0]!, releaseConceptId: 'rc2', code: 'sector.agribusiness', dimensionCode: 'sector', label: 'Agronegócio', groupId: null, groupCode: null, officialCodes: ['01'], aliases: [] }
    const documents = {
      ...view,
      dimensions: [
        { ...view.dimensions[0]!, id: 'd3', code: 'document', name: 'Documento', usesGroups: true, officialCodeType: null },
        { ...view.dimensions[0]!, id: 'd2', code: 'sector', name: 'Segmento', usesGroups: false, officialCodeType: 'CNAE' },
      ],
      groups: [{ ...view.groups[0]!, dimensionCode: 'document', code: 'mercadorias', label: 'Mercadorias', segmentCodes: ['sector.agribusiness'] }],
      concepts: [
        { ...view.concepts[0]!, code: 'document.nfe', dimensionCode: 'document', label: 'NF-e', groupId: 'g1', groupCode: 'mercadorias', officialCodes: ['55'] },
        segment,
      ],
    }
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: true, curatorDatabase: true })
      if (url === '/api/v1/admin/taxonomy/state') return json(state)
      if (url === '/api/v1/admin/taxonomy/releases/rel-12') return json(documents)
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)

    expect(await screen.findByDisplayValue('NF-e')).toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent?.trim())
    expect(headers).not.toContain('Segmento')
    expect(headers).toContain('Grupo')
  })

  it('creates the draft without requiring a reason', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, ...(init ? { init } : {}) })
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: true, curatorDatabase: true })
      if (url === '/api/v1/admin/taxonomy/state') return json({ ...state, draft: null })
      if (url === '/api/v1/admin/taxonomy/releases/rel-11') return json({ ...view, release: state.published })
      if (url === '/api/v1/admin/taxonomy/drafts') return json({ releaseId: 'rel-12', version: 'v1.2.0' })
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)
    const create = await screen.findByRole('button', { name: /Criar rascunho a partir da v1.1.0/ })
    expect(create).toBeEnabled()
    fireEvent.click(create)
    await waitFor(() => expect(calls.some((call) => call.url === '/api/v1/admin/taxonomy/drafts')).toBe(true))
    const body = JSON.parse(String(calls.find((call) => call.url === '/api/v1/admin/taxonomy/drafts')!.init!.body))
    expect(body.justification).toBe('Curadoria da taxonomia')
  })

  it('asks for confirmation before deleting a group and only then calls the API', async () => {
    const calls: string[] = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: true, curatorDatabase: true })
      if (url === '/api/v1/admin/taxonomy/state') return json(state)
      if (url === '/api/v1/admin/taxonomy/releases/rel-12') return json(view)
      if (url.endsWith('/groups/g1/delete')) return json({ error: 'group_in_use', message: 'Falha simulada' }, 409)
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<TaxonomyAdminPage apiFetch={apiFetch} />)
    fireEvent.change(await screen.findByRole('combobox', { name: 'Editar grupo' }), { target: { value: 'g1' } })
    fireEvent.click(screen.getByRole('button', { name: /Excluir grupo/ }))

    const dialog = screen.getByRole('dialog', { name: 'Excluir grupo?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(calls.some((url) => url.endsWith('/delete'))).toBe(false)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog', { name: 'Excluir grupo?' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Excluir grupo/ }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Excluir grupo?' })).getByRole('button', { name: 'Excluir grupo' }))
    await waitFor(() => expect(calls.some((url) => url.endsWith('/groups/g1/delete'))).toBe(true))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('Tags da legislação', () => {
  const tags = {
    publicationId: 'pub-1',
    publicationVersionId: 'ver-1',
    release: { ...state.published },
    status: 'CLASSIFIED',
    classifiedAt: '2026-10-02T12:00:00.000Z',
    sections: [
      {
        name: 'Benefícios e tratamentos',
        order: 2,
        tags: [
          {
            kind: 'CONCEPT',
            conceptCode: 'theme.presumed_credit',
            groupCode: 'beneficios',
            label: 'Crédito presumido',
            dimensionCode: 'theme',
            groupLabel: 'Benefícios fiscais',
            origin: 'AUTOMATIC',
            assertionId: 'a1',
            removed: false,
            reason: { type: 'TEXT', term: 'Crédito presumido', excerpt: '…concede crédito presumido nas saídas…' },
          },
        ],
      },
    ],
  }

  it('groups tags by section, explains why and opens the Acervo filtered by the tag', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: false, curatorDatabase: true })
      if (url === '/api/v1/publications/pub-1/taxonomy') return json(tags)
      return json({ error: 'not_found' }, 404)
    }) as unknown as ProductApiFetch

    renderWithProviders(<PublicationTaxonomySection apiFetch={apiFetch} publicationId="pub-1" />)

    const section = await screen.findByText('Benefícios e tratamentos')
    const card = section.closest('section')!
    const chip = within(card).getByRole('button', { name: /Crédito presumido/ })
    expect(chip).toHaveAttribute('title', expect.stringContaining('Encontrado no texto'))
    expect(within(card).getByRole('tooltip')).toHaveTextContent('concede crédito presumido')

    fireEvent.click(chip)
    const stored = JSON.parse(sessionStorage.getItem('tribusca.panel.state')!)
    expect(stored.screen).toBe('acervo')
    expect(stored.archiveTag).toEqual({ code: 'theme.presumed_credit', label: 'Crédito presumido' })
  })

  it('explains pending classification without inventing tags', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/v1/admin/me') return json({ taxonomyCurator: false, curatorDatabase: true })
      return json({ ...tags, status: 'DISABLED', classifiedAt: null, sections: [] })
    }) as unknown as ProductApiFetch
    renderWithProviders(<PublicationTaxonomySection apiFetch={apiFetch} publicationId="pub-1" />)
    expect(await screen.findByText('A classificação automática ainda não foi ativada.')).toBeInTheDocument()
  })

  it('describes each kind of reason', () => {
    const base = tags.sections[0]!.tags[0] as PublicationTag
    expect(reasonText({ ...base, reason: { type: 'NCM', term: '31021010', excerpt: 'NCM 31021010 citado na legislação' } })).toBe(
      'NCM 31021010 citado na legislação',
    )
    expect(
      reasonText({ ...base, reason: { type: 'PRODUCTS', term: 'Ureia', excerpt: 'Pelos produtos citados: Ureia' } }),
    ).toBe('Pelos produtos citados: Ureia')
    expect(reasonText({ ...base, reason: { type: 'SYNONYM', term: 'ISSQN', excerpt: null } })).toBe(
      'Sinônimo encontrado: “ISSQN”',
    )
    expect(reasonText({ ...base, origin: 'CURATOR', reason: { type: 'CURATOR', term: null, excerpt: 'citado no anexo' } })).toBe(
      'Marcada pela curadoria: citado no anexo',
    )
  })
})

describe('Acervo por tag e formatação', () => {
  it('sends the tag filter to the archive API', async () => {
    const apiFetch = vi.fn(async (_input: RequestInfo | URL) =>
      json({ page: 1, limit: 25, totalItems: 0, totalPages: 1, hasMore: false, items: [] }),
    )
    await fetchCatalogArchive(apiFetch as unknown as ProductApiFetch, { tag: 'theme.presumed_credit', page: 1 })
    expect(String(apiFetch.mock.calls[0]![0])).toContain('tag=theme.presumed_credit')
  })

  it('keeps unrelated panel state but clears other Acervo filters when handing a tag over', () => {
    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({ screen: 'inicio', uf: 'SP', query: 'icms', archivePage: 4, selectedCompanyId: 'c1' }),
    )
    sessionStorage.setItem('tribusca.archive.date', JSON.stringify({ from: '2026-01-01' }))
    setArchiveTagState({ code: 'product.urea', label: 'Ureia' })
    expect(JSON.parse(sessionStorage.getItem('tribusca.panel.state')!)).toMatchObject({
      screen: 'acervo',
      uf: '',
      query: '',
      archivePage: 1,
      selectedCompanyId: 'c1',
      archiveTag: { code: 'product.urea', label: 'Ureia' },
    })
    expect(sessionStorage.getItem('tribusca.archive.date')).toBeNull()
  })

  it('formats official codes for display', () => {
    expect(formatOfficialCode('NCM', '31042010')).toBe('3104.20.10')
    expect(formatOfficialCode('NCM', '3102')).toBe('3102')
    expect(formatOfficialCode('CNAE', '0111301')).toBe('0111-3/01')
    expect(formatOfficialCode('DOCUMENT_MODEL', '55')).toBe('55')
  })
})
