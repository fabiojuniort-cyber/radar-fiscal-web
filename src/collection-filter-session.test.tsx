import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthSessionProvider, useAuthSession } from './auth-session'
import { CollectionFilterAdminPage } from './collection-filter-admin'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function json(body: unknown) { return new Response(JSON.stringify(body), { status: 200 }) }
function Harness() {
  const session = useAuthSession()
  return <>
    <button onClick={() => void session.login('admin@test.invalid', 'test')}>Login admin</button>
    <button onClick={() => void session.login('member@test.invalid', 'test')}>Login member</button>
    <button onClick={() => void session.logout()}>Logout</button>
    <button onClick={() => void session.ensureSession()}>Refresh</button>
    <span>{session.me?.user.id ?? 'anonymous'}</span>
    {session.me && <CollectionFilterAdminPage
      sessionKey={`${session.me.user.id}:${session.sessionRevision}`} apiFetch={session.apiFetch} />}
  </>
}
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: false } } })
  render(<StrictMode><QueryClientProvider client={client}><MemoryRouter><AuthSessionProvider>
    <Harness />
  </AuthSessionProvider></MemoryRouter></QueryClientProvider></StrictMode>)
  return client
}
function installFetch(options: { lateDiscard?: Promise<Response>; lateRefresh?: Promise<Response> } = {}) {
  const calls: Array<[string, string]> = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? ''
    calls.push([token, url])
    if (url === '/auth/login') {
      const email = JSON.parse(String(init?.body)).email as string
      return json({ accessToken: email.startsWith('admin') ? 'ADMIN' : 'MEMBER' })
    }
    if (url === '/auth/refresh' && options.lateRefresh) return options.lateRefresh
    if (url === '/auth/me') return json({ user: { id: token, email: 'test@test.invalid', name: null }, memberships: [] })
    if (url === '/auth/logout') return json({})
    if (url === '/api/v1/admin/me') return json({ platformAdmin: token === 'ADMIN' })
    if (url.endsWith('/state')) return json({ policies: [], documents: {}, simulations: [], newTypesOpen: 0 })
    if (url.includes('/discarded?')) {
      if (options.lateDiscard) return options.lateDiscard
      return json({ items: [{ id: 'restricted', title: 'Private admin discard', source_code: 'dou', reason_code: 'NO_TAX_TERM', policy_version: 1, policy_revision: 5 }] })
    }
    if (url.includes('/discard-alerts?')) return json({ items: [{ id: 'restricted-alert', source_code: 'PRIVATE-ALERT', status: 'OPEN', discard_rate: '0.9', baseline_rate: '0.4', threshold_rate: '0.65' }] })
    return json({ items: [] })
  }))
  return calls
}

it('isolates restricted caches across admin logout/member login in the same tab', async () => {
  const calls = installFetch()
  const client = mount()
  fireEvent.click(screen.getByText('Login admin'))
  fireEvent.click(await screen.findByRole('button', { name: 'Desconsiderados' }))
  await screen.findByText('Private admin discard')
  fireEvent.click(screen.getByRole('button', { name: 'Alertas de descarte' }))
  await screen.findByText('PRIVATE-ALERT · Aberto')
  client.setQueryData(['other-private-account-data'], 'private')
  fireEvent.click(screen.getByText('Logout'))
  await screen.findByText('anonymous')
  expect(client.getQueryData(['other-private-account-data'])).toBeUndefined()
  fireEvent.click(screen.getByText('Login member'))
  expect(screen.queryByText('Private admin discard')).not.toBeInTheDocument()
  expect(screen.queryByText('PRIVATE-ALERT · Aberto')).not.toBeInTheDocument()
  await screen.findByText('Acesso restrito')
  expect(calls).toContainEqual(['MEMBER', '/api/v1/admin/me'])
  expect(calls.some(([token, url]) => token === 'MEMBER' && /discarded|discard-alerts|\/state|new-types/.test(url))).toBe(false)
  expect(screen.queryByRole('button', { name: 'Desconsiderados' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByText('Logout'))
  await screen.findByText('anonymous')
  fireEvent.click(screen.getByText('Login admin'))
  fireEvent.click(await screen.findByRole('button', { name: 'Desconsiderados' }))
  await screen.findByText('Private admin discard')
  expect(calls.filter(([token, url]) => token === 'ADMIN' && url === '/api/v1/admin/me').length).toBeGreaterThanOrEqual(2)
})

it('does not publish a late admin query response in the member session', async () => {
  let resolve!: (response: Response) => void
  const calls = installFetch({ lateDiscard: new Promise<Response>(done => { resolve = done }) })
  mount()
  fireEvent.click(screen.getByText('Login admin'))
  fireEvent.click(await screen.findByRole('button', { name: 'Desconsiderados' }))
  await waitFor(() => expect(calls.some(([, url]) => url.includes('/discarded?'))).toBe(true))
  fireEvent.click(screen.getByText('Logout'))
  await screen.findByText('anonymous')
  fireEvent.click(screen.getByText('Login member'))
  await screen.findByText('Acesso restrito')
  await act(async () => resolve(json({ items: [{ id: 'late', title: 'Late private response' }] })))
  expect(screen.queryByText('Late private response')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Desconsiderados' })).not.toBeInTheDocument()
})

it('does not restore an old identity when refresh finishes after a new login', async () => {
  let resolve!: (response: Response) => void
  installFetch({ lateRefresh: new Promise<Response>(done => { resolve = done }) })
  mount()
  fireEvent.click(screen.getByText('Refresh'))
  fireEvent.click(screen.getByText('Login member'))
  await screen.findByText('Acesso restrito')
  await act(async () => resolve(json({ accessToken: 'ADMIN' })))
  expect(screen.getByText('MEMBER')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Desconsiderados' })).not.toBeInTheDocument()
})
