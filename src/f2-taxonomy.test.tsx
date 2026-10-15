import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TaxonomyAdminPage } from './taxonomy-admin'

import { CurationGrid, displaySegmentSubsegment, subsegmentName } from './taxonomy-grid'
import { initializeF2Actuacao, F2_DRYRUN_REPORT_MAX_BYTES, type CurationConcept, type CurationDimension, type CurationGroup } from './taxonomy-api'
import type { ProductApiFetch } from './product-api'

afterEach(cleanup)

describe('F2-T01 — Segmento e Subsegmento existentes', () => {
  it('renders the context without changing the stored group identity', () => {
    expect(displaySegmentSubsegment('Agronegócio', 'Grãos')).toBe('Agronegócio – Grãos')
    expect(displaySegmentSubsegment('', 'Grãos')).toBe('Grãos')

    const dimension = { code: 'sector', name: 'Segmentos', usesGroups: true, officialCodeType: 'CNAE' } as CurationDimension
    const groups = [{ id: 'grupo1', code: 'graos', dimensionCode: 'sector', label: 'Grãos', displayOrder: 1, segmentCodes: ['sector.agro'] }] as CurationGroup[]
    const sector = {
      code: 'sector.agro', dimensionCode: 'sector', label: 'Agronegócio', membershipStatus: 'INCLUDED',
      officialCodes: [], aliases: [], groupId: null, profileVisible: true, classifyByLabel: false,
    } as unknown as CurationConcept
    const cnae = {
      ...sector, code: 'sector.cnae_0111301', label: 'Cultivo de arroz', groupId: 'grupo1',
      officialCodes: ['0111301'], classifyByLabel: true,
    } as CurationConcept
    render(<CurationGrid apiFetch={(() => { throw new Error('unexpected mutation') }) as ProductApiFetch}
      dimension={dimension} concepts={[sector, cnae]} groups={groups} segments={[sector]}
      editable={false} justification="teste" showRetired={false} query=""
      onChanged={async () => {}} onOpenDetail={() => {}} />)
    expect(screen.getByLabelText('Segmento e subsegmento')).toHaveTextContent('Agronegócio – Grãos')
    expect(screen.getByLabelText('Subsegmento')).toHaveValue('Grãos')
  })
})

describe('F2-T02 — Atuação independente da tabela Segmento', () => {
  it('calls only the dedicated draft initializer with the curator justification', async () => {
    const apiFetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({
        dimension: 'actuacao', seededCodes: ['actuacao.servico'], sourceRows: 1332,
        sourceSha256: 'source', classificationPublished: false,
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    ) as unknown as ProductApiFetch

    const result = await initializeF2Actuacao(apiFetch, 'Aprovação F2-T02 no rascunho')
    const [path, init] = vi.mocked(apiFetch).mock.calls[0]!
    expect(String(path)).toBe('/api/v1/admin/taxonomy/drafts/current/actuacao/initialize')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ justification: 'Aprovação F2-T02 no rascunho' })
    expect(result.classificationPublished).toBe(false)
  })
})

describe('F2-T02 approved full report guard', () => {
  it('accepts the approved 3,125,408-byte JSON report while rejecting oversized files', () => {
    expect(F2_DRYRUN_REPORT_MAX_BYTES).toBeGreaterThan(3_125_408)
    expect(F2_DRYRUN_REPORT_MAX_BYTES).toBeLessThanOrEqual(8_000_000)
  })
})


describe('F2 visual smoke regressions — T01/T02/T03', () => {
  const parent = 'Agropecuária, pesca e insumos agrícolas'
  const child = 'Produção agropecuária, florestal ou pesqueira'
  const legacyLabel = `${parent} / ${child}`
  const sector = {
    code: 'sector.agro', dimensionCode: 'sector', label: parent,
    membershipStatus: 'INCLUDED', officialCodes: [], aliases: [], groupId: null,
    profileVisible: true, classifyByLabel: false,
  } as unknown as CurationConcept
  const dimension = {
    code: 'sector', name: 'Segmento', usesGroups: true, officialCodeType: 'CNAE',
  } as CurationDimension
  const group = {
    id: 'g1', code: 'g1', dimensionCode: 'sector', label: legacyLabel,
    displayOrder: 1, segmentCodes: ['sector.agro'], officialCodes: [],
    helpText: null, detailSection: null,
  } as CurationGroup
  const activity = {
    ...sector, code: 'sector.cnae_0111301', label: 'Cultivo de arroz', groupId: 'g1',
    officialCodes: ['0111301'], classifyByLabel: true, displayOrder: 1,
  } as CurationConcept

  it('T01 removes duplicated parent from visual cell, preserves raw group in all writes', async () => {
    expect(subsegmentName(parent, legacyLabel)).toBe(child)
    expect(displaySegmentSubsegment(parent, legacyLabel)).toBe(`${parent} – ${child}`)
    expect(subsegmentName('Outro segmento', legacyLabel)).toBe(legacyLabel)
    const apiFetch = vi.fn(async () => new Response(JSON.stringify({
      created: [], updated: 1, retired: 0, groupsCreated: 0,
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as ProductApiFetch
    render(<CurationGrid apiFetch={apiFetch} dimension={dimension} groups={[group]}
      concepts={[sector, activity]} segments={[sector]} editable justification="Revisão visual"
      showRetired={false} query="" onChanged={async () => {}} onOpenDetail={() => {}} />)
    expect(screen.getByLabelText('Subsegmento')).toHaveValue(child)
    expect(screen.getByLabelText('Segmento e subsegmento')).toHaveTextContent(`${parent} – ${child}`)
    expect(screen.queryByText(`${parent} – ${legacyLabel}`)).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descrição do CNAE'), { target: { value: 'Cultivo de arroz revisado' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled())
    const payload = JSON.parse(String(vi.mocked(apiFetch).mock.calls[0]![1]?.body))
    expect(payload.rows[0].group).toBe(legacyLabel)
  })

  it('T02 always shows Atuação in the taxonomy menu, without silently creating production data', async () => {
    const published = {
      id: 'release-1', version: 'v1', status: 'PUBLISHED', createdAt: '2026-10-10T00:00:00Z',
      publishedAt: '2026-10-10T00:00:00Z', previousReleaseId: null, changeNotes: null,
    }
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const data = url === '/api/v1/admin/me' ?
        { platformAdmin: true, taxonomyCurator: true, curatorDatabase: true } :
        url === '/api/v1/admin/taxonomy/state' ? {
          published, draft: null, curatorDatabase: true, catalogs: [], progress: null,
          settings: { classificationEnabled: false, classificationExcludedSources: [], updatedAt: {}, updatedBy: {} },
          engine: { key: 'tax', version: '1' },
        } :
        url.endsWith('/releases/release-1') ?
          { release: published, dimensions: [{
            id: 'd-product', code: 'product', name: 'Produto', usesGroups: false,
            profileVisible: true, profileOrder: 1, conceptCount: 0,
          }], concepts: [], groups: [] } :
          { error: 'unexpected route' }
      return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as unknown as ProductApiFetch
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}>
      <MemoryRouter><TaxonomyAdminPage apiFetch={apiFetch} /></MemoryRouter>
    </QueryClientProvider>)
    const menu = await screen.findByRole('button', { name: /Atuação.*Não inicializada/ })
    fireEvent.click(menu)
    expect(screen.getByRole('region', { name: 'Atuação pendente' })).toHaveTextContent('Crie um rascunho')
    expect(screen.queryByRole('button', { name: 'Preparar tabela Atuação no rascunho' })).not.toBeInTheDocument()
    expect(vi.mocked(apiFetch).mock.calls.some(([url]) => String(url).includes('/actuacao/initialize'))).toBe(false)
  })

  it('T03 shows all read-only columns and never passes source suggestions to curator writes', async () => {
    const enriched = {
      ...activity, f2Source: {
        atuacao: 'Produção agropecuária',
        suggestedProducts: 'Arroz em casca; Arroz beneficiado',
        suggestedNcms: '1006.10;1006.20',
      },
    }
    const apiFetch = vi.fn(async () => new Response(JSON.stringify({
      created: [], updated: 1, retired: 0, groupsCreated: 0,
    }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as ProductApiFetch
    render(<CurationGrid apiFetch={apiFetch} dimension={dimension} groups={[group]}
      concepts={[sector, enriched]} segments={[sector]} editable justification="Revisão visual"
      showRetired={false} query="" onChanged={async () => {}} onOpenDetail={() => {}} />)
    const grid = screen.getByRole('table', { name: 'Itens de Segmento' })
    for (const label of ['Atuação', 'Produtos sugeridos', 'NCMs sugeridos']) {
      expect(within(grid).getByRole('columnheader', { name: label })).toBeInTheDocument()
    }
    expect(within(grid).getByText('Produção agropecuária')).toBeInTheDocument()
    expect(within(grid).getByText('Arroz em casca')).toBeInTheDocument()
    expect(within(grid).getByText('Arroz beneficiado')).toBeInTheDocument()
    expect(within(grid).getByText('1006.10')).toBeInTheDocument()
    expect(within(grid).getByText('1006.20')).toBeInTheDocument()
    expect(within(grid).queryByRole('button',{name:/Remover NCM sugerida/})).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Descrição do CNAE'), { target: { value: 'Cultivo revisado' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/ }))
    await waitFor(() => expect(vi.mocked(apiFetch)).toHaveBeenCalled())
    const payload = JSON.parse(String(vi.mocked(apiFetch).mock.calls[0]![1]?.body))
    expect(JSON.stringify(payload)).not.toMatch(/suggestedProducts|suggestedNcms|atuacao|f2Source/)
  })

  it('T03 leaves pending values explicit when the backend has not linked a source batch', () => {
    render(<CurationGrid apiFetch={(() => { throw new Error('unexpected mutation') }) as ProductApiFetch}
      dimension={dimension} groups={[group]} concepts={[sector, activity]} segments={[sector]}
      editable={false} justification="teste" showRetired={false} query=""
      onChanged={async () => {}} onOpenDetail={() => {}} />)
    const grid = screen.getByRole('table', { name: 'Itens de Segmento' })
    expect(within(grid).getAllByTitle('Sem vínculo auditado com a fonte F2 nesta versão')).toHaveLength(3)
    expect(screen.getByText(/carga isolada T03 não publica esses dados automaticamente/)).toBeInTheDocument()
  })
})

describe('F2-TAB-02 B1 — distinct subgroup identities and missing parent links', () => {
  it('keeps similarly-prefixed subgroups distinct, warning only on missing persisted segment link', () => {
    const prefix='a'.repeat(60)
    const parent={
      code:'sector.agro',label:'Agronegócio',dimensionCode:'sector',
      officialCodes:[],aliases:[],membershipStatus:'INCLUDED',groupId:null,
      profileVisible:true,classifyByLabel:false,
    } as unknown as CurationConcept
    const groups=[
      {id:'group-one',code:'legacy',label:prefix+' A',dimensionCode:'sector',
        displayOrder:1,segmentCodes:['sector.agro']},
      {id:'group-two',code:'collision_f2hash',label:prefix+' B',dimensionCode:'sector',
        displayOrder:2,segmentCodes:[]},
    ] as CurationGroup[]
    const concepts=[
      parent,
      ...groups.map((group,i)=>({
        ...parent,code:'sector.cnae_100000'+i,label:'Atividade '+i,
        officialCodes:['10000'+i+'1'],groupId:group.id,classifyByLabel:true,
      })),
    ] as CurationConcept[]
    render(<CurationGrid
      apiFetch={(() => { throw new Error('unexpected mutation') }) as ProductApiFetch}
      dimension={{code:'sector',name:'Segmento',usesGroups:true,officialCodeType:'CNAE'} as CurationDimension}
      concepts={concepts} groups={groups} segments={[parent]}
      editable={false} justification="Auditoria" showRetired={false} query=""
      onChanged={async()=>{}} onOpenDetail={()=>{}} />)
    const warnings=screen.getAllByText('Segmento sem vínculo no rascunho')
    expect(warnings).toHaveLength(1)
    const table=screen.getByRole('table',{name:'Itens de Segmento'})
    const inputs=within(table).getAllByLabelText('Subsegmento',{exact:true})
    expect(inputs).toHaveLength(2)
    expect(inputs[0]).toHaveValue(prefix+' A')
    expect(inputs[1]).toHaveValue(prefix+' B')
  })
})
