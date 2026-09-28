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

  return (
    items.find(
      (source) =>
        source.jurisdictionLevel === 'STATE' &&
        source.uf?.toUpperCase() === normalizedUf,
    ) ??
    items.find((source) => source.code === preferredCode)
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
