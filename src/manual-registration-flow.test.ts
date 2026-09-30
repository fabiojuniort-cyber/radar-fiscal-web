import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPendingManualRegistration,
  rejectManualRegistration,
  resolveManualRegistration,
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

async function nextTurn() {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  if (getPendingManualRegistration()) {
    rejectManualRegistration(
      new Error('test_cleanup'),
    )
  }
})

describe('manual CNPJ fallback', () => {
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

    await nextTurn()

    const pending = getPendingManualRegistration()
    expect(pending?.request.kind).toBe('company')
    expect(pending?.request.cnpj).toBe('10515785000350')
    expect(
      pending?.request.businessLocationCode,
    ).toBe('MATRIZ-001')

    if (!pending || pending.request.kind !== 'company') {
      throw new Error('company fallback not opened')
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

  it('uses the existing manual establishment route when providers are unavailable', async () => {
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
      if (url === '/api/v1/establishments') {
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
        cnpj: '10.515.785/0004-30',
        typeCode: 'OTHER',
        businessLocationCode: 'FILIAL-004',
      },
    )

    await nextTurn()

    const pending = getPendingManualRegistration()
    expect(pending?.request.kind).toBe('establishment')

    if (
      !pending ||
      pending.request.kind !== 'establishment'
    ) {
      throw new Error('establishment fallback not opened')
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
    const manualBody = JSON.parse(
      String(manualCall?.[1]?.body),
    )
    expect(manualBody).toMatchObject({
      companyId: 'company-1',
      cnpj: '10515785000430',
      name: 'Filial Manual',
      typeCode: 'OTHER',
      isHeadOffice: false,
      uf: 'GO',
      stateRegistration: '987654321',
      businessLocationCode: 'FILIAL-004',
    })
  })

  it('does not offer manual fallback when both providers confirm CNPJ not found', async () => {
    const apiFetch = vi.fn(async () =>
      response(
        { error: 'cnpj_not_found' },
        404,
      ),
    ) as ProductApiFetch

    await expect(
      createCompanyFromCnpj(
        apiFetch,
        'tenant-1',
        '19.131.243/0001-97',
      ),
    ).rejects.toThrow('cnpj_not_found')

    expect(getPendingManualRegistration()).toBeNull()
  })
})
