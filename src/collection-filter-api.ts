import type { ProductApiFetch } from './product-api'

export type CollectionFilterMode =
  | 'KEEP_ALWAYS'
  | 'KEEP_IF_TAX_TERM'
  | 'EXCLUDE_UNLESS_STRONG'
  | 'EXCLUDE_ALWAYS'

export type CollectionFilterStrength =
  | 'STRONG'
  | 'WEAK'
  | 'NEGATIVE'

export interface CollectionFilterRule {
  sourceCode: string
  section: string
  canonicalType: string
  mode: CollectionFilterMode
  helpText: string | null
}

export interface CollectionFilterAlias {
  sourceCode: string
  section: string
  alias: string
  canonicalType: string
}

export interface CollectionFilterTerm {
  text: string
  normalizedTerm?: string
  strength: CollectionFilterStrength
  sourceCode?: string | null
  section?: string | null
  canonicalType?: string | null
  locationScope?: 'ANY' | 'TITLE' | 'SUMMARY' | 'BODY'
}

export interface CollectionFilterDocument {
  id: string
  version: number
  revision: number
  status: 'APPROVED'
  contextWindowWords: number
  weakScoreThreshold: number
  locationWeights: {
    title: number
    summary: number
    body: number
  }
  changeNotes: string | null
  rules: CollectionFilterRule[]
  aliases: CollectionFilterAlias[]
  terms: CollectionFilterTerm[]
}

export interface CollectionFilterState {
  policies: Array<{
    id: string
    version: number
    revision: number
    status: 'APPROVED'
  }>
  documents: Record<string, CollectionFilterDocument>
  newTypesOpen: number
}

export interface CollectionFilterNewType {
  id: string
  source_code: string
  section: string
  normalized_type: string
  sample_raw_type: string
  occurrence_count: number | string
  first_seen_at: string
  last_seen_at: string
  sample_publication_ids: string[]
  examples: Array<{
    id: string
    title: string
    publishedOn: string | null
    officialUrl: string | null
  }>
  status: 'OPEN' | 'RESOLVED' | 'MERGED'
  resolved_canonical_type?: string | null
  resolved_at: string | null
}

export class CollectionFilterApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly detail?: string,
  ) {
    super(code)
  }
}

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'collection_filter_request_failed'
    const detail =
      body &&
      typeof body === 'object' &&
      'detail' in body &&
      typeof body.detail === 'string'
        ? body.detail
        : undefined
    throw new CollectionFilterApiError(code, response.status, detail)
  }
  return body as T
}

export async function fetchCollectionFilterState(
  apiFetch: ProductApiFetch,
) {
  return readJson<CollectionFilterState>(
    await apiFetch('/api/v1/admin/collection-filter/state', {
      headers: { Accept: 'application/json' },
    }),
  )
}

export async function fetchCollectionFilterNewTypes(
  apiFetch: ProductApiFetch,
  status: 'OPEN' | 'RESOLVED' | 'MERGED' = 'OPEN',
) {
  return readJson<{ items: CollectionFilterNewType[] }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/new-types?status=${status}`,
      { headers: { Accept: 'application/json' } },
    ),
  )
}

export async function resolveCollectionFilterNewType(
  apiFetch: ProductApiFetch,
  id: string,
  status: 'RESOLVED' | 'MERGED',
  canonicalType: string,
) {
  return readJson<{ id: string; status: string }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/new-types/${id}/resolve`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, canonicalType }),
      },
    ),
  )
}


export interface CollectionFilterDiscard {
  id: string
  source_code: string
  connector_key: string
  section: string
  raw_type: string | null
  canonical_type: string | null
  title: string
  act_number: string | null
  published_on: string | null
  official_url: string | null
  reason_code: string
  decisive_term: string | null
  policy_version: number
  policy_revision: number
  discarded_at: string
  expires_at: string
}

export interface CollectionFilterDiscardAlert {
  id: string
  collection_run_id: string
  source_code: string
  discard_rate: number | string
  baseline_rate: number | string
  threshold_rate: number | string
  found_count: number
  discard_count: number
  status: 'OPEN' | 'ACKNOWLEDGED'
  created_at: string
  acknowledged_at: string | null
}

export async function fetchCollectionFilterDiscards(
  apiFetch: ProductApiFetch,
  options: { sourceCode?: string; limit: number; offset: number },
) {
  const params = new URLSearchParams({ limit: String(options.limit), offset: String(options.offset) })
  if (options.sourceCode?.trim()) params.set('sourceCode', options.sourceCode.trim().toLowerCase())
  return readJson<{ items: CollectionFilterDiscard[] }>(await apiFetch(
    `/api/v1/admin/collection-filter/discarded?${params}`,
    { headers: { Accept: 'application/json' } },
  ))
}

export async function fetchCollectionFilterDiscardAlerts(
  apiFetch: ProductApiFetch,
  status?: CollectionFilterDiscardAlert['status'],
) {
  const params = new URLSearchParams({ limit: '500' })
  if (status) params.set('status', status)
  return readJson<{ items: CollectionFilterDiscardAlert[] }>(await apiFetch(
    `/api/v1/admin/collection-filter/discard-alerts?${params}`,
    { headers: { Accept: 'application/json' } },
  ))
}


// L-11 direct rule editing; the server must re-evaluate the current archive
// at confirmation time. The front end never supplies publication IDs to delete.
export interface CollectionFilterDirectRuleInput {
  sourceCode: string
  section: string
  canonicalType: string
  mode: CollectionFilterMode
  newTypeId?: string
}

export interface CollectionFilterDirectPreview {
  count: number
  outOfScope?: number
  hiddenLegacy?: number
  blockedCompany: number
  blockedOtherSource: number
  token: string
}

export async function previewDirectCollectionFilterRule(
  apiFetch: ProductApiFetch,
  input: CollectionFilterDirectRuleInput,
): Promise<CollectionFilterDirectPreview> {
  return readJson<CollectionFilterDirectPreview>(
    await apiFetch('/api/v1/admin/collection-filter/direct-rule/preview', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

export interface CollectionFilterDirectConfirmResult {
  changed: boolean
  outOfScope?: number
  hiddenLegacy?: number
  apagadas: number
  restantes: number
  deletedCount: number
  revision?: number
  elapsedMs?: number
  count?: number
  blockedCompany?: number
  blockedOtherSource?: number
  token?: string
}

export async function applyDirectCollectionFilterRule(
  apiFetch: ProductApiFetch,
  input: CollectionFilterDirectRuleInput & {
    expectedCount: number
    previewToken: string
    resume?: boolean
  },
): Promise<CollectionFilterDirectConfirmResult> {
  return readJson<CollectionFilterDirectConfirmResult>(
    await apiFetch('/api/v1/admin/collection-filter/direct-rule/confirm', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
}

/** Strict non-destructive direct admin actions against the active policy. */
export type CollectionFilterAdminEditAction =
  | 'RULE_KEEP' | 'RULE_DELETE' | 'TERM_PUT' | 'TERM_DELETE'
  | 'ALIAS_PUT' | 'ALIAS_DELETE' | 'NEWTYPE_MERGE' | 'NEWTYPE_KEEP'

export async function editCollectionFilterActive(
  apiFetch: ProductApiFetch,
  action: CollectionFilterAdminEditAction,
  payload: Record<string, unknown>,
): Promise<{revision:number}> {
  return readJson<{revision:number}>(await apiFetch(
    '/api/v1/admin/collection-filter/direct-admin-edit', {
      method:'POST',
      headers:{Accept:'application/json','Content-Type':'application/json'},
      body:JSON.stringify({action,payload}),
    },
  ))
}


// L-15: only the backend can select DOU OUT_OF_SCOPE IDs. The UI receives
// summary counts and an opaque preview token, never caller-supplied IDs.
export async function previewOutOfScopePublications(apiFetch: ProductApiFetch):
  Promise<CollectionFilterDirectPreview> {
  return readJson<CollectionFilterDirectPreview>(await apiFetch(
    '/api/v1/admin/collection-filter/out-of-scope/preview', {
      method: 'POST', headers: { Accept: 'application/json' },
    },
  ))
}

export async function confirmOutOfScopePublications(
  apiFetch: ProductApiFetch, input: {expectedCount:number;previewToken:string},
): Promise<CollectionFilterDirectConfirmResult> {
  return readJson<CollectionFilterDirectConfirmResult>(await apiFetch(
    '/api/v1/admin/collection-filter/out-of-scope/confirm', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  ))
}
