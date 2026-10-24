import type { ProductApiFetch, ProductArchiveItem } from './product-api'

export type CatalogArchiveResponse = {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  /** True when there are more than totalItems matches (count is capped). */
  totalIsCapped?: boolean
  hasMore: boolean
  items: ProductArchiveItem[]
}

export type CatalogFacets = {
  ufs: string[]
  sources: Array<{
    code: string
    name: string
  }>
  actTypes: string[]
}

export type CatalogNavigationGroup =
  | 'jurisdiction'
  | 'uf'
  | 'source'
  | 'actType'
  | 'year'
  | 'month'

export type CatalogNavigationFilters = {
  groupBy: CatalogNavigationGroup
  jurisdiction?: 'FEDERAL' | 'STATE'
  uf?: string
  source?: string
  actType?: string
  year?: number
  month?: number
}

export type CatalogNavigationResponse = {
  groupBy: CatalogNavigationGroup
  items: Array<{
    value: string
    label: string
    count: number
  }>
}

export type CatalogFilters = {
  q?: string
  /** 'full' also searches the full text of each act; default is the title. */
  scope?: 'title' | 'full'
  uf?: string
  jurisdiction?: 'FEDERAL' | 'STATE'
  source?: string
  actType?: string
  /** Exact official publication date (YYYY-MM-DD). */
  publishedOn?: string
  /** Inclusive initial official publication date (YYYY-MM-DD). */
  publishedFrom?: string
  /** Inclusive final official publication date (YYYY-MM-DD). */
  publishedTo?: string
  ncm?: string
  /** TAX-11: taxonomy concept code (tag) of the latest published release. */
  tag?: string
  page?: number
  limit?: number
}

type StoredArchiveDate = {
  mode?: 'single' | 'range'
  singleDate?: string
  from?: string
  to?: string
}

function requireJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`catalog_http_${response.status}`)
  }
  return response.json() as Promise<T>
}

function normalizeNcm(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!/^[\d.\s-]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  return digits.length === 8 ? digits : null
}

function activeAcervoDateFilters(filters: CatalogFilters): Partial<CatalogFilters> {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    filters.publishedOn ||
    filters.publishedFrom ||
    filters.publishedTo ||
    filters.limit !== 25 ||
    !document.querySelector('.tp-main-acervo')
  ) {
    return {}
  }

  try {
    const raw = sessionStorage.getItem('tribusca.archive.date')
    if (!raw) return {}
    const stored = JSON.parse(raw) as StoredArchiveDate

    if (stored.mode === 'range') {
      return {
        ...(stored.from ? { publishedFrom: stored.from } : {}),
        ...(stored.to ? { publishedTo: stored.to } : {}),
      }
    }

    return stored.singleDate
      ? { publishedOn: stored.singleDate }
      : {}
  } catch {
    return {}
  }
}

function catalogSearchParams(filters: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams()
  const effectiveFilters = {
    ...filters,
    ...activeAcervoDateFilters(filters),
  }

  const explicitNcm = normalizeNcm(effectiveFilters.ncm)
  const queryNcm = normalizeNcm(effectiveFilters.q)
  const ncm = explicitNcm ?? queryNcm

  if (effectiveFilters.q && !queryNcm) params.set('q', effectiveFilters.q)
  if (effectiveFilters.q && !queryNcm && effectiveFilters.scope === 'full') params.set('scope', 'full')
  if (effectiveFilters.uf) params.set('uf', effectiveFilters.uf)
  if (effectiveFilters.jurisdiction) params.set('jurisdiction', effectiveFilters.jurisdiction)
  if (effectiveFilters.source) params.set('source', effectiveFilters.source)
  if (effectiveFilters.actType) params.set('actType', effectiveFilters.actType)
  if (effectiveFilters.publishedOn) params.set('publishedOn', effectiveFilters.publishedOn)
  if (effectiveFilters.publishedFrom) params.set('publishedFrom', effectiveFilters.publishedFrom)
  if (effectiveFilters.publishedTo) params.set('publishedTo', effectiveFilters.publishedTo)
  if (ncm) params.set('ncm', ncm)
  if (effectiveFilters.tag) params.set('tag', effectiveFilters.tag)
  params.set('page', String(effectiveFilters.page ?? 1))
  params.set('limit', String(effectiveFilters.limit ?? 25))

  return params
}

export async function fetchCatalogArchive(
  apiFetch: ProductApiFetch,
  filters: CatalogFilters = {},
): Promise<CatalogArchiveResponse> {
  const response = await apiFetch(
    '/api/v2/archive?' + catalogSearchParams(filters).toString(),
    { headers: { Accept: 'application/json' } },
  )

  return requireJson<CatalogArchiveResponse>(response)
}

/** Dropdown vocabularies remain complete while the archive results are filtered.
 * Never pass active search/actType/UF/source filters to this lookup: users must
 * be able to switch between legal bases without first clearing the search.
 */
export async function fetchCatalogFacetOptions(
  apiFetch: ProductApiFetch,
): Promise<CatalogFacets> {
  return fetchCatalogFacets(apiFetch)
}

export async function fetchCatalogFacets(
  apiFetch: ProductApiFetch,
  filters: CatalogFilters = {},
): Promise<CatalogFacets> {
  const response = await apiFetch('/api/v2/archive/facets?' + catalogSearchParams(filters).toString(), {
    headers: { Accept: 'application/json' },
  })

  return requireJson<CatalogFacets>(response)
}

export async function fetchCatalogNavigation(
  apiFetch: ProductApiFetch,
  filters: CatalogNavigationFilters,
): Promise<CatalogNavigationResponse> {
  const params = new URLSearchParams()
  params.set('groupBy', filters.groupBy)
  if (filters.jurisdiction) params.set('jurisdiction', filters.jurisdiction)
  if (filters.uf) params.set('uf', filters.uf)
  if (filters.source) params.set('source', filters.source)
  if (filters.actType) params.set('actType', filters.actType)
  if (filters.year) params.set('year', String(filters.year))
  if (filters.month) params.set('month', String(filters.month))

  const response = await apiFetch(
    '/api/v2/archive/navigation?' + params.toString(),
    { headers: { Accept: 'application/json' } },
  )

  return requireJson<CatalogNavigationResponse>(response)
}
