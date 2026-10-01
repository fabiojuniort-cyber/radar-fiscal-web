import type { ProductApiFetch } from './product-api'

export type NcmCatalogItem = {
  entryId: string
  code: string
  officialCode: string
  description: string
}

export type NcmCatalogResponse = {
  items: NcmCatalogItem[]
  edition: {
    code: string
    validFrom: string | null
  } | null
}

export type CompanyProductNcm = {
  entryId: string
  code: string
  officialCode: string
  description: string
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
  ncms: CompanyProductNcm[]
  createdAt: string | null
  updatedAt: string | null
}

export type ProductProfileInput = {
  cnaeCode: string | null
  productLabel: string
  ncmCodes: string[]
}

export type PublicationNcm = {
  mentionId: string
  ncmCode: string
  description: string | null
  verificationStatus: string
  methodType: string
  detectorKey: string
  detectorVersion: string
  confidence: number | null
  excerpt: string | null
}

async function jsonOrError<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    let detail = fallback
    try {
      const payload = await response.json() as { error?: string; invalidCodes?: string[] }
      if (payload.error === 'cnae_not_linked') detail = 'O CNAE selecionado não pertence à empresa.'
      if (payload.error === 'invalid_ncm_codes') {
        detail = `NCM inválido ou fora do catálogo vigente: ${(payload.invalidCodes ?? []).join(', ')}`
      }
      if (payload.error === 'product_profile_exists') detail = 'Este produto já está parametrizado para o CNAE selecionado.'
    } catch {
      // Preserve the user-facing fallback when the response has no JSON body.
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export async function searchNcmCatalog(
  apiFetch: ProductApiFetch,
  query: string,
  limit = 20,
): Promise<NcmCatalogResponse> {
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit) })
  const response = await apiFetch(`/api/v1/ncm?${params.toString()}`)
  return jsonOrError<NcmCatalogResponse>(response, 'Não foi possível consultar o catálogo NCM.')
}

export async function fetchCompanyProductProfiles(
  apiFetch: ProductApiFetch,
  companyId: string,
): Promise<CompanyProductProfile[]> {
  const response = await apiFetch(`/api/v1/companies/${companyId}/product-profiles`)
  const payload = await jsonOrError<{ items: CompanyProductProfile[] }>(
    response,
    'Não foi possível carregar os produtos e NCMs da empresa.',
  )
  return payload.items
}

export async function createCompanyProductProfile(
  apiFetch: ProductApiFetch,
  companyId: string,
  input: ProductProfileInput,
): Promise<CompanyProductProfile> {
  const response = await apiFetch(`/api/v1/companies/${companyId}/product-profiles`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonOrError<CompanyProductProfile>(response, 'Não foi possível salvar o produto e seus NCMs.')
}

export async function updateCompanyProductProfile(
  apiFetch: ProductApiFetch,
  companyId: string,
  profileId: string,
  input: ProductProfileInput,
): Promise<CompanyProductProfile> {
  const response = await apiFetch(`/api/v1/companies/${companyId}/product-profiles/${profileId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonOrError<CompanyProductProfile>(response, 'Não foi possível atualizar o produto e seus NCMs.')
}

export async function deleteCompanyProductProfile(
  apiFetch: ProductApiFetch,
  companyId: string,
  profileId: string,
): Promise<void> {
  const response = await apiFetch(`/api/v1/companies/${companyId}/product-profiles/${profileId}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 204) {
    throw new Error('Não foi possível remover o produto parametrizado.')
  }
}

export async function fetchPublicationNcms(
  apiFetch: ProductApiFetch,
  publicationId: string,
): Promise<PublicationNcm[]> {
  const response = await apiFetch(`/api/v1/publications/${publicationId}/ncms`)
  const payload = await jsonOrError<{ items: PublicationNcm[] }>(
    response,
    'Não foi possível carregar os NCMs identificados nesta publicação.',
  )
  return payload.items
}
