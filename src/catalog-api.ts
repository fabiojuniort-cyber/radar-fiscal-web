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
}

export type CatalogFilters = {
  q?: string
  /** 'full' also searches the full text of each act; default is the title. */
  scope?: 'title' | 'full'
  uf?: string
  jurisdiction?: 'FEDERAL' | 'STATE'
  source?: string
  page?: number
  limit?: number
}

function requireJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`catalog_http_${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchCatalogArchive(
  apiFetch: ProductApiFetch,
  filters: CatalogFilters = {},
): Promise<CatalogArchiveResponse> {
  const params = new URLSearchParams()

  if (filters.q) params.set('q', filters.q)
  if (filters.q && filters.scope === 'full') params.set('scope', 'full')
  if (filters.uf) params.set('uf', filters.uf)
  if (filters.jurisdiction) params.set('jurisdiction', filters.jurisdiction)
  if (filters.source) params.set('source', filters.source)
  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 25))

  const response = await apiFetch(
    '/api/v2/archive?' + params.toString(),
    { headers: { Accept: 'application/json' } },
  )

  return requireJson<CatalogArchiveResponse>(response)
}

export async function fetchCatalogFacets(
  apiFetch: ProductApiFetch,
): Promise<CatalogFacets> {
  const response = await apiFetch('/api/v2/archive/facets', {
    headers: { Accept: 'application/json' },
  })

  return requireJson<CatalogFacets>(response)
}
