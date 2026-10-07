import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlatformAdministratorsPage } from './platform-admin'
import type { ProductApiFetch } from './product-api'

afterEach(() => cleanup())

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function renderPage(apiFetch: ProductApiFetch) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PlatformAdministratorsPage apiFetch={apiFetch} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const adminMe = {
  platformAdmin: true,
  taxonomyCurator: false,
  licenseBypass: true,
  curatorDatabase: true,
}

describe('Administradores da plataforma', () => {
  it('bloqueia usuário sem PLATFORM_ADMIN', async () => {
    const apiFetch = vi.fn(async () =>
      json({
        ...adminMe,
        platformAdmin: false,
        licenseBypass: false,
      }),
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)
    expect(
      await screen.findByText('Acesso restrito'),
    ).toBeInTheDocument()
  })

  it('lista, concede e confirma revogação', async () => {
    let admins = [
      {
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'admin@trifaros.com.br',
        name: 'Administrador',
        status: 'ACTIVE',
        grantedAt: '2026-10-06T12:00:00.000Z',
        grantedBy: 'ops',
      },
    ]

    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/v1/admin/me') return json(adminMe)
        if (url.endsWith('/administrators') && !init?.method) {
          return json({
            items: admins,
            lastAdminProtection: true,
          })
        }
        if (url.endsWith('/grant')) {
          const body = JSON.parse(String(init?.body))
          admins = [
            ...admins,
            {
              userId: '22222222-2222-4222-8222-222222222222',
              email: body.email,
              name: 'Segundo',
              status: 'ACTIVE',
              grantedAt: '2026-10-06T13:00:00.000Z',
              grantedBy: 'app',
            },
          ]
          return json({
            action: 'GRANTED',
            targetUserId: admins[1]!.userId,
            targetEmail: body.email,
          })
        }
        if (url.endsWith('/revoke')) {
          const body = JSON.parse(String(init?.body))
          admins = admins.filter((item) => item.email !== body.email)
          return json({
            action: 'REVOKED',
            targetUserId: '22222222-2222-4222-8222-222222222222',
            targetEmail: body.email,
          })
        }
        return json({ error: 'unexpected' }, 500)
      },
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)

    expect(
      await screen.findByText('admin@trifaros.com.br'),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'novo@trifaros.com.br' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Conceder acesso' }),
    )

    expect(
      await screen.findByText('novo@trifaros.com.br'),
    ).toBeInTheDocument()

    const removeButtons = screen.getAllByRole('button', {
      name: 'Remover',
    })
    fireEvent.click(removeButtons[1]!)
    expect(
      await screen.findByText('Remover administrador?'),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Remover acesso' }),
    )

    await waitFor(() => {
      expect(
        screen.queryByText('novo@trifaros.com.br'),
      ).not.toBeInTheDocument()
    })
  })

  it('mostra proteção do último administrador retornada pela API', async () => {
    const apiFetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url === '/api/v1/admin/me') return json(adminMe)
        if (url.endsWith('/administrators') && !init?.method) {
          return json({
            items: [
              {
                userId: '11111111-1111-4111-8111-111111111111',
                email: 'admin@trifaros.com.br',
                name: 'Administrador',
                status: 'ACTIVE',
                grantedAt: '2026-10-06T12:00:00.000Z',
                grantedBy: 'ops',
              },
            ],
            lastAdminProtection: true,
          })
        }
        if (url.endsWith('/revoke')) {
          return json({ error: 'last_platform_admin' }, 409)
        }
        return json({ error: 'unexpected' }, 500)
      },
    ) as unknown as ProductApiFetch

    renderPage(apiFetch)
    await screen.findByText('admin@trifaros.com.br')
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover acesso' }),
    )
    expect(
      await screen.findByText(
        'O último administrador ativo não pode ser removido.',
      ),
    ).toBeInTheDocument()
  })
})
