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

  it('sends the exact collected legal act type as an archive filter', async () => {
    const apiFetch = okFetch()

    await fetchCatalogArchive(apiFetch, {
      actType: 'Convênio ICMS',
      jurisdiction: 'FEDERAL',
      page: 2,
    })

    const url = new URL(String(apiFetch.mock.calls[0]?.[0]), 'http://x')
    expect(url.searchParams.get('actType')).toBe('Convênio ICMS')
    expect(url.searchParams.get('jurisdiction')).toBe('FEDERAL')
    expect(url.searchParams.get('page')).toBe('2')
  })

  it('sends exact and inclusive range publication dates', async () => {
    const apiFetch = okFetch()

    await fetchCatalogArchive(apiFetch, {
      publishedOn: '2026-10-01',
      page: 3,
    })
    await fetchCatalogArchive(apiFetch, {
      publishedFrom: '2023-06-01',
      publishedTo: '2026-06-30',
    })

    const exact = new URL(String(apiFetch.mock.calls[0]?.[0]), 'http://x')
    expect(exact.searchParams.get('publishedOn')).toBe('2026-10-01')
    expect(exact.searchParams.get('publishedFrom')).toBeNull()
    expect(exact.searchParams.get('publishedTo')).toBeNull()
    expect(exact.searchParams.get('page')).toBe('3')

    const range = new URL(String(apiFetch.mock.calls[1]?.[0]), 'http://x')
    expect(range.searchParams.get('publishedOn')).toBeNull()
    expect(range.searchParams.get('publishedFrom')).toBe('2023-06-01')
    expect(range.searchParams.get('publishedTo')).toBe('2026-06-30')
  })
})
