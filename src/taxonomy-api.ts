import type { ProductApiFetch } from './product-api'

/* ------------------------------------------------------------------ */
/* Shared types (TAX-11)                                               */
/* ------------------------------------------------------------------ */

export type OfficialCodeType =
  | 'NCM'
  | 'CNAE'
  | 'CFOP'
  | 'NBS'
  | 'LC116'
  | 'DOCUMENT_MODEL'
  | 'CCLASSTRIB'

export const OFFICIAL_CODE_TYPE_LABELS: Record<OfficialCodeType, string> = {
  NCM: 'NCM',
  CNAE: 'CNAE',
  CFOP: 'CFOP',
  NBS: 'NBS',
  LC116: 'Item LC 116',
  DOCUMENT_MODEL: 'Modelo',
  CCLASSTRIB: 'cClassTrib',
}

export type AliasType =
  | 'EXACT_LEXICAL'
  | 'ABBREVIATION'
  | 'HISTORICAL_LABEL'
  | 'SEARCH_RELATED'
  | 'AMBIGUOUS'

export const ALIAS_TYPE_LABELS: Record<AliasType, string> = {
  EXACT_LEXICAL: 'Equivalente exato',
  ABBREVIATION: 'Sigla',
  HISTORICAL_LABEL: 'Nome antigo',
  SEARCH_RELATED: 'Só para busca',
  AMBIGUOUS: 'Ambíguo',
}

export type ReleaseSummary = {
  id: string
  version: string
  status: string
  createdAt: string
  publishedAt: string | null
  previousReleaseId: string | null
  changeNotes: string | null
}

export type CurationDimension = {
  id: string
  code: string
  name: string
  description: string | null
  revisionNo: number
  configured: boolean
  profileVisible: boolean
  profileOrder: number
  helpText: string | null
  detailSection: string | null
  detailOrder: number
  usesGroups: boolean
  officialCodeType: OfficialCodeType | null
  conceptCount: number
}

export type CurationGroup = {
  id: string
  dimensionCode: string
  code: string
  label: string
  displayOrder: number
  helpText: string | null
  detailSection: string | null
  officialCodes: string[]
  segmentCodes: string[]
}

export type CurationConcept = {
  releaseConceptId: string
  code: string
  dimensionCode: string
  label: string
  definition: string
  positiveExample: string | null
  negativeExample: string | null
  governanceStatus: string
  evidenceStatus: string
  notes: string | null
  releaseNotes: string | null
  membershipStatus: 'INCLUDED' | 'RETIRED' | string
  groupId: string | null
  groupCode: string | null
  profileVisible: boolean
  displayOrder: number | null
  helpText: string | null
  classifyByLabel: boolean
  officialCodes: string[]
  aliases: Array<{ text: string; aliasType: AliasType }>
}

export type ReleaseView = {
  release: ReleaseSummary
  dimensions: CurationDimension[]
  groups: CurationGroup[]
  concepts: CurationConcept[]
}

export type CatalogStatus = {
  code: 'NCM' | 'CNAE' | 'CCLASSTRIB'
  name: string | null
  loaded: boolean
  editionCode: string | null
  validFrom: string | null
  loadedAt: string | null
  entries: number
  source: 'AUTOMATIC' | 'UPLOAD'
}

export type CurationState = {
  published: ReleaseSummary | null
  draft: ReleaseSummary | null
  settings: {
    classificationEnabled: boolean
    classificationExcludedSources: string[]
    updatedAt: Record<string, string>
    updatedBy: Record<string, string>
  }
  engine: { key: string; version: string }
  progress: {
    total: number
    classified: number
    pending: number
    withoutTags: number
    failed: number
    excluded: number
  } | null
  catalogs: CatalogStatus[]
  curatorDatabase: boolean
}

export type ValidationIssue = {
  severity: 'BLOCKER' | 'WARNING'
  code: string
  message: string
  subject?: string
}

export type DraftReview = {
  draft: ReleaseSummary
  diff: {
    sourceVersion: string | null
    targetVersion: string
    addedConcepts: string[]
    removedConcepts: string[]
    changedConcepts: Array<{ code: string; fields: string[] }>
    changedDimensions: Array<{ code: string; fields: string[] }>
    addedGroups: string[]
    removedGroups: string[]
    changedGroups: Array<{ key: string; fields: string[] }>
  }
  issues: ValidationIssue[]
}

export type CatalogCheck = {
  catalog: string
  sourceSha256: string
  entries: number
  diff: {
    currentEditionCode: string | null
    upToDate: boolean
    added: number
    removed: number
    descriptionChanged: number
    samples: { added: string[]; removed: string[]; descriptionChanged: string[] }
  }
}

export type PublicationTag = {
  kind: 'CONCEPT' | 'GROUP'
  conceptCode: string | null
  groupCode: string | null
  label: string
  dimensionCode: string
  groupLabel: string | null
  origin: 'AUTOMATIC' | 'CURATOR'
  assertionId: string | null
  removed: boolean
  reason: {
    type: 'TEXT' | 'SYNONYM' | 'NCM' | 'CCLASSTRIB' | 'CURATOR'
    term: string | null
    excerpt: string | null
  }
}

export type PublicationTaxonomy = {
  publicationId: string
  publicationVersionId: string | null
  release: ReleaseSummary | null
  status: 'CLASSIFIED' | 'PENDING' | 'FAILED' | 'DISABLED' | 'EXCLUDED' | 'NO_RELEASE' | 'NOT_FOUND'
  classifiedAt: string | null
  sections: Array<{ name: string; order: number; tags: PublicationTag[] }>
}

export type SegmentSuggestion = {
  conceptCode: string
  label: string
  strength: 'PRIMARY' | 'SECONDARY'
  cnaeCodes: string[]
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export class TaxonomyApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly detail?: string,
  ) {
    super(detail || code)
    this.name = 'TaxonomyApiError'
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let code = `http_${response.status}`
    let detail: string | undefined
    try {
      const body = (await response.json()) as { error?: string; message?: string }
      if (body.error) code = body.error
      if (body.message) detail = body.message
    } catch {
      // keep the HTTP status code
    }
    throw new TaxonomyApiError(code, response.status, detail)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

const ADMIN = '/api/v1/admin/taxonomy'

/* ------------------------------------------------------------------ */
/* Curator API                                                          */
/* ------------------------------------------------------------------ */

export async function fetchAdminMe(apiFetch: ProductApiFetch) {
  const response = await apiFetch('/api/v1/admin/me', { headers: { Accept: 'application/json' } })
  return readJson<{ taxonomyCurator: boolean; curatorDatabase: boolean }>(response)
}

export async function fetchCurationState(apiFetch: ProductApiFetch) {
  return readJson<CurationState>(await apiFetch(`${ADMIN}/state`, { headers: { Accept: 'application/json' } }))
}

export async function fetchReleaseView(apiFetch: ProductApiFetch, releaseId: string) {
  return readJson<ReleaseView>(
    await apiFetch(`${ADMIN}/releases/${releaseId}`, { headers: { Accept: 'application/json' } }),
  )
}

export async function fetchDraftReview(apiFetch: ProductApiFetch) {
  return readJson<DraftReview>(
    await apiFetch(`${ADMIN}/drafts/current/review`, { headers: { Accept: 'application/json' } }),
  )
}

export async function createCurationDraft(apiFetch: ProductApiFetch, justification: string) {
  return readJson<{ draft: ReleaseSummary; initialCuration: Record<string, number> | null }>(
    await apiFetch(`${ADMIN}/drafts`, jsonInit('POST', { justification })),
  )
}

export type DimensionPatch = Partial<{
  name: string
  description: string | null
  profileVisible: boolean
  profileOrder: number
  helpText: string | null
  detailSection: string | null
  detailOrder: number
  usesGroups: boolean
  officialCodeType: OfficialCodeType | null
}>

export async function patchDimension(
  apiFetch: ProductApiFetch,
  code: string,
  justification: string,
  patch: DimensionPatch,
) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/drafts/current/dimensions/${code}`, jsonInit('PATCH', { justification, ...patch })),
  )
}

export type GroupInput = Partial<{
  label: string
  displayOrder: number
  helpText: string | null
  detailSection: string | null
  officialCodes: string[]
  segmentCodes: string[]
}>

export async function createGroup(
  apiFetch: ProductApiFetch,
  dimensionCode: string,
  justification: string,
  input: GroupInput,
) {
  return readJson<{ id: string }>(
    await apiFetch(
      `${ADMIN}/drafts/current/dimensions/${dimensionCode}/groups`,
      jsonInit('POST', { justification, ...input }),
    ),
  )
}

export async function patchGroup(
  apiFetch: ProductApiFetch,
  groupId: string,
  justification: string,
  input: GroupInput,
) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/drafts/current/groups/${groupId}`, jsonInit('PATCH', { justification, ...input })),
  )
}

export async function deleteGroup(apiFetch: ProductApiFetch, groupId: string, justification: string) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/drafts/current/groups/${groupId}/delete`, jsonInit('POST', { justification })),
  )
}

export type ConceptInput = Partial<{
  label: string
  definition: string
  positiveExample: string | null
  negativeExample: string | null
  governanceStatus: string
  evidenceStatus: string
  notes: string | null
  groupId: string | null
  profileVisible: boolean
  displayOrder: number | null
  helpText: string | null
  classifyByLabel: boolean
  officialCodes: string[]
  aliases: Array<{ text: string; aliasType: AliasType }>
  membershipStatus: 'INCLUDED' | 'RETIRED'
}>

export async function createConcept(
  apiFetch: ProductApiFetch,
  dimensionCode: string,
  justification: string,
  input: ConceptInput,
) {
  return readJson<{ code: string }>(
    await apiFetch(
      `${ADMIN}/drafts/current/dimensions/${dimensionCode}/concepts`,
      jsonInit('POST', { justification, ...input }),
    ),
  )
}

export async function patchConcept(
  apiFetch: ProductApiFetch,
  code: string,
  justification: string,
  input: ConceptInput,
) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/drafts/current/concepts/${code}`, jsonInit('PATCH', { justification, ...input })),
  )
}

export async function importDimensionCsv(
  apiFetch: ProductApiFetch,
  dimensionCode: string,
  justification: string,
  csv: string,
) {
  return readJson<{
    rows: number
    created: number
    updated: number
    groupsCreated: number
    errors: Array<{ line: number; message: string }>
  }>(
    await apiFetch(
      `${ADMIN}/drafts/current/dimensions/${dimensionCode}/import`,
      jsonInit('POST', { justification, csv }),
    ),
  )
}

export async function downloadDimensionCsv(
  apiFetch: ProductApiFetch,
  releaseId: string,
  dimensionCode: string,
): Promise<Blob> {
  const response = await apiFetch(
    `${ADMIN}/releases/${releaseId}/dimensions/${dimensionCode}/export.csv`,
    { headers: { Accept: 'text/csv' } },
  )
  if (!response.ok) throw new TaxonomyApiError(`http_${response.status}`, response.status)
  return response.blob()
}

export async function publishDraft(apiFetch: ProductApiFetch, justification: string, changeNotes: string) {
  return readJson<{ release: ReleaseSummary; snapshotSha256: string }>(
    await apiFetch(`${ADMIN}/drafts/current/publish`, jsonInit('POST', { justification, changeNotes })),
  )
}

export async function setClassificationEnabled(
  apiFetch: ProductApiFetch,
  enabled: boolean,
  justification: string,
) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/settings/classification`, jsonInit('PUT', { justification, enabled })),
  )
}

export async function setExcludedSources(
  apiFetch: ProductApiFetch,
  sources: string[],
  justification: string,
) {
  await readJson<void>(
    await apiFetch(`${ADMIN}/settings/excluded-sources`, jsonInit('PUT', { justification, sources })),
  )
}

export async function searchCatalog(
  apiFetch: ProductApiFetch,
  catalog: 'NCM' | 'CNAE' | 'CCLASSTRIB',
  q: string,
) {
  const params = new URLSearchParams({ catalog, q })
  return readJson<{ items: Array<{ code: string; normalized: string; description: string }> }>(
    await apiFetch(`${ADMIN}/catalogs/search?${params.toString()}`, { headers: { Accept: 'application/json' } }),
  )
}

export async function checkCatalog(
  apiFetch: ProductApiFetch,
  catalog: 'NCM' | 'CNAE' | 'CCLASSTRIB',
  csv?: string,
) {
  return readJson<CatalogCheck>(
    await apiFetch(`${ADMIN}/catalogs/${catalog}/check`, jsonInit('POST', csv ? { csv } : {})),
  )
}

export async function importCatalog(
  apiFetch: ProductApiFetch,
  catalog: 'NCM' | 'CNAE' | 'CCLASSTRIB',
  input: { justification: string; expectedSha256: string; csv?: string; validFrom?: string },
) {
  return readJson<{ editionCode: string; created: boolean; entriesInserted: number }>(
    await apiFetch(`${ADMIN}/catalogs/${catalog}/import`, jsonInit('POST', input)),
  )
}

export async function curatePublicationTag(
  apiFetch: ProductApiFetch,
  publicationId: string,
  input: { conceptCode: string; action: 'ADD' | 'REMOVE' | 'RESTORE'; justification: string },
) {
  return readJson<PublicationTaxonomy>(
    await apiFetch(`${ADMIN}/publications/${publicationId}/tags`, jsonInit('POST', input)),
  )
}

export async function fetchCuratorPublicationTags(apiFetch: ProductApiFetch, publicationId: string) {
  return readJson<PublicationTaxonomy>(
    await apiFetch(`${ADMIN}/publications/${publicationId}/tags`, { headers: { Accept: 'application/json' } }),
  )
}

/* ------------------------------------------------------------------ */
/* Customer API                                                         */
/* ------------------------------------------------------------------ */

export async function fetchPublicationTaxonomy(apiFetch: ProductApiFetch, publicationId: string) {
  return readJson<PublicationTaxonomy>(
    await apiFetch(`/api/v1/publications/${publicationId}/taxonomy`, { headers: { Accept: 'application/json' } }),
  )
}

export async function fetchTaxonomySuggestions(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
) {
  const response = await apiFetch(`/api/v1/companies/${companyId}/taxonomy-suggestions`, {
    headers: { Accept: 'application/json', 'X-Tenant-Id': tenantId },
  })
  return readJson<{ segments: SegmentSuggestion[] }>(response)
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

export function formatOfficialCode(type: OfficialCodeType | null, code: string): string {
  if (type === 'NCM') {
    if (code.length <= 4) return code
    if (code.length === 6) return `${code.slice(0, 4)}.${code.slice(4)}`
    return `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}`
  }
  if (type === 'CNAE') {
    if (code.length <= 2) return code
    if (code.length <= 4) return `${code.slice(0, 2)}.${code.slice(2)}`
    if (code.length === 5) return `${code.slice(0, 2)}.${code.slice(2, 4)}-${code.slice(4)}`
    return `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5)}`
  }
  return code
}

/**
 * "Acervo filtrado por esta tag": handed to the panel through its session
 * state. Other Acervo filters (text, sphere, UF, source, act type, dates)
 * are cleared so the result reflects the tag alone.
 */
export function setArchiveTagState(tag: { code: string; label: string }) {
  try {
    const raw = sessionStorage.getItem('tribusca.panel.state')
    const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({
        ...current,
        screen: 'acervo',
        query: '',
        appliedQuery: '',
        fullText: false,
        jurisdiction: '',
        uf: '',
        source: '',
        actType: '',
        archivePage: 1,
        archiveTag: tag,
      }),
    )
    sessionStorage.removeItem('tribusca.archive.date')
  } catch {
    // Storage blocked: the panel simply opens without the filter.
  }
}

/**
 * Reads a CSV picked by the curator. Excel in pt-BR saves "CSV" as
 * Windows-1252; fall back to it when the bytes are not valid UTF-8.
 */
export async function readCsvFile(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
