import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import mainSource from './main.tsx?raw'
import { selectFeaturedStates } from './content'
import type { PublicSource } from './public-api'

function sourcesResponse(items: PublicSource[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      generatedAt: '2026-09-28T14:00:00.000Z',
      items,
    }),
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse()))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderApp(route = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TriBusca release candidate WEB-11', () => {
  it('renders the approved public navigation', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'Cobertura' })).toHaveAttribute('href', '/cobertura')
    expect(screen.getByRole('link', { name: 'Portfólio' })).toHaveAttribute('href', '/portfolio')
    expect(screen.getByRole('link', { name: 'Como funciona' })).toHaveAttribute('href', '/como-funciona')
    expect(screen.getByRole('link', { name: 'Reforma Tributária' })).toHaveAttribute('href', '/reforma-tributaria')
  })

  it('applies D-054 to public signup and trial surfaces', () => {
    renderApp()

    expect(screen.queryByRole('button', { name: 'Criar conta' })).not.toBeInTheDocument()
    expect(screen.queryByText(/7 dias para conhecer/i)).not.toBeInTheDocument()
    expect(screen.getAllByLabelText('Cadastro em breve').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Cadastro em breve.')).toBeInTheDocument()
  })

  it('keeps login available while signup and password recovery remain unavailable', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar na TriBusca' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Esqueci minha senha' })).not.toBeInTheDocument()
    expect(screen.getByText('Recuperação de senha em breve.')).toBeInTheDocument()
    expect(screen.getByText('Cadastro em breve.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Criar conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Nova senha' })).not.toBeInTheDocument()
  })

  it('preserves the real login contract without browser token storage', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_credentials' }),
    } as Response))
    vi.stubGlobal('fetch', fetchMock)

    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'teste@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
  })

  it('keeps São Paulo first and returns five carousel states', () => {
    const selected = selectFeaturedStates(() => 0.42)

    expect(selected).toHaveLength(5)
    expect(selected[0].uf).toBe('SP')
    expect(new Set(selected.map((state) => state.uf)).size).toBe(5)
  })

  it('exposes individually named carousel controls', () => {
    renderApp()

    const stateButtons = screen.getAllByRole('button', { name: /^Exibir / })
    expect(stateButtons).toHaveLength(5)
    expect(new Set(stateButtons.map((button) => button.getAttribute('aria-label'))).size).toBe(5)
    expect(screen.getByRole('button', { name: 'Estado anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo estado' })).toBeInTheDocument()
  })

  it('uses the official dark footer signature without CSS recoloring', () => {
    renderApp()

    const footerLogo = screen.getAllByRole('img', { name: 'TriBusca' }).at(-1)
    expect(footerLogo).toHaveAttribute('src', '/brand/tribusca-logo-horizontal-dark.png')
  })

  it('keeps text labels for every Sonar level', () => {
    renderApp('/portfolio')

    expect(screen.getAllByText('Alta afinidade').length).toBeGreaterThan(0)
    expect(screen.getByText('Média afinidade')).toBeInTheDocument()
    expect(screen.getByText('Baixa afinidade')).toBeInTheDocument()
  })

  it('self-hosts only the approved Inter weights used by the interface', () => {
    for (const weight of [400, 700, 800, 900]) {
      expect(mainSource).toContain(`@fontsource/inter/${weight}.css`)
    }
  })

  it('renders real Coverage data from /public/v1/sources and translates statuses', async () => {
    const items: PublicSource[] = [
      {
        code: 'dou',
        name: 'DOU — Diário Oficial da União (INLABS)',
        jurisdictionLevel: 'FEDERAL',
        uf: null,
        isActive: true,
        status: 'ONLINE',
        lastRunStatus: 'SUCCESS',
        lastSuccessAt: '2026-09-28T13:30:00.000Z',
        lastAttemptAt: '2026-09-28T13:30:00.000Z',
        importedToday: 3,
        totalPublications: 517,
      },
      {
        code: 'doe-sp',
        name: 'Diário Oficial do Estado de São Paulo',
        jurisdictionLevel: 'STATE',
        uf: 'SP',
        isActive: true,
        status: 'UNAVAILABLE',
        lastRunStatus: 'FETCH_FAILED',
        lastSuccessAt: '2026-09-27T12:00:00.000Z',
        lastAttemptAt: '2026-09-28T13:40:00.000Z',
        importedToday: 0,
        totalPublications: 91,
      },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse(items)))

    renderApp('/cobertura')

    const douCard = screen.getByText('DOU / INLABS').closest('.coverage-card')
    expect(douCard).not.toBeNull()
    await waitFor(() => expect(within(douCard as HTMLElement).getByText('Online')).toBeInTheDocument())
    expect(within(douCard as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(douCard as HTMLElement).getByText('517')).toBeInTheDocument()

    const spCard = screen.getByText('São Paulo / SP').closest('.coverage-card')
    expect(spCard).not.toBeNull()
    await waitFor(() => expect(within(spCard as HTMLElement).getByText('Em validação')).toBeInTheDocument())
    expect(within(spCard as HTMLElement).getByText('0')).toBeInTheDocument()
    expect(within(spCard as HTMLElement).getByText('91')).toBeInTheDocument()
  })

  it('keeps planned-but-absent Coverage sources as Em implantação after a successful response', async () => {
    renderApp('/cobertura')

    await waitFor(() => expect(screen.getAllByText('Em implantação').length).toBeGreaterThan(20))
    const stateCards = screen.getAllByTestId('state-coverage-card')
    expect(stateCards).toHaveLength(27)
    expect(stateCards[0]).toHaveTextContent('São Paulo / SP')
  })

  it('keeps Coverage unknown when the public API fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network unavailable')
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/cobertura')

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Online')).not.toBeInTheDocument()
    expect(screen.queryByText('Em implantação')).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(20)
  })

  it('does not claim portfolio resources as available before release', () => {
    renderApp()

    expect(screen.queryByText('Disponível')).not.toBeInTheDocument()
    expect(screen.getAllByText('Em desenvolvimento')).toHaveLength(6)
  })

  it('keeps the same development status on the portfolio page', () => {
    renderApp('/portfolio')

    expect(screen.queryByText('Disponível')).not.toBeInTheDocument()
    expect(screen.getAllByText('Em desenvolvimento')).toHaveLength(6)
  })

  it('renders the five approved Decodifica examples as a carousel', () => {
    renderApp('/portfolio')

    expect(screen.getByText('Split payment')).toBeInTheDocument()
    expect(screen.getByText('Exemplo 1 de 5')).toBeInTheDocument()
    expect(screen.getByText('Gerada por IA. Não substitui o texto oficial.')).toBeInTheDocument()
  })
})
