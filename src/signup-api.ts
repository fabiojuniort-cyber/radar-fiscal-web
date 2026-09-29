export type SignupRequest = {
  name: string
  email: string
  company: string
  cnpj?: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
}

export type SignupResponse = {
  user: {
    id: string
    email: string
    name: string
  }
  tenant: {
    id: string
    name: string
    slug: string
  }
  membership: {
    role: 'OWNER'
  }
  next: 'LOGIN'
}

export type SignupErrorCode =
  | 'email_already_registered'
  | 'invalid_password'
  | 'invalid_signup_data'
  | 'too_many_requests'
  | 'network_error'
  | 'unexpected_error'

export class SignupApiError extends Error {
  constructor(readonly code: SignupErrorCode) {
    super(code)
    this.name = 'SignupApiError'
  }
}

async function responseError(response: Response): Promise<SignupErrorCode> {
  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  const error =
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'string'
      ? payload.error
      : null

  if (
    error === 'email_already_registered' ||
    error === 'invalid_password' ||
    error === 'invalid_signup_data' ||
    error === 'too_many_requests'
  ) {
    return error
  }

  if (response.status === 409) return 'email_already_registered'
  if (response.status === 429) return 'too_many_requests'
  if (response.status === 400) return 'invalid_signup_data'

  return 'unexpected_error'
}

export async function registerPublicAccount(
  input: SignupRequest,
): Promise<SignupResponse> {
  let response: Response

  try {
    response = await fetch('/auth/register', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new SignupApiError('network_error')
  }

  if (response.status !== 201) {
    throw new SignupApiError(
      await responseError(response),
    )
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new SignupApiError('unexpected_error')
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('user' in payload) ||
    !('tenant' in payload) ||
    !('membership' in payload) ||
    !('next' in payload) ||
    payload.next !== 'LOGIN'
  ) {
    throw new SignupApiError('unexpected_error')
  }

  return payload as SignupResponse
}
