import type { ProductApiFetch } from './product-api'
import { PlatformAdminApiError } from './platform-admin-api'

export type DouDownloadLimits = {
  pdfMiB: number
  zipMiB: number
  expandedZipMiB: number
  xmlEntryMiB: number
}

export interface DouDownloadLimitsResponse {
  limits: DouDownloadLimits
  editable: boolean
  configured: boolean
  updatedAt: string | null
  limitsNotice: string
}

export const DOU_LIMIT_CEILINGS: DouDownloadLimits = {
  pdfMiB: 20,
  zipMiB: 64,
  expandedZipMiB: 128,
  xmlEntryMiB: 8,
}

export function validateDouLimits(limits: DouDownloadLimits): string | null {
  for (const [key, max] of Object.entries(DOU_LIMIT_CEILINGS) as [keyof DouDownloadLimits, number][]) {
    const value = limits[key]
    if (!Number.isSafeInteger(value) || value < 1 || value > max)
      return 'Informe ' + key + ' entre 1 e ' + max + ' MiB.'
  }
  if (limits.expandedZipMiB < limits.zipMiB)
    return 'O limite descompactado não pode ser menor que o ZIP.'
  return null
}

async function read<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body &&
      typeof body.error === 'string' ? body.error : 'dou_limits_request_failed'
    throw new PlatformAdminApiError(error, response.status)
  }
  return body as T
}

const PATH = '/api/v1/admin/platform/dou-download-limits'

export async function fetchDouDownloadLimits(apiFetch: ProductApiFetch) {
  return read<DouDownloadLimitsResponse>(await apiFetch(PATH, {
    headers: { Accept: 'application/json' },
  }))
}

export async function updateDouDownloadLimits(apiFetch: ProductApiFetch, limits: DouDownloadLimits) {
  const invalid = validateDouLimits(limits)
  if (invalid) throw new Error(invalid)
  return read<DouDownloadLimitsResponse>(await apiFetch(PATH, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(limits),
  }))
}
