import type {
  PublicSourcesResponse,
  PublicStatsResponse,
} from './public-api'

export async function fetchPublicSourcesV2(
  signal?: AbortSignal,
): Promise<PublicSourcesResponse> {
  const response = await fetch('/public/v2/sources', {
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

export async function fetchPublicStatsV2(
  signal?: AbortSignal,
): Promise<PublicStatsResponse> {
  const response = await fetch('/public/v2/stats', {
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
    typeof payload.importedToday !== 'number'
  ) {
    throw new Error('public_stats_invalid_payload')
  }

  return payload as PublicStatsResponse
}
