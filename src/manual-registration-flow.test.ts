import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPendingManualRegistration,
  rejectManualRegistration,
  resolveManualRegistration,
  type PendingManualRegistration,
} from './manual-registration-bridge'
import {
  createCompanyFromCnpj,
  createEstablishmentFromCnpj,
  type CnpjRegistryResult,
  type ProductApiFetch,
} from './product-api'

function response(
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

async function waitForPending(
  kind: 'company' | 'establishment',
): Promise<PendingManualRegistration> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pending = getPendingManualRegistration()
    if (pending?.request.kind === kind) {
      return pending
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 0),
    )
  }

  throw new Error(kind + '_fallback_not_opened')
}

afterEach(() => {
  if (getPendingManualRegistration()) {
    rejectManualRegistration(
      new Error('test_cleanup'),
    )
  }
})

describe('manual CNPJ fallback', () => {
  it('opens official manual company flow on invalid CNAE from registry and does not submit the provider code', async () => {
    const manualResult = { company: { id: 'official-company' } } as CnpjRegistryResult
    const apiFetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/v1/companies/from-cnpj') return response({ error: 'invalid_cnae' }, 400)
      if (url === '/api/v1/cnae-catalog?search=6201501') return response({
        items: [{ code: '6201501', description: 'Desenvolvimento de programas de computador sob encomenda' }],
      })
      if (url === '/api/v1/companies/manual') return response(manualResult, 201)
      return response({ error: 'unexpected' }, 500)
    })
    const apiFetch = apiFetchMock as ProductApiFetch
    const pendingOperation = createCompanyFromCnpj(apiFetch, 'tenant-1', '10.515.785/0003-50')
    const pending = await waitForPending('company')
    expect(pending.request.kind).toBe('company')
    if (pending.request.kind !== 'company') throw new Error('expected_company_registration')
    if (!pending.request.searchCnaes) throw new Error('official_catalog_search_not_available')
    const options = await pending.request.searchCnaes('6201501')
    expect(options).toHaveLength(1)
    expect(options[0]?.code).toBe('6201501')
    const output = await pending.request.submit({
      legalName: 'Empresa de CNAE Oficial',
      uf: 'GO',
      cnaes: [{ ...options[0]!, isPrimary: true }],
    })
    resolveManualRegistration(output)
    await expect(pendingOperation).resolves.toEqual(manualResult)
    const posted = apiFetchMock.mock.calls.find(([url]) => String(url) === '/api/v1/companies/manual')
    const body = JSON.parse(String(posted?.[1]?.body))
    expect(body.cnaes).toEqual([{ code: '6201501',
      description: 'Desenvolvimento de programas de computador sob encomenda',
      isPrimary: true }])
    expect(apiFetchMock.mock.calls.filter(([url]) => String(url) === '/api/v1/companies/from-cnpj')).toHaveLength(1)
  })


  it('opens manual company registration when providers are unavailable', async () => {
    const manualResult: CnpjRegistryResult = {
      company: {
        id: 'company-1',
        legalName: 'Empresa Manual Ltda.',
        tradeName: null,
        cnpj: '10515785000350',
        businessLocationCode: 'MATRIZ-001',
      },
      establishment: {
        id: 'establishment-1',
        companyId: 'company-1',
        cnpj: '10515785000350',
        name: 'Empresa Manual Ltda.',
        typeCode: 'HEAD_OFFICE',
        isHeadOffice: true,
        uf: 'GO',
        municipalityName: 'Goiânia',
        municipalityIbgeCode: null,
        postalCode: null,
        street: null,
        streetNumber: null,
        complement: null,
        district: null,
        businessLocationCode: 'MATRIZ-001',
        stateRegistration: '123456789',
        stateRegistrationStatus: null,
        stateRegistrationSource: 'MANUAL',
        stateRegistrationCheckedAt: null,
        stateRegistrationLookupStatus: null,
        cnaes: [],
      },
      registry: {
        source: 'MANUAL',
        consultedAt: '2026-09-30T23:00:00.000Z',
        registrationStatus: null,
        openedOn: null,
      },
    }

    const apiFetchMock = vi.fn(async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      const url = String(input)
      if (url === '/api/v1/companies/from-cnpj') {
        return response(
          { error: 'cnpj_provider_unavailable' },
          503,
        )
      }
      if (url === '/api/v1/companies/manual') {
        return response(manualResult, 201)
      }
      return response({ error: 'unexpected' }, 500)
    })
    const apiFetch = apiFetchMock as ProductApiFetch

    const registration = createCompanyFromCnpj(
      apiFetch,
      'tenant-1',
      '10.515.785/0003-50',
      'MATRIZ-001',
    )

    const pending = await waitForPending('company')

    expect(pending.request.cnpj).toBe('10515785000350')
    expect(
      pending.request.businessLocationCode,
    ).toBe('MATRIZ-001')

    if (pending.request.kind !== 'company') {
      throw new Error('company_fallback_not_opened')
    }

    const submitted = await pending.request.submit({
      legalName: 'Empresa Manual Ltda.',
      uf: 'GO',
      municipalityName: 'Goiânia',
      stateRegistration: '123456789',
    })
    resolveManualRegistration(submitted)

    await expect(registration).resolves.toEqual(manualResult)
    expect(apiFetchMock).toHaveBeenCalledTimes(2)

    const manualCall = apiFetchMock.mock.calls[1]
    const manualBody = JSON.parse(
      String(manualCall?.[1]?.body),
    )
    expect(manualBody).toMatchObject({
      cnpj: '10515785000350',
      legalName: 'Empresa Manual Ltda.',
      uf: 'GO',
      stateRegistration: '123456789',
      businessLocationCode: 'MATRIZ-001',
    })
  })

  it('uses the resilient manual establishment route when providers are unavailable', async () => {
    const apiFetchMock = vi.fn(async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      const url = String(input)
      if (url.includes('/establishments/from-cnpj')) {
        return response(
          { error: 'cnpj_provider_unavailable' },
          503,
        )
      }
      if (url === '/api/v1/establishments/manual') {
        return response(
          { establishment: { id: 'establishment-2' } },
          201,
        )
      }
      return response({ error: 'unexpected' }, 500)
    })
    const apiFetch = apiFetchMock as ProductApiFetch

    const registration = createEstablishmentFromCnpj(
      apiFetch,
      'tenant-1',
      'company-1',
      {
        cnpj: '10.515.785/0004-31',
        typeCode: 'OTHER',
        businessLocationCode: 'FILIAL-004',
      },
    )

    const pending = await waitForPending('establishment')

    if (
      pending.request.kind !== 'establishment'
    ) {
      throw new Error('establishment_fallback_not_opened')
    }

    const submitted = await pending.request.submit({
      name: 'Filial Manual',
      uf: 'GO',
      municipalityName: 'Rio Verde',
      stateRegistration: '987654321',
    })
    resolveManualRegistration(submitted)

    await expect(registration).resolves.toBeUndefined()
    expect(apiFetchMock).toHaveBeenCalledTimes(2)

    const manualCall = apiFetchMock.mock.calls[1]
    expect(String(manualCall?.[0])).toBe(
      '/api/v1/establishments/manual',
    )
    const manualBody = JSON.parse(
      String(manualCall?.[1]?.body),
    )
    expect(manualBody).toMatchObject({
      companyId: 'company-1',
      cnpj: '10515785000431',
      name: 'Filial Manual',
      typeCode: 'OTHER',
      uf: 'GO',
      stateRegistration: '987654321',
      businessLocationCode: 'FILIAL-004',
    })
    expect(manualBody).not.toHaveProperty('cnaes')
    expect(manualBody).not.toHaveProperty('isHeadOffice')
  })

  it('omits an empty Local Negócio from the manual request so reactivation can preserve the stored value', async () => {
    const manualResult = {
      company: {
        id: 'company-1',
        legalName: 'Empresa Manual Ltda.',
        tradeName: null,
        cnpj: '10515785000350',
        businessLocationCode: null,
      },
      establishment: {
        id: 'establishment-1',
      },
      registry: {
        source: 'MANUAL',
      },
    }

    const apiFetchMock = vi.fn(async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ) => {
      const url = String(input)
      if (url === '/api/v1/companies/from-cnpj') {
        return response(
          { error: 'cnpj_provider_unavailable' },
          503,
        )
      }
      if (url === '/api/v1/companies/manual') {
        return response(manualResult, 201)
      }
      return response({ error: 'unexpected' }, 500)
    })
    const apiFetch = apiFetchMock as ProductApiFetch

    const registration = createCompanyFromCnpj(
      apiFetch,
      'tenant-1',
      '10.515.785/0003-50',
      '',
    )

    const pending = await waitForPending('company')
    if (pending.request.kind !== 'company') {
      throw new Error('company_fallback_not_opened')
    }

    const submitted = await pending.request.submit({
      legalName: 'Empresa Manual Ltda.',
      uf: 'GO',
    })
    resolveManualRegistration(submitted)
    await registration

    const manualCall = apiFetchMock.mock.calls[1]
    const manualBody = JSON.parse(
      String(manualCall?.[1]?.body),
    )
    expect(manualBody).not.toHaveProperty(
      'businessLocationCode',
    )
  })

  it('offers manual fallback for a checksum-valid CNPJ not found in the registry', async () => {
    const apiFetch = vi.fn(async () =>
      response({ error: 'cnpj_not_found' }, 404),
    ) as ProductApiFetch
    const registration = createCompanyFromCnpj(
      apiFetch,
      'tenant-1',
      '19.131.243/0001-97',
    )
    const pending = await waitForPending('company')
    expect(pending.request.cnpj).toBe('19131243000197')
    rejectManualRegistration(new Error('manual_registration_cancelled'))
    await expect(registration).rejects.toThrow('manual_registration_cancelled')
  })

  it('never calls the API for an invalid CNPJ checksum', async () => {
    const apiFetch = vi.fn() as ProductApiFetch
    await expect(createCompanyFromCnpj(
      apiFetch,
      'tenant-1',
      '19.131.243/0001-90',
    )).rejects.toThrow('invalid_cnpj')
    expect(apiFetch).not.toHaveBeenCalled()
    expect(getPendingManualRegistration()).toBeNull()
  })
})
