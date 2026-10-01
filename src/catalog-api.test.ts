import { describe, expect, it, vi } from 'vitest'

import { fetchCatalogArchive } from './catalog-api'
import type { ProductApiFetch } from './product-api'

function okFetch() {
  return vi.fn<ProductApiFetch>(async () =>
    new Response(
      JSON.stringify({ page: 1, limit: 25, totalItems: 0, totalPages: 1, hasMore: false, items: [] }),
      { status: 200 },
    ),
  )
}

describe('fetchCatalogArchive', () => {
  it('asks for full-text search only when there is a query', async () => {
    const apiFetch = okFetch()

    await fetchCatalogArchive(apiFetch, { q: 'convênio', scope: 'full' })
    await fetchCatalogArchive(apiFetch, { scope: 'full' })
    await fetchCatalogArchive(apiFetch, { q: 'lei', scope: 'title' })

    const urls = apiFetch.mock.calls.map(([path]) => new URL(String(path), 'http://x'))
    expect(urls[0]?.searchParams.get('scope')).toBe('full')
    expect(urls[0]?.searchParams.get('q')).toBe('convênio')
    expect(urls[1]?.searchParams.has('scope')).toBe(false)
    expect(urls[2]?.searchParams.has('scope')).toBe(false)
  })
})
