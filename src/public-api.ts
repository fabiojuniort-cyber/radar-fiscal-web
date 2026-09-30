export type PublicSourceStatus =
  | 'ONLINE'
  | 'UNSTABLE'
  | 'UNAVAILABLE'
  | 'NOT_CONSULTED'

export type PublicSource = {
  code: string
  name: string
  jurisdictionLevel: 'FEDERAL' | 'STATE' | string
  uf: string | null
  isActive: boolean
  status: PublicSourceStatus
  lastRunStatus: string | null
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  importedToday: number
  totalPublications: number
}

export type PublicSourcesResponse = {
  generatedAt: string
  items: PublicSource[]
}

export type CoveragePresentation = {
  status: 'Online' | 'Em validação' | 'Em implantação' | '—'
  lastSuccessAt: string
  importedToday: string
  totalPublications: string
}

export const FEDERAL_SOURCE_CODES = {
  'DOU / INLABS': 'dou',
  CONFAZ: 'confaz',
  'NF-e / ENCAT': 'nfe-encat',
  SPED: 'sped',
  CGIBS: 'cgibs',
  'Receita Federal': 'rfb-normas',
} as const

export function publicApiBase(): string {
  return (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
}

export function publicApiUrl(path: string, apiBase = publicApiBase()): string {
  return `${apiBase}${path}`
}

export async function fetchPublicSources(
  apiBase = publicApiBase(),
  signal?: AbortSignal,
): Promise<PublicSourcesResponse> {
  const response = await fetch(publicApiUrl('/public/v1/sources', apiBase), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`public_sources_http_${response.status}`)
  }

  const payload = await response.json()
  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('public_sources_invalid_payload')
  }

  return payload as PublicSourcesResponse
}

export function translatePublicStatus(status: PublicSourceStatus): CoveragePresentation['status'] {
  switch (status) {
    case 'ONLINE':
      return 'Online'
    case 'UNSTABLE':
    case 'UNAVAILABLE':
      return 'Em validação'
    case 'NOT_CONSULTED':
      return 'Em implantação'
  }
}

export function findFederalSource(
  items: PublicSource[],
  code: string,
): PublicSource | undefined {
  return items.find((source) => source.code === code)
}

export function findStateSource(
  items: PublicSource[],
  uf: string,
): PublicSource | undefined {
  const normalizedUf = uf.toUpperCase()
  const preferredCode = `doe-${normalizedUf.toLowerCase()}`

  const stateSources = items.filter(
    (source) => source.jurisdictionLevel === 'STATE',
  )

  return (
    stateSources.find(
      (source) => source.uf?.toUpperCase() === normalizedUf,
    ) ??
    stateSources.find((source) => source.code === preferredCode)
  )
}

export function formatLastSuccessAt(value: string | null): string {
  if (!value) return '—'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(parsed)
}

export function toCoveragePresentation(
  source: PublicSource | undefined,
  dataAvailable: boolean,
): CoveragePresentation {
  if (!dataAvailable) {
    return {
      status: '—',
      lastSuccessAt: '—',
      importedToday: '—',
      totalPublications: '—',
    }
  }

  if (!source) {
    return {
      status: 'Em implantação',
      lastSuccessAt: '—',
      importedToday: '—',
      totalPublications: '—',
    }
  }

  return {
    status: translatePublicStatus(source.status),
    lastSuccessAt: formatLastSuccessAt(source.lastSuccessAt),
    importedToday: String(source.importedToday),
    totalPublications: String(source.totalPublications),
  }
}


export type PublicPublication = {
  id: string
  title: string
  actType: string | null
  actNumber: string | null
  agency: string | null
  uf: string | null
  publishedOn: string | null
  effectiveOn: string | null
  officialUrl: string | null
  sourceCode: string | null
  sourceName: string | null
  collectedAt: string | null
}

export type PublicPublicationsResponse = {
  items: PublicPublication[]
}

export type PublicPublicationFilters = {
  uf?: string
  jurisdiction?: 'FEDERAL' | 'STATE'
  source?: string
  order?: 'published' | 'collected'
  limit?: number
}

export type PublicStatsResponse = {
  totalPublications: number
  totalSources: number
  activeSources: number
  importedToday: number
  generatedAt: string
}

export function publicPublicationQuery(
  filters: PublicPublicationFilters = {},
): string {
  const params = new URLSearchParams()

  if (filters.uf) params.set('uf', filters.uf.toUpperCase())
  if (filters.jurisdiction) params.set('jurisdiction', filters.jurisdiction)
  if (filters.source) params.set('source', filters.source)
  if (filters.order) params.set('order', filters.order)

  const requestedLimit = filters.limit ?? 20
  params.set('limit', String(Math.min(20, Math.max(1, requestedLimit))))

  return params.toString()
}

export async function fetchPublicPublications(
  filters: PublicPublicationFilters = {},
  apiBase = publicApiBase(),
  signal?: AbortSignal,
): Promise<PublicPublicationsResponse> {
  const query = publicPublicationQuery(filters)
  const response = await fetch(
    publicApiUrl(`/public/v1/publications?${query}`, apiBase),
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    },
  )

  if (!response.ok) {
    throw new Error(`public_publications_http_${response.status}`)
  }

  const payload = await response.json()

  if (!payload || !Array.isArray(payload.items)) {
    throw new Error('public_publications_invalid_payload')
  }

  return payload as PublicPublicationsResponse
}

export async function fetchPublicStats(
  apiBase = publicApiBase(),
  signal?: AbortSignal,
): Promise<PublicStatsResponse> {
  const response = await fetch(publicApiUrl('/public/v1/stats', apiBase), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`public_stats_http_${response.status}`)
  }

  const payload = await response.json()

  if (
    !payload ||
    typeof payload.totalPublications !== 'number' ||
    typeof payload.totalSources !== 'number' ||
    typeof payload.activeSources !== 'number' ||
    typeof payload.importedToday !== 'number' ||
    typeof payload.generatedAt !== 'string'
  ) {
    throw new Error('public_stats_invalid_payload')
  }

  return payload as PublicStatsResponse
}

export function formatPublicDate(value: string | null): string {
  if (!value) return 'Data não informada'

  const parsed = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(parsed)
}


export function formatRelativeCollectedAt(
  value: string | null,
  now = new Date(),
): string {
  if (!value) return 'horário não informado'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'horário não informado'

  const diffMs = Math.max(0, now.getTime() - parsed.getTime())
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`

  const days = Math.floor(hours / 24)
  return `há ${days} d`
}
