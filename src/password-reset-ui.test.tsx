import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { PasswordResetPage } from './App'
import { clearPasswordResetToken } from './password-reset-token'

const token = 's'.repeat(43)
const password = 'Senha-Sintetica!123'
afterEach(() => {
  cleanup(); clearPasswordResetToken(); vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

function resetPage() {
  window.history.replaceState(null, '', '/nova-senha#token=' + token)
  const onLogin = vi.fn()
  render(<MemoryRouter><PasswordResetPage onLogin={onLogin} /></MemoryRouter>)
  return onLogin
}
function passwords() {
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmar senha', { exact: true }), { target: { value: password } })
}

describe('AUTH-RESET UI, synthetic scenarios 1–3', () => {
  it('submits the forgot modal and gives only the neutral message', async () => {
    const fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(
      url === '/auth/password/forgot' ? { status: 'if_account_exists' } : { items: [] },
    ), { status: url === '/auth/password/forgot' ? 202 : 200 }))
    vi.stubGlobal('fetch', fetcher)
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><App /></MemoryRouter></QueryClientProvider>)
    fireEvent.click(screen.getAllByRole('button', { name: /^Entrar$/ })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Esqueci minha senha' }))
    fireEvent.change(screen.getByLabelText('E-mail', { exact: true }), { target: { value: 'conta@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar instruções' }))
    expect(await screen.findByText(/Se houver uma conta elegível/)).toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([url]) => url === '/auth/password/forgot')).toHaveLength(1)
  })

  it('cleans the fragment before rendering, without submitting or storing the token', () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    resetPage()
    expect(window.location.hash).toBe('')
    expect(fetcher).not.toHaveBeenCalled()
    expect(document.body.textContent).not.toContain(token)
    expect(JSON.stringify(localStorage)).not.toContain(token)
    expect(JSON.stringify(sessionStorage)).not.toContain(token)
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeDisabled()
  })

  it('validates the shared password rules and returns to login only after 204', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetcher)
    const login = resetPage()
    passwords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    await waitFor(() => expect(login).toHaveBeenCalledOnce())
    expect(fetcher).toHaveBeenCalledWith('/auth/password/reset', expect.objectContaining({ body: JSON.stringify({ token, password, confirmPassword: password }) }))
  })

  it.each(['invalid', 'expired', 'used'])('shows the same safe message for a %s link', async reason => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: reason }), { status: 400 })))
    const login = resetPage(); passwords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('inválido, expirou ou já foi usado')
    expect(login).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeDisabled()
  })

  it('honours the retry delay and does not render server details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'synthetic-internal-detail' }), { status: 429, headers: { 'Retry-After': '30' } })))
    resetPage(); passwords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('button', { name: 'Aguarde 30s' })).toBeDisabled()
    expect(document.body.textContent).not.toContain('synthetic-internal-detail')
  })

  it.each([503, 500])('keeps HTTP %s generic and stays on the form', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'synthetic-internal-detail' }), { status })))
    const login = resetPage(); passwords()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 503 ? 'temporariamente indisponível' : 'Não foi possível concluir')
    expect(document.body.textContent).not.toContain('synthetic-internal-detail')
    expect(login).not.toHaveBeenCalled()
  })
})
