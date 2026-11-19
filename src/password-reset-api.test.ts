import { afterEach, describe, expect, it, vi } from 'vitest'
import { PasswordResetApiError, confirmPasswordReset, requestPasswordReset } from './password-reset-api'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
const input = { token: 's'.repeat(43), password: 'Senha-Sintetica!123', confirmPassword: 'Senha-Sintetica!123' }
const response = (status: number, retry?: string, payload: unknown = {}) => new Response(
  status === 204 ? null : JSON.stringify(payload),
  { status, headers: retry ? { 'Retry-After': retry } : undefined },
)

describe('AUTH-RESET client contract #315', () => {
  it('uses the same-origin forgot contract and accepts only the neutral 202', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(202, undefined, { status: 'if_account_exists' }))
    vi.stubGlobal('fetch', fetcher)
    await expect(requestPasswordReset('conta@example.test')).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('/auth/password/forgot', expect.objectContaining({
      method: 'POST', credentials: 'include', cache: 'no-store', referrerPolicy: 'no-referrer',
      body: JSON.stringify({ email: 'conta@example.test' }),
    }))
  })

  it('does not treat an unexpected 202 payload as a confirmed neutral response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(202)))
    await expect(requestPasswordReset('conta@example.test')).rejects.toMatchObject({ code: 'unexpected_error' })
  })

  it('posts reset data only in JSON and accepts the empty 204', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(204))
    vi.stubGlobal('fetch', fetcher)
    await expect(confirmPasswordReset(input)).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledWith('/auth/password/reset', expect.objectContaining({
      method: 'POST', credentials: 'include', referrerPolicy: 'no-referrer', body: JSON.stringify(input),
    }))
  })

  it.each([
    [400, 'invalid_request'], [503, 'unavailable'], [500, 'unexpected_error'],
  ])('maps forgot HTTP %s without reflecting response data', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(Number(status), undefined, { error: 'synthetic-internal-detail' })))
    await expect(requestPasswordReset('conta@example.test')).rejects.toMatchObject({ code, message: code })
  })

  it.each(['invalid', 'expired', 'used'])('returns one reset error for a %s link', async reason => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(400, undefined, { error: reason })))
    await expect(confirmPasswordReset(input)).rejects.toMatchObject({ code: 'invalid_token', message: 'invalid_token' })
  })

  it('preserves a Retry-After delay in seconds for the UI', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, '30')))
    await expect(confirmPasswordReset(input)).rejects.toMatchObject({ code: 'too_many_requests', retryAfterSeconds: 30 })
  })

  it('accepts the HTTP-date Retry-After form without echoing its raw value', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-19T00:00:00Z'))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(429, 'Thu, 19 Nov 2026 00:00:20 GMT')))
    await expect(requestPasswordReset('conta@example.test')).rejects.toMatchObject({ retryAfterSeconds: 20 })
  })

  it('does not retain transport errors or credentials in the public error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('synthetic-request-detail')))
    await expect(confirmPasswordReset(input)).rejects.toEqual(new PasswordResetApiError('network_error'))
  })
})
