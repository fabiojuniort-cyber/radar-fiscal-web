import type { ProductApiFetch } from './product-api'

export class PlatformAdminApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code)
  }
}

export interface PlatformAdministrator {
  userId: string
  email: string
  name: string | null
  status: string
  grantedAt: string
  grantedBy: string
}

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'platform_admin_request_failed'
    throw new PlatformAdminApiError(code, response.status)
  }
  return body as T
}

export async function fetchPlatformAdministrators(
  apiFetch: ProductApiFetch,
) {
  return readJson<{
    items: PlatformAdministrator[]
    lastAdminProtection: boolean
  }>(
    await apiFetch('/api/v1/admin/platform/administrators', {
      headers: { Accept: 'application/json' },
    }),
  )
}

async function changeAdministrator(
  apiFetch: ProductApiFetch,
  email: string,
  action: 'grant' | 'revoke',
) {
  return readJson<{
    action: string
    targetUserId: string
    targetEmail: string
  }>(
    await apiFetch(
      `/api/v1/admin/platform/administrators/${action}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      },
    ),
  )
}

export function grantPlatformAdministrator(
  apiFetch: ProductApiFetch,
  email: string,
) {
  return changeAdministrator(apiFetch, email, 'grant')
}

export function revokePlatformAdministrator(
  apiFetch: ProductApiFetch,
  email: string,
) {
  return changeAdministrator(apiFetch, email, 'revoke')
}
