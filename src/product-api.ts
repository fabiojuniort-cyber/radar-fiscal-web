import {
  requestManualRegistration,
  type ManualCompanyForm,
  type ManualEstablishmentForm,
  type ManualCnaeOption,
} from './manual-registration-bridge'

// Local checksum validation improves UX; backend always validates independently.
export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false
  const digit = (weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }
  return digit([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[12])
    && digit([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(digits[13])
}

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
  businessLocationCode: string | null
}

export type AccountSummary = {
  tenant: {
    id: string
    name: string
    slug: string
    status: string
  }
  onboarding: {
    companyName: string | null
    cnpj: string | null
    createdAt: string
  } | null
  companies: AccountCompany[]
}

export type EstablishmentCnae = {
  code: string
  description: string
  isPrimary: boolean
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
  businessLocationCode: string | null
  stateRegistration: string | null
  stateRegistrationStatus: string | null
  stateRegistrationSource: string | null
  stateRegistrationCheckedAt: string | null
  stateRegistrationLookupStatus:
    | 'SUCCESS'
    | 'NOT_FOUND'
    | 'UNAVAILABLE'
    | 'NOT_SUPPORTED'
    | null
  isActive: boolean
  cnaes: EstablishmentCnae[]
}

export type EstablishmentType = {
  code: string
  name: string
}

export type CnpjRegistryResult = {
  company: {
    id: string
    legalName: string
    tradeName: string | null
    cnpj: string
    businessLocationCode: string | null
  }
  establishment: Omit<Establishment, 'isActive'>
  registry: {
    source: string
    consultedAt: string
    registrationStatus: string | null
    openedOn: string | null
  }
}

export type TaxonomyProfileConcept = {
  code: string
  label: string
  definition: string
  helpText?: string | null
  groupCode?: string | null
  officialCodes?: string[]
}

export type TaxonomyProfileGroup = {
  code: string
  label: string
  helpText: string | null
  segmentCodes: string[]
}

export type TaxonomyProfileDimension = {
  code: string
  name: string
  description: string | null
  helpText?: string | null
  profileOrder?: number
  usesGroups?: boolean
  officialCodeType?: string | null
  groups?: TaxonomyProfileGroup[]
  concepts: TaxonomyProfileConcept[]
}

export type TaxonomyProfileOptions = {
  release: {
    id: string
    version: string
    publishedAt: string | null
  } | null
  dimensions: TaxonomyProfileDimension[]
  /** Every included code of the release (visible or hidden). */
  conceptCodes?: string[]
  /** Label of every included concept, visible or hidden. */
  conceptIndex?: Array<{ code: string; label: string; dimensionCode: string }>
  /** Segmento table (CNAE activities excluded). */
  segments?: Array<{ code: string; label: string }>
  /** Produtos table items a company can parametrize. */
  products?: TaxonomyProductOption[]
}

export type TaxonomyProductOption = {
  code: string
  label: string
  groupLabel: string | null
  segmentCodes: string[]
  officialCodes: string[]
}

export type MonitoringRun = {
  id: string
  sourceCode: string
  sourceName: string
  jurisdictionLevel: 'FEDERAL' | 'STATE' | string
  uf: string | null
  status: string
  triggerType: string
  scheduledFor: string
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  attemptCount: number
  foundItems: number
  discardedItems: number
  retainedItems: number
  processedItems: number
  importedDocuments: number
}

export type MonitoringRunsResponse = {
  generatedAt: string
  windowHours: 24
  items: MonitoringRun[]
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
    /** NCMs of the card NCM, compared with the NCMs that legislation mentions. */
    ncmCodes?: string[]
    taxonomy?: {
      releaseId: string
      releaseVersion: string
      conceptCodes: string[]
      /** Segment of each company CNAE (suggested by the CNAE, user-editable; null = removed). */
      cnaeSegments?: Array<{ cnaeCode: string; segmentCode: string | null }>
    } | null
  }
  validFrom: string | null
  createdAt?: string
}

async function responseErrorCode(
  response: Response,
): Promise<string> {
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

  return code
}

async function requireJson<T>(
  response: Response,
): Promise<T> {
  if (!response.ok) {
    throw new Error(
      await responseErrorCode(response),
    )
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

function canUseManualCnpjFallback(
  code: string,
) {
  return (
    code === 'cnpj_provider_unavailable' ||
    code === 'cnpj_provider_invalid_response' ||
    code === 'cnpj_not_found' ||
    code === 'invalid_cnae'
  )
}

export async function fetchMonitoringRuns(
  apiFetch: ProductApiFetch,
  tenantId: string,
): Promise<MonitoringRunsResponse> {
  const response = await apiFetch(
    '/api/v1/monitoring/runs',
    {
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
      }),
    },
  )

  return requireJson<MonitoringRunsResponse>(
    response,
  )
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

export async function searchOfficialCnaes(
  apiFetch: ProductApiFetch,
  tenantId: string,
  term: string,
): Promise<ManualCnaeOption[]> {
  const response = await apiFetch(
    '/api/v1/cnae-catalog?search=' + encodeURIComponent(term.slice(0, 80)),
    { headers: tenantHeaders(tenantId, { Accept: 'application/json' }) },
  )
  const payload = await requireJson<{ items: ManualCnaeOption[] }>(response)
  return payload.items
}

export async function createCompanyFromCnpj(
  apiFetch: ProductApiFetch,
  tenantId: string,
  cnpj: string,
  businessLocationCode?: string,
): Promise<CnpjRegistryResult> {
  const normalizedCnpj = cnpj.replace(/\D/g, '')
  if (!isValidCnpj(normalizedCnpj)) throw new Error('invalid_cnpj')
  const normalizedBusinessLocation =
    businessLocationCode?.trim() || null
  const response = await apiFetch('/api/v1/companies/from-cnpj', {
    method: 'POST',
    headers: tenantHeaders(tenantId, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify({
      cnpj: normalizedCnpj,
      businessLocationCode:
        normalizedBusinessLocation ?? undefined,
    }),
  })

  if (response.ok) {
    return requireJson<CnpjRegistryResult>(response)
  }

  const code = await responseErrorCode(response)
  if (!canUseManualCnpjFallback(code)) {
    throw new Error(code)
  }

  return requestManualRegistration<CnpjRegistryResult>({
    kind: 'company',
    lookupFailure: { code, httpStatus: response.status },
    searchCnaes: (term: string) => searchOfficialCnaes(apiFetch, tenantId, term),
    cnpj: normalizedCnpj,
    businessLocationCode:
      normalizedBusinessLocation,
    submit: async (input: ManualCompanyForm) => {
      const manualResponse = await apiFetch(
        '/api/v1/companies/manual',
        {
          method: 'POST',
          headers: tenantHeaders(tenantId, {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            cnpj: normalizedCnpj,
            businessLocationCode:
              normalizedBusinessLocation ?? undefined,
            ...input,
          }),
        },
      )

      return requireJson<CnpjRegistryResult>(
        manualResponse,
      )
    },
  })
}

export async function updateCompany(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  input: {
    legalName: string
    businessLocationCode?: string | null
  },
): Promise<void> {
  const response = await apiFetch('/api/v1/companies/' + companyId, {
    method: 'PUT',
    headers: tenantHeaders(tenantId, {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }),
    body: JSON.stringify(input),
  })

  await requireJson(response)
}

export async function deleteCompany(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
): Promise<void> {
  const response = await apiFetch('/api/v1/companies/' + companyId, {
    method: 'DELETE',
    headers: tenantHeaders(tenantId, { 'X-Company-Delete-Intent': 'permanent-v1' }),
  })

  if (!response.ok) {
    await requireJson(response)
  }
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
    stateRegistration?: string
    businessLocationCode?: string | null
    cnaes?: EstablishmentCnae[]
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

export async function createEstablishmentFromCnpj(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  input: {
    cnpj: string
    typeCode: string
    businessLocationCode?: string | null
  },
): Promise<void> {
  const normalizedCnpj = input.cnpj.replace(/\D/g, '')
  if (!isValidCnpj(normalizedCnpj)) throw new Error('invalid_cnpj')
  const normalizedBusinessLocation =
    input.businessLocationCode?.trim() || null
  const response = await apiFetch(
    '/api/v1/companies/' + companyId + '/establishments/from-cnpj',
    {
      method: 'POST',
      headers: tenantHeaders(tenantId, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify({
        ...input,
        cnpj: normalizedCnpj,
        businessLocationCode:
          normalizedBusinessLocation ?? undefined,
      }),
    },
  )

  if (response.ok) {
    await requireJson(response)
    return
  }

  const code = await responseErrorCode(response)
  if (!canUseManualCnpjFallback(code)) {
    throw new Error(code)
  }

  await requestManualRegistration<void>({
    kind: 'establishment',
    lookupFailure: { code, httpStatus: response.status },
    searchCnaes: (term: string) => searchOfficialCnaes(apiFetch, tenantId, term),
    cnpj: normalizedCnpj,
    typeCode: input.typeCode,
    businessLocationCode:
      normalizedBusinessLocation,
    submit: async (
      manual: ManualEstablishmentForm,
    ) => {
      const manualResponse = await apiFetch(
        '/api/v1/establishments/manual',
        {
          method: 'POST',
          headers: tenantHeaders(tenantId, {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
          body: JSON.stringify({
            companyId,
            cnpj: normalizedCnpj,
            name: manual.name,
            typeCode: input.typeCode,
            uf: manual.uf,
            municipalityName:
              manual.municipalityName,
            postalCode: manual.postalCode,
            street: manual.street,
            streetNumber: manual.streetNumber,
            district: manual.district,
            stateRegistration:
              manual.stateRegistration,
            cnaes: manual.cnaes,
            businessLocationCode:
              normalizedBusinessLocation ?? undefined,
          }),
        },
      )

      await requireJson(manualResponse)
    },
  })
}

export async function updateEstablishment(
  apiFetch: ProductApiFetch,
  tenantId: string,
  establishmentId: string,
  input: {
    name: string
    typeCode: string
    uf: string
    municipalityName?: string | null
    municipalityIbgeCode?: string | null
    postalCode?: string | null
    street?: string | null
    streetNumber?: string | null
    complement?: string | null
    district?: string | null
    stateRegistration?: string | null
    businessLocationCode?: string | null
    cnaes: EstablishmentCnae[]
  },
): Promise<void> {
  const response = await apiFetch(
    '/api/v1/establishments/' + establishmentId,
    {
      method: 'PUT',
      headers: tenantHeaders(tenantId, {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      }),
      body: JSON.stringify(input),
    },
  )

  await requireJson(response)
}

export async function refreshEstablishmentCnpj(
  apiFetch: ProductApiFetch,
  tenantId: string,
  establishmentId: string,
): Promise<void> {
  const response = await apiFetch(
    '/api/v1/establishments/' + establishmentId + '/refresh-cnpj',
    {
      method: 'POST',
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
      }),
    },
  )

  await requireJson(response)
}

export async function deleteEstablishment(
  apiFetch: ProductApiFetch,
  tenantId: string,
  establishmentId: string,
): Promise<void> {
  const response = await apiFetch(
    '/api/v1/establishments/' + establishmentId,
    {
      method: 'DELETE',
      headers: tenantHeaders(tenantId),
    },
  )

  if (!response.ok) {
    await requireJson(response)
  }
}

export async function fetchTaxonomyProfileOptions(
  apiFetch: ProductApiFetch,
  tenantId: string,
): Promise<TaxonomyProfileOptions> {
  const response = await apiFetch('/api/v1/taxonomy/profile-options', {
    headers: tenantHeaders(tenantId, {
      Accept: 'application/json',
    }),
  })

  return requireJson<TaxonomyProfileOptions>(response)
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
      ncmCodes: string[]
      taxonomy: {
        releaseId: string
        releaseVersion: string
        conceptCodes: string[]
        cnaeSegments?: Array<{ cnaeCode: string; segmentCode: string | null }>
      } | null
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
    /** Last day in force, read from the act's current wording. */
    effectiveUntil?: {
      date: string
      basis: string
      amendedBy: string | null
    } | null
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
    presentation:
      | {
          version: number
          format: 'PRESERVED_TEXT'
          preservesWhitespace: boolean
        }
      | {
          version: number
          format: 'SANITIZED_HTML'
          preservesWhitespace: boolean
          html: string
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

export type AffinityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'

export type PublicationAffinity = {
  company: { id: string; name: string }
  status: 'OK' | 'NO_PROFILE' | 'NOT_CLASSIFIED'
  level: AffinityLevel | null
  score: number
  matches: Array<{
    code: string
    label: string
    dimensionCode: string
    weight: number
    via: 'SAME_ITEM' | 'PRODUCT_GROUP' | 'TEXT'
  }>
}

/** How close an act is to the company's tax profile (TAX-11). */
export async function fetchPublicationAffinity(
  apiFetch: ProductApiFetch,
  tenantId: string,
  companyId: string,
  publicationId: string,
): Promise<PublicationAffinity> {
  const response = await apiFetch(
    `/api/v1/companies/${encodeURIComponent(companyId)}/publications/${encodeURIComponent(publicationId)}/affinity`,
    {
      headers: tenantHeaders(tenantId, {
        Accept: 'application/json',
      }),
    },
  )

  return requireJson<PublicationAffinity>(response)
}
