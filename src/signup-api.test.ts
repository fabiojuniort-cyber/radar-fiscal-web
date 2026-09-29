import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SignupApiError,
  registerPublicAccount,
} from './signup-api'

afterEach(() => {
  vi.unstubAllGlobals()
})

const input = {
  name: 'Pessoa Teste',
  email: 'pessoa@example.test',
  company: 'Empresa Teste',
  cnpj: '',
  password: 'Senha-Segura-2026!',
  confirmPassword: 'Senha-Segura-2026!',
  acceptedTerms: true,
}

describe('signup API', () => {
  it('accepts only a confirmed 201 account creation response', async () => {
    let capturedInit: RequestInit | undefined

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedInit = init

      return ({
      status: 201,
      json: async () => ({
        user: {
          id: 'user-1',
          email: input.email,
          name: input.name,
        },
        tenant: {
          id: 'tenant-1',
          name: input.company,
          slug: 'empresa-teste-abc',
        },
        membership: { role: 'OWNER' },
        next: 'LOGIN',
      }),
    } as Response)
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await registerPublicAccount(input)

    expect(result.membership.role).toBe('OWNER')
    expect(result.next).toBe('LOGIN')
    expect(fetchMock).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )

    expect(String(capturedInit?.body)).toContain(input.email)
    expect(String(capturedInit?.body)).toContain(input.password)
  })

  it.each([
    [409, 'email_already_registered'],
    [400, 'invalid_password'],
    [429, 'too_many_requests'],
  ] as const)('maps HTTP %s application errors', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status,
      json: async () => ({ error: code }),
    } as Response)))

    await expect(registerPublicAccount(input)).rejects.toMatchObject({
      name: 'SignupApiError',
      code,
    })
  })

  it('maps network failure without claiming success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('network down')
    }))

    await expect(registerPublicAccount(input)).rejects.toEqual(
      new SignupApiError('network_error'),
    )
  })

  it('rejects malformed success payloads', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      status: 201,
      json: async () => ({ next: 'LOGIN' }),
    } as Response)))

    await expect(registerPublicAccount(input)).rejects.toMatchObject({
      code: 'unexpected_error',
    })
  })
})
