import { describe, expect, it, vi } from 'vitest'

import {
  buildManualCompanyPayload,
  buildManualEstablishmentPayload,
  lookupBrasilApiFromBrowser,
} from './browser-cnpj-fallback'

const payload = {
  cnpj: '19131243000197',
  razao_social: 'Empresa Exemplo Ltda.',
  nome_fantasia: 'Exemplo Goiânia',
  uf: 'GO',
  municipio: 'Goiânia',
  codigo_municipio_ibge: '5208707',
  cep: '74000000',
  logradouro: 'Rua Exemplo',
  numero: '100',
  complemento: 'Sala 1',
  bairro: 'Centro',
  cnae_fiscal: 6201501,
  cnae_fiscal_descricao: 'Desenvolvimento de programas de computador sob encomenda',
  cnaes_secundarios: [
    {
      codigo: 6202300,
      descricao: 'Desenvolvimento e licenciamento de programas customizáveis',
    },
  ],
}

describe('browser CNPJ fallback', () => {
  it('normalizes BrasilAPI data for company and establishment persistence', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch

    const record = await lookupBrasilApiFromBrowser(
      '19.131.243/0001-97',
      fetcher,
      200,
    )

    expect(record).not.toBeNull()
    expect(record).toMatchObject({
      cnpj: '19131243000197',
      legalName: 'Empresa Exemplo Ltda.',
      tradeName: 'Exemplo Goiânia',
      uf: 'GO',
      municipalityName: 'Goiânia',
      municipalityIbgeCode: '5208707',
      postalCode: '74000000',
    })
    expect(record?.cnaes).toEqual([
      {
        code: '6201501',
        description: 'Desenvolvimento de programas de computador sob encomenda',
        isPrimary: true,
      },
      {
        code: '6202300',
        description: 'Desenvolvimento e licenciamento de programas customizáveis',
        isPrimary: false,
      },
    ])

    const company = buildManualCompanyPayload(record!, ' MATRIZ-001 ')
    expect(company).toMatchObject({
      cnpj: '19131243000197',
      legalName: 'Empresa Exemplo Ltda.',
      establishmentName: 'Exemplo Goiânia',
      businessLocationCode: 'MATRIZ-001',
      uf: 'GO',
    })
    expect(company.cnaes).toHaveLength(2)

    const establishment = buildManualEstablishmentPayload(
      record!,
      '11111111-1111-4111-8111-111111111111',
      'OTHER',
      ' FILIAL-002 ',
    )
    expect(establishment).toMatchObject({
      companyId: '11111111-1111-4111-8111-111111111111',
      name: 'Exemplo Goiânia',
      typeCode: 'OTHER',
      businessLocationCode: 'FILIAL-002',
    })
  })

  it('returns null when the browser provider is unavailable or inconsistent', async () => {
    const unavailable = vi.fn(async () =>
      new Response('{}', { status: 503 }),
    ) as unknown as typeof fetch

    await expect(
      lookupBrasilApiFromBrowser('19131243000197', unavailable, 200),
    ).resolves.toBeNull()

    const mismatch = vi.fn(async () =>
      new Response(
        JSON.stringify({ ...payload, cnpj: '00000000000191' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch

    await expect(
      lookupBrasilApiFromBrowser('19131243000197', mismatch, 200),
    ).resolves.toBeNull()
  })

  it('omits an empty Local Negócio so reactivation can preserve the stored value', async () => {
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify(payload), { status: 200 }),
    ) as unknown as typeof fetch

    const record = await lookupBrasilApiFromBrowser(
      '19131243000197',
      fetcher,
      200,
    )

    const company = buildManualCompanyPayload(record!, '   ')
    const establishment = buildManualEstablishmentPayload(
      record!,
      '11111111-1111-4111-8111-111111111111',
      'OTHER',
      null,
    )

    expect(company.businessLocationCode).toBeUndefined()
    expect(establishment.businessLocationCode).toBeUndefined()
  })
})
