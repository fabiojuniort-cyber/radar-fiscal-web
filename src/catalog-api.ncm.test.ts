import { describe, expect, it, vi } from 'vitest'

import { fetchCatalogArchive } from './catalog-api'
import type { ProductApiFetch } from './product-api'

describe('catalog NCM filter', () => {
  it('routes an NCM-shaped query through the indexed ncm filter', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://tribusca.test')

      expect(url.pathname).toBe('/api/v2/archive')
      expect(url.searchParams.get('ncm')).toBe('10063011')
      expect(url.searchParams.has('q')).toBe(false)
      expect(url.searchParams.has('scope')).toBe(false)

      return new Response(JSON.stringify({
        page: 1,
        limit: 25,
        totalItems: 1,
        totalPages: 1,
        totalIsCapped: false,
        hasMore: false,
        items: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as ProductApiFetch

    await fetchCatalogArchive(apiFetch, {
      q: '1006.30.11',
      scope: 'full',
      page: 1,
      limit: 25,
    })

    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps normal full-text searches unchanged', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'https://tribusca.test')

      expect(url.searchParams.get('q')).toBe('Convênio')
      expect(url.searchParams.get('scope')).toBe('full')
      expect(url.searchParams.has('ncm')).toBe(false)

      return new Response(JSON.stringify({
        page: 1,
        limit: 25,
        totalItems: 0,
        totalPages: 1,
        totalIsCapped: false,
        hasMore: false,
        items: [],
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as ProductApiFetch

    await fetchCatalogArchive(apiFetch, {
      q: 'Convênio',
      scope: 'full',
    })

    expect(apiFetch).toHaveBeenCalledTimes(1)
  })
})
