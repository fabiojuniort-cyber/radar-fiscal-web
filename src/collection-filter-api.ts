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
  actName?: string
  sourceCode: string
  section: string
  canonicalType: string
  mode: CollectionFilterMode
  helpText: string | null
}

export interface CollectionFilterAlias {
  actName?: string
  targetActName?: string
  sourceCode: string
  section: string
  alias: string
  canonicalType: string
}

export interface CollectionFilterTerm {
  actName?: string | null
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

export interface InventoryStatus {status:'WARMING'|'REFRESHING'|'READY'|'FAILED';key:string|null}

export interface CollectionFilterState {
  inventory?: InventoryStatus
  actNames?: Array<{name:string;sourceCode:string;section:string;count:number}>
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
  act_name?: string
  queue_basis?: 'ARCHIVE_ACT_NAME'
  id: string
  source_code: string
  section: string
  normalized_type: string
  sample_raw_type: string
  occurrence_count: number | string
  first_seen_at: string | null
  last_seen_at: string | null
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
        : `collection_filter_request_failed_http_${response.status}`
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
  return readJson<{ items: CollectionFilterNewType[];inventory?:InventoryStatus }>(
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
  policy_id?: string
  policy_version: number
  policy_revision: number
  discarded_at: string
  expires_at: string
  discard_origin?: 'COLLECTION' | 'ARCHIVE'
  archive_publication_id?: string | null
  rule_mode?: string | null
  archive_policy_rule?: string | null
  collection_run_id?: string | null
}

export type CollectionDiscardSortBy =
  | 'discardedAt' | 'origin' | 'source' | 'section' | 'type'
  | 'title' | 'actNumber' | 'publishedOn' | 'ruleMode'
  | 'reasonCode' | 'decisiveTerm' | 'officialUrl'
export type CollectionDiscardFilterKey =
  | 'sourceCode' | 'origin' | 'section' | 'type' | 'title'
  | 'actNumber' | 'publishedOn' | 'ruleMode' | 'reasonCode'
  | 'decisiveTerm' | 'officialUrl' | 'discardedOn'
export type CollectionDiscardFilters = Partial<Record<CollectionDiscardFilterKey, string>>
export type CollectionDiscardQuery = CollectionDiscardFilters & {
  limit: number
  offset: number
  sortBy?: CollectionDiscardSortBy
  sortDir?: 'asc' | 'desc'
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
  options: CollectionDiscardQuery,
) {
  const params = new URLSearchParams()
  for(const [key,value] of Object.entries(options)){
    if(value !== undefined && String(value).trim() !== '')params.set(key,String(value))
  }
  return readJson<{items:CollectionFilterDiscard[];total:number}>(await apiFetch(
    `/api/v1/admin/collection-filter/discarded?${params}`,
    {headers:{Accept:'application/json'}},
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
  actName?: string
  queueBasis?: 'ARCHIVE_ACT_NAME'
  sourceCode: string
  section: string
  canonicalType: string
  mode: CollectionFilterMode
  newTypeId?: string
}

export interface CollectionFilterDirectPreview {
  actName?: string
  count: number
  outOfScope?: number
  hiddenLegacy?: number
  suspectDoe?: number
  ruleDiscards?: number
  byRule?: Array<{sourceCode?:string;section:string;canonicalType:string;mode:string;count:number;actName?:string}>
  blockedCompany: number
  blockedOtherSource: number
  token: string
  confirmationToken?: string
  policyRevision?: number
  samples?: Array<{
    id:string; title:string; sourceCode:string; section:string; actName?:string
    officialType?:string|null; canonicalType?:string; pattern?:string; protection?:string|null
  }>
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

// Classification is a safe policy write. No existing publication is deleted.
// Historical purges use a separate backend command and are NEVER part of save.
export async function saveDirectCollectionFilterRule(
  apiFetch: ProductApiFetch,
  input: CollectionFilterDirectRuleInput,
  preview: CollectionFilterDirectPreview,
): Promise<{revision:number;deletedCount:0;historicalPurgeRequired:true}> {
  return readJson<{revision:number;deletedCount:0;historicalPurgeRequired:true}>(await apiFetch('/api/v1/admin/collection-filter/direct-rule/save', {
    method:'POST',
    headers:{Accept:'application/json','Content-Type':'application/json'},
    body:JSON.stringify({...input,expectedCount:preview.count,
      previewToken:preview.token,confirmationToken:preview.confirmationToken,
      policyRevision:preview.policyRevision}),
  }))
}

export interface CollectionFilterDirectConfirmResult {
  ruleDiscards?: number
  byRule?: Array<{sourceCode?:string;section:string;canonicalType:string;mode:string;count:number;actName?:string}>
  changed: boolean
  outOfScope?: number
  hiddenLegacy?: number
  suspectDoe?: number
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


// L-18: backend exclusively selects DOU scope/rules, legacy-029 any source and DOE-SP type mismatch. The UI receives
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
