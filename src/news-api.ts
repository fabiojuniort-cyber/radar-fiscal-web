import type { ProductApiFetch } from './product-api'

export type NewsItem = {
  id: string
  sourceCode: string
  sourceName: string
  agency: string | null
  title: string
  summary: string | null
  category: string | null
  publishedAt: string | null
  updatedAt: string | null
  officialUrl: string
  imageUrl: string | null
  tags: string[]
}

export type NewsFeed = {
  items: NewsItem[]
  page: number
  limit: number
  totalItems: number
  totalPages: number
}

export type NewsQuery = {
  q?: string
  page?: number
  limit?: number
}

export async function fetchNews(
  apiFetch: ProductApiFetch,
  query: NewsQuery = {},
): Promise<NewsFeed> {
  const params = new URLSearchParams()

  if (query.q?.trim()) params.set('q', query.q.trim())
  if (query.page !== undefined) params.set('page', String(query.page))
  if (query.limit !== undefined) params.set('limit', String(query.limit))

  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  const response = await apiFetch(`/api/v1/news${suffix}`)

  if (!response.ok) {
    throw new Error('Não foi possível carregar as notícias.')
  }

  return response.json() as Promise<NewsFeed>
}
