import type { ProductApiFetch } from './product-api'
import {
  createConcept, createGroup, patchGroup, patchDimension, fetchReleaseView,
  fetchCurationState, saveDimensionRows, type ReleaseView, type GridRowInput,
} from './taxonomy-api'

export type SegmentPackage = {
  format: 'trifaros-segmentos-cnae-v1'
  sourceWorkbook: string
  sourceUrl: string
  segments: Array<{ id: string; name: string; definition: string }>
  subsegments: Array<{ id: string; name: string; segmentId: string }>
  rows: Array<{ cnae: string; description: string; segmentId: string; subsegmentId: string; synonyms: string[] }>
}

const normalize = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[‐‑‒–—―]/g, '-').toLowerCase().trim().replace(/\s+/g, ' ')
const fail = (message: string): never => { throw new Error(message) }
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail('Arquivo de segmentos inválido.')
const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : fail('Texto ausente ou acima do limite na planilha.')
const array = (value: unknown, max: number): unknown[] =>
  Array.isArray(value) && value.length > 0 && value.length <= max ? value : fail('Lista vazia ou acima do limite na planilha.')

/** Validate every relationship and alias before the first curator write. */
export function parseSegmentPackage(raw: string): SegmentPackage {
  const data = record(JSON.parse(raw))
  if (data.format !== 'trifaros-segmentos-cnae-v1') fail('Formato de segmentos não reconhecido.')
  const segments = array(data.segments, 200).map(value => {
    const row = record(value)
    const id = text(row.id, 40)
    if (!/^[A-Z][A-Z0-9_-]*$/.test(id)) fail('Identificador de segmento inválido.')
    return { id, name: text(row.name, 200), definition: text(row.definition, 4000) }
  })
  const bySegment = new Map(segments.map(row => [row.id, row]))
  if (bySegment.size !== segments.length || new Set(segments.map(row => normalize(row.name))).size !== segments.length) fail('Segmento repetido.')
  const subsegments = array(data.subsegments, 1000).map(value => {
    const row = record(value)
    const segmentId = text(row.segmentId, 40)
    if (!bySegment.has(segmentId)) fail('Subsegmento sem segmento válido.')
    return { id: text(row.id, 80), name: text(row.name, 200), segmentId }
  })
  const bySub = new Map(subsegments.map(row => [row.id, row]))
  if (bySub.size !== subsegments.length || new Set(subsegments.map(row => normalize(row.name))).size !== subsegments.length) fail('Subsegmento repetido.')
  const rows = array(data.rows, 5000).map(value => {
    const row = record(value)
    const cnae = text(row.cnae, 7)
    if (!/^\d{7}$/.test(cnae)) fail('CNAE deve ter sete dígitos, inclusive zeros à esquerda.')
    const subsegmentId = text(row.subsegmentId, 80)
    const segmentId = text(row.segmentId, 40)
    if (bySub.get(subsegmentId)?.segmentId !== segmentId) fail(`CNAE ${cnae}: segmento e subsegmento incompatíveis.`)
    const synonyms = array(row.synonyms, 200).map(value => text(value, 300))
    if (new Set(synonyms.map(normalize)).size !== synonyms.length) fail(`CNAE ${cnae}: sinônimo repetido.`)
    return { cnae, description: text(row.description, 300), segmentId, subsegmentId, synonyms }
  })
  if (new Set(rows.map(row => row.cnae)).size !== rows.length) fail('CNAE repetido no arquivo.')
  return { format: 'trifaros-segmentos-cnae-v1', sourceWorkbook: text(data.sourceWorkbook, 200), sourceUrl: text(data.sourceUrl, 500), segments, subsegments, rows }
}

function exactCnaes(view: ReleaseView) {
  const result = new Map<string, ReleaseView['concepts'][number]>()
  for (const concept of view.concepts.filter(row => row.dimensionCode === 'sector' && row.membershipStatus === 'INCLUDED')) {
    for (const cnae of concept.officialCodes.filter(code => /^\d{7}$/.test(code))) {
      if (result.has(cnae)) fail(`CNAE ${cnae} está associado a mais de um item. Corrija antes de importar.`)
      if (concept.officialCodes.length !== 1) fail(`CNAE ${cnae} pertence a um item com vários códigos. Revise antes de importar.`)
      result.set(cnae, concept)
    }
  }
  return result
}

export async function importSegmentPackage(
  apiFetch: ProductApiFetch, initial: ReleaseView, justification: string,
  data: SegmentPackage, onProgress: (message: string) => void,
) {
  // Use a fresh view, not the tab's cached values. Never publish or enable classification.
  const state = await fetchCurationState(apiFetch)
  if (state.draft?.id !== initial.release.id) fail('O rascunho mudou. Atualize a página antes de importar.')
  let view = await fetchReleaseView(apiFetch, initial.release.id)
  if (view.release.status !== 'DRAFT') fail('A importação só pode editar um rascunho.')
  const dimension = view.dimensions.find(row => row.code === 'sector') ?? fail('Tabela Segmento ausente.')
  if (dimension.officialCodeType !== 'CNAE') fail('A tabela Segmento precisa usar CNAE.')
  const byCnae = exactCnaes(view)
  const codes = new Map<string, string>()
  let created = 0, updated = 0
  for (const [index, segment] of data.segments.entries()) {
    onProgress(`Preparando segmentos: ${index + 1}/${data.segments.length}`)
    const code = `sector.trifaros_${segment.id.toLowerCase().replace(/-/g, '_')}`
    const existing = view.concepts.find(row => row.code === code)
    if (existing && (existing.label !== segment.name || existing.membershipStatus !== 'INCLUDED')) fail(`Segmento ${segment.id} já existe com dados diferentes.`)
    if (!existing) await createConcept(apiFetch, 'sector', justification, {
      code, label: segment.name, definition: segment.definition, profileVisible: true,
      classifyByLabel: false, officialCodes: [], aliases: [],
      helpText: `Segmento padronizado da planilha ${data.sourceWorkbook}.`,
    })
    codes.set(segment.id, code)
  }
  if (!dimension.usesGroups) await patchDimension(apiFetch, 'sector', justification, { usesGroups: true })
  for (const [index, sub] of data.subsegments.entries()) {
    onProgress(`Preparando subsegmentos: ${index + 1}/${data.subsegments.length}`)
    const existing = view.groups.find(row => row.dimensionCode === 'sector' && normalize(row.label) === normalize(sub.name))
    const segmentCodes = [codes.get(sub.segmentId)!]
    if (!existing) await createGroup(apiFetch, 'sector', justification, { label: sub.name, segmentCodes, displayOrder: index + 1 })
    else if (JSON.stringify(existing.segmentCodes) !== JSON.stringify(segmentCodes)) {
      if (existing.segmentCodes.length) fail(`Subsegmento ${sub.name} já possui outro segmento.`)
      await patchGroup(apiFetch, existing.id, justification, { segmentCodes })
    }
  }
  const subNames = new Map(data.subsegments.map(sub => [sub.id, sub.name]))
  for (let start = 0; start < data.rows.length; start += 40) {
    const current = await fetchCurationState(apiFetch)
    if (current.draft?.id !== initial.release.id) fail('O rascunho mudou durante a importação. Os lotes anteriores foram preservados.')
    const source = data.rows.slice(start, start + 40)
    const rows: GridRowInput[] = source.map(row => {
      const existing = byCnae.get(row.cnae)
      return {
        code: existing?.code ?? null, group: subNames.get(row.subsegmentId)!, label: row.description,
        officialCodes: [row.cnae], aliases: row.synonyms.map(text => ({ text, aliasType: 'EXACT_LEXICAL' })),
        profileVisible: existing?.profileVisible ?? true, classifyByLabel: true, displayOrder: start + source.indexOf(row) + 1,
      }
    })
    onProgress(`Importando CNAEs: ${Math.min(start + 40, data.rows.length)}/${data.rows.length}`)
    const result = await saveDimensionRows(apiFetch, 'sector', justification, { rows, retire: [] })
    created += result.created.length
    updated += result.updated
  }
  onProgress('Conferindo os dados gravados…')
  view = await fetchReleaseView(apiFetch, initial.release.id)
  const final = exactCnaes(view)
  for (const row of data.rows) {
    const concept = final.get(row.cnae)
    const group = view.groups.find(group => group.id === concept?.groupId)
    const aliases = new Set(concept?.aliases.map(alias => normalize(alias.text)))
    if (!concept || concept.label !== row.description || group?.label !== subNames.get(row.subsegmentId) ||
      !group?.segmentCodes.includes(codes.get(row.segmentId)!) || row.synonyms.some(term => !aliases.has(normalize(term)))) {
      fail(`A conferência falhou no CNAE ${row.cnae}. Reimporte o mesmo arquivo para retomar sem duplicar.`)
    }
  }
  return { created, updated, cnaes: data.rows.length, segments: data.segments.length, subsegments: data.subsegments.length, synonyms: data.rows.reduce((sum, row) => sum + row.synonyms.length, 0) }
}
