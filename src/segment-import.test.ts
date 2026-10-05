import { describe, expect, it } from 'vitest'
import sourcePackage from '../ops/segments/trifaros-cnae-2.3.json'
import { importSegmentPackage, parseSegmentPackage, type SegmentPackage } from './segment-import'
import type { ProductApiFetch } from './product-api'
import type { ReleaseView } from './taxonomy-api'

const packageOf = (count = 1): SegmentPackage => ({
  format: 'trifaros-segmentos-cnae-v1', sourceWorkbook: 'test.xlsx', sourceUrl: 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses',
  segments: [{ id: 'AGRO', name: 'Agropecuária', definition: 'Produção agrícola.' }],
  subsegments: [{ id: 'AGRO-PROD', name: 'Agropecuária / Produção', segmentId: 'AGRO' }],
  rows: Array.from({ length: count }, (_, i) => ({ cnae: String(111301 + i).padStart(7, '0'), description: `Cultivo ${i}`, segmentId: 'AGRO', subsegmentId: 'AGRO-PROD', synonyms: [`Cultivo agrícola ${i}`] })),
})

function server() {
  const view = {
    release: { id: 'draft', status: 'DRAFT' },
    dimensions: [{ code: 'sector', officialCodeType: 'CNAE', usesGroups: true }],
    concepts: [], groups: [],
  } as unknown as ReleaseView
  const calls: string[] = []
  let batch = 0, failBatch = false
  const api = (async (url: string, init?: RequestInit) => {
    calls.push(url)
    const body = JSON.parse(String(init?.body ?? '{}'))
    let result: unknown = {}
    if (url.endsWith('/state')) result = { draft: { id: 'draft' } }
    else if (url.endsWith('/releases/draft')) result = view
    else if (url.endsWith('/concepts')) {
      view.concepts.push({ ...body, dimensionCode: 'sector', membershipStatus: 'INCLUDED' })
      result = { code: body.code }
    } else if (url.endsWith('/groups')) {
      const id = `group-${view.groups.length}`
      view.groups.push({ ...body, id, dimensionCode: 'sector' })
      result = { id }
    } else if (url.endsWith('/rows')) {
      batch++
      if (failBatch && batch === 2) return new Response(JSON.stringify({ error: 'temporary_failure' }), { status: 503 })
      const created: string[] = []
      let updated = 0
      for (const row of body.rows) {
        let concept = view.concepts.find(c => c.code === row.code)
        if (!concept) {
          const code = `sector.test_${row.officialCodes[0]}`
          concept = { code, dimensionCode: 'sector', membershipStatus: 'INCLUDED' } as ReleaseView['concepts'][number]
          view.concepts.push(concept)
          created.push(code)
        } else updated++
        Object.assign(concept, { ...row, code: concept.code, groupId: view.groups.find(g => g.label === row.group)!.id })
      }
      result = { created, updated, retired: 0, groupsCreated: 0 }
    } else throw new Error(`Unexpected route: ${url}`)
    return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
  }) as ProductApiFetch
  return { api, view, calls, fail: () => { failBatch = true }, recover: () => { failBatch = false } }
}

describe('Importação Segmento → Subsegmento → CNAE', () => {
  it('validates the actual complete package, including leading zeros and backend limits', () => {
    const data = parseSegmentPackage(JSON.stringify(sourcePackage))
    expect(data.rows).toHaveLength(1332)
    expect(data.segments).toHaveLength(32)
    expect(data.subsegments).toHaveLength(137)
    expect(data.rows[0]!.cnae).toBe('0111301')
    expect(data.rows.reduce((n, row) => n + row.synonyms.length, 0)).toBe(17671)
  })
  it('rejects duplicate codes and inconsistent relationships before writing', () => {
    const data = packageOf()
    data.rows.push(data.rows[0]!)
    expect(() => parseSegmentPackage(JSON.stringify(data))).toThrow('CNAE repetido')
    data.rows.pop()
    data.rows[0]!.segmentId = 'INVALID'
    expect(() => parseSegmentPackage(JSON.stringify(data))).toThrow('incompatíveis')
  })
  it('can resume a partially committed load without duplicating CNAEs, groups or segments', async () => {
    const s = server()
    s.fail()
    await expect(importSegmentPackage(s.api, s.view, 'Importação autorizada', packageOf(41), () => {})).rejects.toThrow()
    expect(s.view.concepts.filter(c => c.officialCodes?.length)).toHaveLength(40)
    s.recover()
    const result = await importSegmentPackage(s.api, s.view, 'Retomada autorizada', packageOf(41), () => {})
    expect(result).toMatchObject({ cnaes: 41, created: 1, updated: 40 })
    expect(s.view.groups).toHaveLength(1)
    expect(s.view.concepts).toHaveLength(42)
    expect(s.calls.some(url => /publish|classification|settings/.test(url))).toBe(false)
    expect(s.view.concepts[1]!.officialCodes).toEqual(['0111301'])
  })
  it('refuses ambiguous existing mappings before the first mutation', async () => {
    const s = server()
    for (const code of ['sector.one', 'sector.two']) s.view.concepts.push({ code, dimensionCode: 'sector', membershipStatus: 'INCLUDED', officialCodes: ['0111301'] } as ReleaseView['concepts'][number])
    await expect(importSegmentPackage(s.api, s.view, 'Importação autorizada', packageOf(), () => {})).rejects.toThrow('mais de um')
    expect(s.calls).toHaveLength(2)
  })
})
