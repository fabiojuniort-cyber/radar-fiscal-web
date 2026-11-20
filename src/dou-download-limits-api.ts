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

async function read(response: Response): Promise<DouDownloadLimitsResponse> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = body && typeof body === 'object' && 'error' in body &&
      typeof body.error === 'string' ? body.error : 'dou_limits_request_failed'
    throw new PlatformAdminApiError(error, response.status)
  }
  if (!body || typeof body !== 'object' || !('limits' in body) ||
    !body.limits || typeof body.limits !== 'object' ||
    !('editable' in body) || typeof body.editable !== 'boolean' ||
    !('configured' in body) || typeof body.configured !== 'boolean' ||
    !('updatedAt' in body) || (body.updatedAt !== null && typeof body.updatedAt !== 'string') ||
    !('limitsNotice' in body) || typeof body.limitsNotice !== 'string' ||
    validateDouLimits(body.limits as DouDownloadLimits)) {
    throw new PlatformAdminApiError('dou_limits_unconfirmed', response.status)
  }
  return body as DouDownloadLimitsResponse
}

const PATH = '/api/v1/admin/platform/dou-download-limits'

export async function fetchDouDownloadLimits(apiFetch: ProductApiFetch) {
  return read(await apiFetch(PATH, {
    headers: { Accept: 'application/json' },
  }))
}

export async function updateDouDownloadLimits(apiFetch: ProductApiFetch, limits: DouDownloadLimits) {
  const invalid = validateDouLimits(limits)
  if (invalid) throw new Error(invalid)
  const saved = await read(await apiFetch(PATH, {
    method: 'PUT',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(limits),
  }))
  if (!saved.configured || (Object.keys(DOU_LIMIT_CEILINGS) as (keyof DouDownloadLimits)[])
    .some((key) => saved.limits[key] !== limits[key])) {
    throw new PlatformAdminApiError('dou_limits_unconfirmed', 200)
  }
  return saved
}
