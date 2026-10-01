export type BrowserCnpjCnae = {
  code: string
  description: string
  isPrimary: boolean
}

export type BrowserCnpjRecord = {
  cnpj: string
  legalName: string
  tradeName: string | null
  uf: string
  municipalityName: string | null
  municipalityIbgeCode: string | null
  postalCode: string | null
  street: string | null
  streetNumber: string | null
  complement: string | null
  district: string | null
  cnaes: BrowserCnpjCnae[]
}

type JsonRecord = Record<string, unknown>

function objectValue(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null
}

function textValue(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized ? normalized.slice(0, maxLength) : null
}

function digits(value: unknown, expectedLength?: number): string | null {
  const raw = typeof value === 'number' || typeof value === 'string'
    ? String(value)
    : ''
  const normalized = raw.replace(/\D/g, '')
  if (!normalized) return null
  if (expectedLength && normalized.length !== expectedLength) return null
  return normalized
}

function cnaeFromValue(
  value: unknown,
  isPrimary: boolean,
): BrowserCnpjCnae | null {
  const row = objectValue(value)
  if (!row) return null

  const code = digits(row.codigo ?? row.code)
  const description = textValue(
    row.descricao ?? row.description,
    300,
  )

  if (!code || !/^\d{7}$/.test(code) || !description) return null

  return {
    code,
    description,
    isPrimary,
  }
}

function parseBrasilApiPayload(
  payload: unknown,
  expectedCnpj: string,
): BrowserCnpjRecord | null {
  const row = objectValue(payload)
  if (!row) return null

  const cnpj = digits(row.cnpj, 14)
  const legalName = textValue(row.razao_social, 200)
  const uf = textValue(row.uf, 2)?.toUpperCase() ?? null

  if (
    !cnpj ||
    cnpj !== expectedCnpj ||
    !legalName ||
    !uf ||
    !/^[A-Z]{2}$/.test(uf)
  ) {
    return null
  }

  const cnaes: BrowserCnpjCnae[] = []
  const primaryCode = digits(row.cnae_fiscal)
  const primaryDescription = textValue(row.cnae_fiscal_descricao, 300)

  if (primaryCode && /^\d{7}$/.test(primaryCode)) {
    cnaes.push({
      code: primaryCode,
      description:
        primaryDescription ?? 'Descrição não informada pelo provedor',
      isPrimary: true,
    })
  }

  if (Array.isArray(row.cnaes_secundarios)) {
    for (const item of row.cnaes_secundarios) {
      const parsed = cnaeFromValue(item, false)
      if (parsed && !cnaes.some((current) => current.code === parsed.code)) {
        cnaes.push(parsed)
      }
    }
  }

  return {
    cnpj,
    legalName,
    tradeName: textValue(row.nome_fantasia, 200),
    uf,
    municipalityName: textValue(row.municipio, 160),
    municipalityIbgeCode: digits(
      row.codigo_municipio_ibge ?? row.codigo_municipio,
      7,
    ),
    postalCode: digits(row.cep, 8),
    street: textValue(row.logradouro, 200),
    streetNumber: textValue(row.numero, 30),
    complement: textValue(row.complemento, 160),
    district: textValue(row.bairro, 160),
    cnaes,
  }
}

export async function lookupBrasilApiFromBrowser(
  cnpj: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<BrowserCnpjRecord | null> {
  const normalizedCnpj = cnpj.replace(/\D/g, '')
  if (!/^\d{14}$/.test(normalizedCnpj)) return null

  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetcher(
      `https://brasilapi.com.br/api/cnpj/v1/${normalizedCnpj}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    )

    if (!response.ok) return null

    const payload: unknown = await response.json()
    return parseBrasilApiPayload(payload, normalizedCnpj)
  } catch {
    return null
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export function buildManualCompanyPayload(
  record: BrowserCnpjRecord,
  businessLocationCode?: string | null,
) {
  return {
    cnpj: record.cnpj,
    legalName: record.legalName,
    establishmentName: record.tradeName ?? record.legalName,
    uf: record.uf,
    municipalityName: record.municipalityName ?? undefined,
    municipalityIbgeCode: record.municipalityIbgeCode ?? undefined,
    postalCode: record.postalCode ?? undefined,
    street: record.street ?? undefined,
    streetNumber: record.streetNumber ?? undefined,
    complement: record.complement ?? undefined,
    district: record.district ?? undefined,
    businessLocationCode: businessLocationCode?.trim() || undefined,
    cnaes: record.cnaes,
  }
}

export function buildManualEstablishmentPayload(
  record: BrowserCnpjRecord,
  companyId: string,
  typeCode: string,
  businessLocationCode?: string | null,
) {
  return {
    companyId,
    cnpj: record.cnpj,
    name: record.tradeName ?? record.legalName,
    typeCode,
    uf: record.uf,
    municipalityName: record.municipalityName ?? undefined,
    municipalityIbgeCode: record.municipalityIbgeCode ?? undefined,
    postalCode: record.postalCode ?? undefined,
    street: record.street ?? undefined,
    streetNumber: record.streetNumber ?? undefined,
    complement: record.complement ?? undefined,
    district: record.district ?? undefined,
    businessLocationCode: businessLocationCode?.trim() || undefined,
    cnaes: record.cnaes,
  }
}
