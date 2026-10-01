import type { ProductApiFetch } from './product-api'

export type NcmOption = {
  entryId: string
  code: string
  officialCode: string
  description: string
}

export type NcmLookupResponse = {
  items: NcmOption[]
  edition: {
    code: string
    validFrom: string | null
  } | null
}

export type ProductNcmAssignment = {
  entryId: string
  code: string
  officialCode: string
  description: string
  isPrimary: boolean
  assignmentSource: string
}

export type ProductProfile = {
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

export type PublicationNcm = {
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

function tenantHeaders(tenantId: string) {
  return { 'x-tenant-id': tenantId }
}

async function ensureOk(response: Response, fallback: string): Promise<Response> {
  if (response.ok) return response
  const body = await response.json().catch(() => null) as { error?: string } | null
  throw new Error(body?.error ?? fallback)
}

export async function searchNcms(
  apiFetch: ProductApiFetch,
  q: string,
  limit = 20,
): Promise<NcmLookupResponse> {
  const params = new URLSearchParams({ q: q.trim(), limit: String(limit) })
  const response = await ensureOk(
    await apiFetch(`/api/v1/ncm?${params.toString()}`),
    'ncm_lookup_failed',
  )
  return response.json() as Promise<NcmLookupResponse>
}

export async function fetchProductProfiles(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
): Promise<ProductProfile[]> {
  const response = await ensureOk(
    await apiFetch(`/api/v1/companies/${companyId}/product-profiles`, {
      headers: tenantHeaders(tenantId),
    }),
    'product_profiles_failed',
  )
  const body = await response.json() as { items: ProductProfile[] }
  return body.items
}

export async function createProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  input: ProductProfileInput,
): Promise<ProductProfile> {
  const response = await ensureOk(
    await apiFetch(`/api/v1/companies/${companyId}/product-profiles`, {
      method: 'POST',
      headers: {
        ...tenantHeaders(tenantId),
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
    'product_profile_create_failed',
  )
  return response.json() as Promise<ProductProfile>
}

export async function updateProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  profileId: string,
  input: ProductProfileInput,
): Promise<ProductProfile> {
  const response = await ensureOk(
    await apiFetch(`/api/v1/companies/${companyId}/product-profiles/${profileId}`, {
      method: 'PUT',
      headers: {
        ...tenantHeaders(tenantId),
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
    'product_profile_update_failed',
  )
  return response.json() as Promise<ProductProfile>
}

export async function deleteProductProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  profileId: string,
): Promise<void> {
  await ensureOk(
    await apiFetch(`/api/v1/companies/${companyId}/product-profiles/${profileId}`, {
      method: 'DELETE',
      headers: tenantHeaders(tenantId),
    }),
    'product_profile_delete_failed',
  )
}

export async function fetchPublicationNcms(
  apiFetch: ProductApiFetch,
  publicationId: string,
): Promise<PublicationNcm[]> {
  const response = await ensureOk(
    await apiFetch(`/api/v1/publications/${publicationId}/ncms`),
    'publication_ncms_failed',
  )
  const body = await response.json() as { items: PublicationNcm[] }
  return body.items
}
