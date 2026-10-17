export type ManualCnae = {
  code: string
  description: string
  isPrimary: boolean
}

export type ManualCnaeOption = Pick<ManualCnae, 'code' | 'description'>

export type ManualRegistrationCommon = {
  searchCnaes?: (term: string) => Promise<ManualCnaeOption[]>
  cnpj: string
  businessLocationCode?: string | null
  /** Sanitized status of the preceding automatic registry lookup. */
  lookupFailure?: { code: string; httpStatus: number }
}

export type ManualCompanyForm = {
  legalName: string
  uf: string
  municipalityName?: string
  postalCode?: string
  street?: string
  streetNumber?: string
  district?: string
  stateRegistration?: string
  cnaes?: ManualCnae[]
  reactivateInactive?: boolean
}

export type ManualEstablishmentForm = {
  name: string
  uf: string
  municipalityName?: string
  postalCode?: string
  street?: string
  streetNumber?: string
  district?: string
  stateRegistration?: string
  cnaes?: ManualCnae[]
  reactivateInactive?: boolean
}

export type ManualCompanyRegistrationRequest =
  ManualRegistrationCommon & {
    kind: 'company'
    submit: (
      input: ManualCompanyForm,
    ) => Promise<unknown>
  }

export type ManualEstablishmentRegistrationRequest =
  ManualRegistrationCommon & {
    kind: 'establishment'
    typeCode: string
    submit: (
      input: ManualEstablishmentForm,
    ) => Promise<unknown>
  }

export type ManualRegistrationRequest =
  | ManualCompanyRegistrationRequest
  | ManualEstablishmentRegistrationRequest

export type PendingManualRegistration = {
  request: ManualRegistrationRequest
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

type Listener = () => void

let pending: PendingManualRegistration | null = null
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeManualRegistration(
  listener: Listener,
) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getPendingManualRegistration() {
  return pending
}

export function requestManualRegistration<T>(
  request: ManualRegistrationRequest,
): Promise<T> {
  if (pending) {
    return Promise.reject(
      new Error('manual_registration_busy'),
    )
  }

  return new Promise<T>((resolve, reject) => {
    pending = {
      request,
      resolve: (value) => resolve(value as T),
      reject,
    }
    emit()
  })
}

export function resolveManualRegistration(
  value: unknown,
) {
  const current = pending
  if (!current) return

  pending = null
  current.resolve(value)
  emit()
}

export function rejectManualRegistration(
  error = new Error('manual_registration_cancelled'),
) {
  const current = pending
  if (!current) return

  pending = null
  current.reject(error)
  emit()
}
