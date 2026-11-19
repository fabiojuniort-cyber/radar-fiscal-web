export type PasswordResetErrorCode =
  | 'invalid_request'
  | 'invalid_token'
  | 'too_many_requests'
  | 'unavailable'
  | 'network_error'
  | 'unexpected_error'

export class PasswordResetApiError extends Error {
  constructor(
    readonly code: PasswordResetErrorCode,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(code)
    this.name = 'PasswordResetApiError'
  }
}

function retryAfter(response: Response): number | null {
  const value = response.headers.get('Retry-After')
  if (!value) return null
  if (/^\d+$/.test(value)) {
    const seconds = Number(value)
    return Number.isSafeInteger(seconds) ? seconds : null
  }
  const deadline = Date.parse(value)
  return Number.isFinite(deadline)
    ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    : null
}

async function post(path: string, input: object): Promise<Response> {
  try {
    return await fetch(path, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    })
  } catch {
    // Never retain or expose a transport error that could contain the request.
    throw new PasswordResetApiError('network_error')
  }
}

function responseError(response: Response, phase: 'forgot' | 'reset'): PasswordResetApiError {
  if (response.status === 400) {
    return new PasswordResetApiError(phase === 'forgot' ? 'invalid_request' : 'invalid_token')
  }
  if (response.status === 429) return new PasswordResetApiError('too_many_requests', retryAfter(response))
  if (response.status === 503) return new PasswordResetApiError('unavailable')
  // Error bodies are intentionally not parsed or reflected to the UI.
  return new PasswordResetApiError('unexpected_error')
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await post('/auth/password/forgot', { email })
  if (response.status !== 202) throw responseError(response, 'forgot')
  let payload: unknown
  try { payload = await response.json() } catch { payload = null }
  if (typeof payload !== 'object' || payload === null ||
    !('status' in payload) || payload.status !== 'if_account_exists') {
    throw new PasswordResetApiError('unexpected_error')
  }
}

export async function confirmPasswordReset(input: {
  token: string
  password: string
  confirmPassword: string
}): Promise<void> {
  const response = await post('/auth/password/reset', input)
  if (response.status !== 204) throw responseError(response, 'reset')
}
