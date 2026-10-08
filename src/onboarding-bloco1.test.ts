import { describe, expect, it, vi } from 'vitest'

import { isValidCnpj, searchOfficialCnaes } from './product-api'

describe('ONB-01 CNPJ and official CNAE selection', () => {
  it('validates checksum and rejects repeated digits before registration', () => {
    expect(isValidCnpj('12.345.678/0001-95')).toBe(true)
    expect(isValidCnpj('10.515.785/0004-31')).toBe(true)
    expect(isValidCnpj('12.345.678/0001-99')).toBe(false)
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false)
    expect(isValidCnpj('12345')).toBe(false)
  })

  it('uses the backend tenant-scoped official catalogue, not browser-supplied labels', async () => {
    const apiFetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      source: 'https://servicodados.ibge.gov.br/api/v2/cnae/subclasses',
      items: [{ code: '0111301', description: 'Cultivo de arroz' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const options = await searchOfficialCnaes(apiFetch, '12345678-1234-1234-1234-123456789012', 'arroz')
    expect(options).toEqual([{ code: '0111301', description: 'Cultivo de arroz' }])
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/cnae-catalog?search=arroz', expect.any(Object),
    )
    const request = apiFetch.mock.calls[0]?.[1] as { headers: Headers } | undefined
    expect(request?.headers.get('x-tenant-id')).toBe('12345678-1234-1234-1234-123456789012')
  })

  it('keeps catalogue unavailability distinct from empty results', async () => {
    const apiFetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      error: 'cnae_catalog_unavailable',
    }), { status: 503, headers: { 'content-type': 'application/json' } }))
    await expect(searchOfficialCnaes(apiFetch, 'tenant-1', 'soja')).rejects.toThrow()
  })
})
