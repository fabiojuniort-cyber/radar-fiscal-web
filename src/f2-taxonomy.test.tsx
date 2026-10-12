import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CurationGrid, displaySegmentSubsegment } from './taxonomy-grid'
import { initializeF2Actuacao, type CurationConcept, type CurationDimension, type CurationGroup } from './taxonomy-api'
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
