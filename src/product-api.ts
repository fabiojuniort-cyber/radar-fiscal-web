export type ProductApiFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type AccountCompany = {
  id: string
  legalName: string
  tradeName: string | null
  cnpj: string
  isActive: boolean
  establishmentCount: number
}

export type AccountSummary = {
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
  onboarding: {
    companyName: string
    cnpj: string | null
    createdAt: string
  } | null
  companies: AccountCompany[]
}

export type Establishment = {
  id: string
  companyId: string
  cnpj: string
  name: string
  typeCode: string
  isHeadOffice: boolean
  uf: string
  municipalityName: string | null
  municipalityIbgeCode: string | null
  postalCode: string | null
  street: string | null
  streetNumber: string | null
  complement: string | null
  district: string | null
  isActive: boolean
}

export type EstablishmentType = {
  code: string
  name: string
}

export type TaxProfile = {
  id: string
  companyId: string
  versionNo: number
  taxRegime: string
  segments: string[]
  activities: string[]
  personalization: {
    taxes?: string[]
    products?: string[]
    operations?: string[]
    documents?: string[]
    obligations?: string[]
    keywords?: string[]
  }
  validFrom: string | null
  createdAt?: string
}

async function requireJson<T>(
  response: Response,
): Promise<T> {
  if (!response.ok) {
    let code = 'request_failed'

    try {
      const body = await response.clone().json()
      if (
        typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        code = body.error
      }
    } catch {
      // Keep generic code.
    }

    throw new Error(code)
  }

  return response.json() as Promise<T>
}

function tenantHeaders(
  tenantId: string,
  extra?: HeadersInit,
): Headers {
  const headers = new Headers(extra)
  headers.set('X-Tenant-Id', tenantId)
  return headers
}

export async function fetchAccountSummary(
  apiFetch: ProductApiFetch,
  tenantId: string,
): Promise<AccountSummary> {
  const response = await apiFetch('/api/v1/account', {
    headers: tenantHeaders(tenantId, {
      Accept: 'application/json',
    }),
  })

  return requireJson<AccountSummary>(response)
}

export async function createCompany(
  apiFetch: ProductApiFetch,
  tenantId: string,
  input: {
    legalName: string
    tradeName?: string
    cnpj: string
  },
): Promise<AccountCompany> {
  const response = await apiFetch('/api/v1/companies', {
    method: 'POST',
    headers: tenantHeaders(tenantId, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify(input),
  })

  const result = await requireJson<{
    company: Omit<AccountCompany, 'isActive' | 'establishmentCount'>
  }>(response)

  return {
    ...result.company,
    isActive: true,
    establishmentCount: 0,
  }
}

export async function fetchEstablishmentTypes(
  apiFetch: ProductApiFetch,
): Promise<EstablishmentType[]> {
  const response = await apiFetch('/api/v1/establishment-types', {
    headers: { Accept: 'application/json' },
  })

  const result = await requireJson<{ items: EstablishmentType[] }>(
    response,
  )

  return result.items
}

export async function fetchEstablishments(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
): Promise<Establishment[]> {
  const response = await apiFetch(
    '/api/v1/companies/' + companyId + '/establishments',
    {
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
      }),
    },
  )

  const result = await requireJson<{ items: Establishment[] }>(
    response,
  )

  return result.items
}

export async function createEstablishment(
  apiFetch: ProductApiFetch,
  tenantId: string,
  input: {
    companyId: string
    cnpj: string
    name: string
    typeCode: string
    isHeadOffice: boolean
    uf: string
    municipalityName?: string
    postalCode?: string
    street?: string
    streetNumber?: string
    complement?: string
    district?: string
  },
): Promise<void> {
  const response = await apiFetch('/api/v1/establishments', {
    method: 'POST',
    headers: tenantHeaders(tenantId, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify(input),
  })

  await requireJson(response)
}

export async function fetchTaxProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
): Promise<TaxProfile | null> {
  const response = await apiFetch(
    '/api/v1/companies/' + companyId + '/tax-profile',
    {
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
      }),
    },
  )

  const result = await requireJson<{ profile: TaxProfile | null }>(
    response,
  )

  return result.profile
}

export async function saveTaxProfile(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  input: {
    taxRegime: string
    segments: string[]
    activities: string[]
    personalization: {
      taxes: string[]
      products: string[]
      operations: string[]
      documents: string[]
      obligations: string[]
      keywords: string[]
    }
  },
): Promise<TaxProfile> {
  const response = await apiFetch(
    '/api/v1/companies/' + companyId + '/tax-profile',
    {
      method: 'PUT',
      headers: tenantHeaders(tenantId, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(input),
    },
  )

  const result = await requireJson<{ profile: TaxProfile }>(response)
  return result.profile
}


export type ProductArchiveItem = {
  id: string
  title: string
  actType: string | null
  actNumber: string | null
  agency: string | null
  jurisdictionLevel: string
  uf: string | null
  publishedOn: string | null
  effectiveOn: string | null
  officialUrl: string | null
  sourceCode: string | null
  sourceName: string | null
  excerpt: string | null
}

export type ProductArchiveResponse = {
  page: number
  limit: number
  hasMore: boolean
  items: ProductArchiveItem[]
}

export async function fetchProductArchive(
  apiFetch: ProductApiFetch,
  filters: {
    q?: string
    uf?: string
    jurisdiction?: 'FEDERAL' | 'STATE'
    source?: string
    page?: number
    limit?: number
  },
): Promise<ProductArchiveResponse> {
  const params = new URLSearchParams()

  if (filters.q) params.set('q', filters.q)
  if (filters.uf) params.set('uf', filters.uf)
  if (filters.jurisdiction) params.set('jurisdiction', filters.jurisdiction)
  if (filters.source) params.set('source', filters.source)
  params.set('page', String(filters.page ?? 1))
  params.set('limit', String(filters.limit ?? 25))

  const response = await apiFetch('/api/v1/archive?' + params.toString(), {
    headers: { Accept: 'application/json' },
  })

  return requireJson<ProductArchiveResponse>(response)
}


export type ProductPublicationDetail = {
  publication: {
    id: string
    title: string
    actType: string | null
    actNumber: string | null
    agency: string | null
    jurisdictionLevel: string
    uf: string | null
    publishedOn: string | null
    effectiveOn: string | null
    officialUrl: string | null
    firstCollectedAt: string
    lastSeenAt: string
  }
  version: {
    id: string
    versionNo: number
    versionCount: number
    contentText: string | null
    excerpt: string | null
    capturedAt: string | null
    presentation: {
      version: number
      format: 'PRESERVED_TEXT'
      preservesWhitespace: boolean
    }
  } | null
  origins: Array<{
    sourceCode: string
    sourceName: string
    officialUrl: string
    externalId: string | null
    firstSeenAt: string
    lastSeenAt: string
  }>
}

export async function fetchProductPublicationDetail(
  apiFetch: ProductApiFetch,
  publicationId: string,
): Promise<ProductPublicationDetail> {
  const response = await apiFetch(
    '/api/v1/publications/' + publicationId,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  )

  return requireJson<ProductPublicationDetail>(response)
}
