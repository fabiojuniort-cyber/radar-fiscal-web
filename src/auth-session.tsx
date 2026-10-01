import { createContext, useContext, useRef, useState, type ReactNode } from 'react'

import {
  buildManualCompanyPayload,
  buildManualEstablishmentPayload,
  lookupBrasilApiFromBrowser,
} from './browser-cnpj-fallback'

interface Membership {
  tenantId: string
  tenantName: string
  tenantSlug: string
  role: 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER'
}

interface AuthMe {
  user: { id: string; email: string; name: string | null }
  memberships: Membership[]
}

interface AuthState {
  me: AuthMe | null
  checked: boolean
  login: (email: string, password: string) => Promise<void>
  ensureSession: () => Promise<boolean>
  logout: () => Promise<void>
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
}

const AuthContext = createContext<AuthState | null>(null)

async function readAccessToken(response: Response): Promise<string> {
  if (!response.ok) throw new Error('invalid_credentials')
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' || body === null ||
    !('accessToken' in body) || typeof body.accessToken !== 'string' ||
    body.accessToken.length === 0
  ) throw new Error('invalid_auth_response')
  return body.accessToken
}

async function fetchMe(accessToken: string): Promise<AuthMe> {
  const response = await fetch('/auth/me', {
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) throw new Error('unauthorized')
  const body: unknown = await response.json()
  if (
    typeof body !== 'object' || body === null ||
    !('user' in body) || !('memberships' in body) ||
    !Array.isArray(body.memberships)
  ) throw new Error('invalid_auth_response')
  return body as AuthMe
}

function requestPath(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === 'string') {
      return new URL(input, window.location.origin).pathname
    }

    if (input instanceof URL) return input.pathname

    return new URL(input.url, window.location.origin).pathname
  } catch {
    return null
  }
}

function requestJsonBody(init?: RequestInit): Record<string, unknown> | null {
  if (typeof init?.body !== 'string') return null

  try {
    const body: unknown = JSON.parse(init.body)
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

async function tryBrowserCnpjFallback(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  accessToken: string,
): Promise<Response | null> {
  if ((init?.method ?? 'GET').toUpperCase() !== 'POST') return null

  const path = requestPath(input)
  const body = requestJsonBody(init)
  if (!path || !body || typeof body.cnpj !== 'string') return null

  const companyPath = path === '/api/v1/companies/from-cnpj'
  const establishmentMatch =
    /^\/api\/v1\/companies\/([^/]+)\/establishments\/from-cnpj$/.exec(path)

  if (!companyPath && !establishmentMatch) return null

  const registry = await lookupBrasilApiFromBrowser(body.cnpj)
  if (!registry) return null

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'application/json')

  const businessLocationCode =
    typeof body.businessLocationCode === 'string'
      ? body.businessLocationCode
      : null

  if (companyPath) {
    return fetch('/api/v1/companies/manual', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify(
        buildManualCompanyPayload(
          registry,
          businessLocationCode,
        ),
      ),
    })
  }

  const companyId = establishmentMatch?.[1]
  if (!companyId) return null

  const typeCode =
    typeof body.typeCode === 'string' && body.typeCode.trim()
      ? body.typeCode.trim()
      : 'OTHER'

  return fetch('/api/v1/establishments/manual', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(
      buildManualEstablishmentPayload(
        registry,
        companyId,
        typeCode,
        businessLocationCode,
      ),
    ),
  })
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const token = useRef<string | null>(null)
  const refreshInFlight = useRef<Promise<boolean> | null>(null)
  const [me, setMe] = useState<AuthMe | null>(null)
  const [checked, setChecked] = useState(false)

  const login = async (email: string, password: string) => {
    const response = await fetch('/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const accessToken = await readAccessToken(response)
    const identity = await fetchMe(accessToken)
    token.current = accessToken
    setMe(identity)
    setChecked(true)
  }

  const refreshAccessToken = (): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current

    const pending = (async () => {
      try {
        const response = await fetch('/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-csrf-protection': '1' },
        })
        const accessToken = await readAccessToken(response)
        const identity = await fetchMe(accessToken)
        token.current = accessToken
        setMe(identity)
        return true
      } catch {
        token.current = null
        setMe(null)
        return false
      } finally {
        setChecked(true)
      }
    })()

    refreshInFlight.current = pending
    void pending.finally(() => { refreshInFlight.current = null })
    return pending
  }

  const ensureSession = (): Promise<boolean> => {
    if (token.current && me) {
      setChecked(true)
      return Promise.resolve(true)
    }

    return refreshAccessToken()
  }

  const apiFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    if (!token.current) {
      const refreshed = await refreshAccessToken()
      if (!refreshed || !token.current) throw new Error('unauthorized')
    }

    const execute = () => {
      const headers = new Headers(init?.headers)
      headers.set('Authorization', `Bearer ${token.current}`)

      return fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      })
    }

    let response = await execute()

    if (response.status === 401) {
      token.current = null

      const refreshed = await refreshAccessToken()
      if (refreshed && token.current) response = await execute()
    }

    if (
      (response.status === 502 || response.status === 503) &&
      token.current
    ) {
      const fallbackResponse = await tryBrowserCnpjFallback(
        input,
        init,
        token.current,
      )

      if (fallbackResponse) response = fallbackResponse
    }

    return response
  }

  const logout = async () => {
    const current = token.current
    if (!current) throw new Error('unauthorized')
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        Authorization: `Bearer ${current}`,
        'x-csrf-protection': '1',
      },
    })
    if (!response.ok) throw new Error('logout_failed')
    token.current = null
    setMe(null)
    setChecked(true)
  }

  return <AuthContext.Provider value={{ me, checked, login, ensureSession, logout, apiFetch }}>
    {children}
  </AuthContext.Provider>
}

export function useAuthSession(): AuthState {
  const session = useContext(AuthContext)
  if (!session) throw new Error('AuthSessionProvider is required')
  return session
}
