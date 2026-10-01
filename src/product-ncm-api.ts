import type { ProductApiFetch } from './product-api'

export type NcmCatalogItem = {
  entryId: string
  code: string
  officialCode: string
  description: string
}

export type NcmCatalogSearch = {
  items: NcmCatalogItem[]
  edition: {
    code: string
    validFrom: string | null
  } | null
}

export type ProductNcmAssignment = NcmCatalogItem & {
  isPrimary: boolean
  assignmentSource: string
}

export type CompanyProductProfile = {
  id: string
  companyId: string
  cnaeCode: string | null
  cnaeDescription: string | null
  productLabel: string
  taxonomy: {
    releaseId: string | null
    sectorConceptId: string | null
    productConceptId: string | null
  }
  ncms: ProductNcmAssignment[]
  createdAt: string | null
  updatedAt: string | null
}

export type ProductProfileInput = {
  cnaeCode: string | null
  productLabel: string
  ncmCodes: string[]
}

export type PublicationNcmMention = {
  code: string
  description: string | null
  verificationStatus: string
  method: {
    type: string
    detectorKey: string
    detectorVersion: string
  }
  confidence: number | null
  excerpt: string | null
}

function tenantHeaders(tenantId: string, extra?: HeadersInit) {
  const headers = new Headers(extra)
  headers.set('X-Tenant-Id', tenantId)
  return headers
}

async function readError(response: Response) {
  try {
    const body = await response.clone().json() as { error?: unknown }
    return typeof body.error === 'string' ? body.error : 'request_failed'
  } catch {
    return 'request_failed'
  }
}

async function requireJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<T>
}

export async function searchNcmCatalog(
  apiFetch: ProductApiFetch,
  query: string,
  limit = 20,
): Promise<NcmCatalogSearch> {
  const params = new URLSearchParams({
    q: query.trim(),
    limit: String(limit),
  })
  const response = await apiFetch(`/api/v1/ncm?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return requireJson<NcmCatalogSearch>(response)
}

export async function fetchCompanyProductProfiles(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
): Promise<CompanyProductProfile[]> {
  const response = await apiFetch(
    `/api/v1/companies/${companyId}/product-profiles`,
    {
      headers: tenantHeaders(tenantId, { Accept: 'application/json' }),
    },
  )
  const body = await requireJson<{ items: CompanyProductProfile[] }>(response)
  return body.items
}

export async function createCompanyProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  input: ProductProfileInput,
): Promise<CompanyProductProfile> {
  const response = await apiFetch(
    `/api/v1/companies/${companyId}/product-profiles`,
    {
      method: 'POST',
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    },
  )
  return requireJson<CompanyProductProfile>(response)
}

export async function updateCompanyProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  profileId: string,
  input: ProductProfileInput,
): Promise<CompanyProductProfile> {
  const response = await apiFetch(
    `/api/v1/companies/${companyId}/product-profiles/${profileId}`,
    {
      method: 'PUT',
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(input),
    },
  )
  return requireJson<CompanyProductProfile>(response)
}

export async function deleteCompanyProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  profileId: string,
): Promise<void> {
  const response = await apiFetch(
    `/api/v1/companies/${companyId}/product-profiles/${profileId}`,
    {
      method: 'DELETE',
      headers: tenantHeaders(tenantId),
    },
  )
  if (!response.ok) throw new Error(await readError(response))
}

export async function fetchPublicationNcms(
  apiFetch: ProductApiFetch,
  publicationId: string,
): Promise<PublicationNcmMention[]> {
  const response = await apiFetch(`/api/v1/publications/${publicationId}/ncms`, {
    headers: { Accept: 'application/json' },
  })
  const body = await requireJson<{ items: PublicationNcmMention[] }>(response)
  return body.items
}
