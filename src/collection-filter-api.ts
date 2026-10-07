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
  status: 'DRAFT' | 'APPROVED'
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

export interface CollectionFilterSimulation {
  id: string
  policy_id: string
  policy_revision: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  scope: 'FULL_ARCHIVE' | 'RECENT'
  review_mode: 'ALL' | 'SAMPLE' | 'NONE'
  metrics: Record<string, unknown>
  error_code: string | null
  created_at: string
  completed_at: string | null
}

export interface CollectionFilterState {
  policies: Array<{
    id: string
    version: number
    revision: number
    status: 'DRAFT' | 'APPROVED'
  }>
  documents: Record<string, CollectionFilterDocument>
  simulations: CollectionFilterSimulation[]
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

export async function saveCollectionFilterDraft(
  apiFetch: ProductApiFetch,
  document: Omit<
    CollectionFilterDocument,
    'id' | 'version' | 'revision' | 'status'
  >,
) {
  return readJson<{
    policyId: string
    version: number
    revision: number
  }>(
    await apiFetch('/api/v1/admin/collection-filter/draft', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    }),
  )
}

export async function requestCollectionFilterSimulation(
  apiFetch: ProductApiFetch,
  input: {
    policyId: string
    scope: 'FULL_ARCHIVE' | 'RECENT'
    reviewMode: 'ALL' | 'SAMPLE' | 'NONE'
  },
) {
  return readJson<{
    simulationId: string
    policyRevision: number
    action: 'CREATED' | 'EXISTING'
  }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/drafts/${input.policyId}/simulations`,
      {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: input.scope,
        reviewMode: input.reviewMode,
      }),
    }),
  )
}

export async function approveCollectionFilterDraft(
  apiFetch: ProductApiFetch,
  policyId: string,
) {
  return readJson<{
    policyId: string
    version: number
    revision: number
    simulationId: string
  }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/drafts/${policyId}/approve`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      },
    ),
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


export interface CollectionFilterSimulationItem {
  simulation_id: string
  publication_id: string
  source_code: string
  section: string
  raw_type: string | null
  canonical_type: string | null
  decision: 'KEEP' | 'DISCARD'
  reason_code: string
  decisive_term: string | null
  excerpt: string | null
  title: string
  published_on: string | null
  official_url: string | null
  review_sample: boolean
  marked_error: boolean | null
  expected_decision: 'KEEP' | 'DISCARD' | null
  note: string | null
}

export async function fetchCollectionFilterSimulationItems(
  apiFetch: ProductApiFetch,
  simulationId: string,
  options: {
    decision?: 'KEEP' | 'DISCARD'
    sampleOnly?: boolean
    limit?: number
    offset?: number
  } = {},
) {
  const params = new URLSearchParams()
  if (options.decision) params.set('decision', options.decision)
  params.set('sampleOnly', String(options.sampleOnly ?? false))
  params.set('limit', String(options.limit ?? 100))
  params.set('offset', String(options.offset ?? 0))
  return readJson<{ items: CollectionFilterSimulationItem[] }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/simulations/${simulationId}/items?${params.toString()}`,
      { headers: { Accept: 'application/json' } },
    ),
  )
}

export async function saveCollectionFilterSimulationFeedback(
  apiFetch: ProductApiFetch,
  input: {
    simulationId: string
    publicationId: string
    markedError: boolean
    expectedDecision?: 'KEEP' | 'DISCARD' | null
    note?: string | null
  },
) {
  return readJson<{
    simulation_id: string
    publication_id: string
    marked_error: boolean
    expected_decision: 'KEEP' | 'DISCARD' | null
    note: string | null
  }>(
    await apiFetch(
      `/api/v1/admin/collection-filter/simulations/${input.simulationId}/items/${input.publicationId}/feedback`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markedError: input.markedError,
          expectedDecision: input.expectedDecision ?? null,
          note: input.note ?? null,
        }),
      },
    ),
  )
}
