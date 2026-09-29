import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import appSource from './App.tsx?raw'
import authSource from './auth-session.tsx?raw'
import mainSource from './main.tsx?raw'
import { selectFeaturedStates } from './content'
import { parseDemoAccessFlag } from './demo-access'
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
  vi.unstubAllEnvs()
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

  it('WEB-16 activates public signup surfaces by product-owner decision', () => {
    renderApp()

    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getAllByText(/7 dias para conhecer/i).length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Cadastro em breve')).not.toBeInTheDocument()
  })

  it('keeps login real and exposes the signup form without inventing a signup endpoint', () => {
    const fetchMock = vi.fn(async () => sourcesResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/como-funciona')

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Nome completo')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('E-mail corporativo')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Empresa')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('CNPJ')).toBeInTheDocument()
    expect(within(dialog).getByText(/O formulário está ativo no pré-login/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('preserves the real login contract without browser token storage', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_credentials' }),
    } as Response))
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/como-funciona')
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0])
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'teste@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Senha123!' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0])

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith('/auth/login', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
    }))
  })

  it('does not store auth tokens in localStorage', () => {
    expect(appSource).not.toContain('localStorage')
    expect(authSource).not.toContain('localStorage')
  })

  it('opens a real authenticated panel and logs out through the backend', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/auth/login') return { ok: true, json: async () => ({ accessToken: 'test-access-token' }) } as Response
      if (url === '/auth/me') return { ok: true, json: async () => ({
        user: { id: 'user-test', email: 'owner@example.test', name: null },
        memberships: [{ tenantId: 'tenant-test', tenantName: 'TriBusca Internal', tenantSlug: 'tribusca-internal', role: 'OWNER' }],
      }) } as Response
      if (url === '/auth/logout') return { ok: true, status: 204 } as Response
      throw new Error(`Unexpected request: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/como-funciona')
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0])
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'owner@example.test' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Only-For-Test-2026!' } })
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!)

    await screen.findByRole('heading', { name: 'Bom dia, owner.' })
    expect(screen.getByText('TriBusca Internal')).toBeInTheDocument()
    expect(screen.getByText('Conta autenticada')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ credentials: 'include' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({
      method: 'POST', credentials: 'include',
      headers: expect.objectContaining({ 'x-csrf-protection': '1' }),
    })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Entrar' }).length).toBeGreaterThan(0))
  })

  it('requires a valid refresh cookie before showing the panel on a direct visit', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: 'invalid_refresh_token' }) } as Response))
    vi.stubGlobal('fetch', fetchMock)
    renderApp('/painel')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/auth/refresh', expect.objectContaining({
      method: 'POST', credentials: 'include',
      headers: { 'x-csrf-protection': '1' },
    })))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Entrar' }).length).toBeGreaterThan(0))
    expect(screen.queryByRole('heading', { name: /Bom dia,/ })).not.toBeInTheDocument()
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

    expect(screen.getByText(/Split payment/)).toBeInTheDocument()
    expect(screen.getByText('Exemplo 1 de 5')).toBeInTheDocument()
    expect(screen.getByText('Gerada por IA. Não substitui o texto oficial.')).toBeInTheDocument()
  })
})


describe('WEB-14 — acesso temporário ao painel demonstrativo', () => {
  it('aceita somente o valor literal true na feature flag', () => {
    expect(parseDemoAccessFlag('true')).toBe(true)
    expect(parseDemoAccessFlag(undefined)).toBe(false)
    expect(parseDemoAccessFlag(null)).toBe(false)
    expect(parseDemoAccessFlag(false)).toBe(false)
    expect(parseDemoAccessFlag('false')).toBe(false)
    expect(parseDemoAccessFlag('TRUE')).toBe(false)
    expect(parseDemoAccessFlag('1')).toBe(false)
    expect(parseDemoAccessFlag(' true ')).toBe(false)
  })

  it('não renderiza o acesso demo quando a flag está desligada', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ACCESS', 'false')
    renderApp()

    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0])
    expect(screen.queryByRole('button', { name: 'Entrar em modo demonstração' })).not.toBeInTheDocument()
  })

  it('redireciona /painel-demo quando a flag está desligada', async () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ACCESS', 'false')
    renderApp('/painel-demo')

    await waitFor(() => {
      expect(screen.getByRole('heading', {
        name: 'Saiba o que mudou. Entenda o que importa. Chegue à fonte oficial.',
      })).toBeInTheDocument()
    })
    expect(screen.queryByText('Modo demonstração')).not.toBeInTheDocument()
  })

  it('entra no painel demo sem chamar login ou qualquer endpoint', async () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ACCESS', 'true')
    const fetchMock = vi.fn(async () => sourcesResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/como-funciona')
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0])

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Entrar em modo demonstração' })).toBeInTheDocument()
    expect(within(dialog).getByText('Acesso temporário para navegação e validação da interface.')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar em modo demonstração' }))

    await waitFor(() => expect(screen.getAllByText('Modo demonstração').length).toBeGreaterThan(0))
    expect(screen.getByText('Dados exibidos nesta área são demonstrativos.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('mantém o shell demonstrativo em estado React local e sem dados privados', () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ACCESS', 'true')
    renderApp('/painel-demo')

    for (const section of [
      'Início',
      'Publicações',
      'Acervo',
      'Reforma Tributária',
      'Central de Monitoramento',
      'Fontes Oficiais',
      'Empresas',
    ]) {
      expect(screen.getByRole('button', { name: section })).toBeInTheDocument()
    }

    expect(screen.getAllByText('Demonstração').length).toBeGreaterThanOrEqual(6)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(6)

    fireEvent.click(screen.getByRole('button', { name: 'Publicações' }))
    expect(screen.getByRole('heading', { name: 'Publicações' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Empresas' }))
    expect(screen.getByRole('tab', { name: 'Estabelecimentos' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Perfil Tributário' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Assinatura e pagamento' })).toBeInTheDocument()
  })

  it('sai da demonstração voltando ao site público sem chamar logout', async () => {
    vi.stubEnv('VITE_ENABLE_DEMO_ACCESS', 'true')
    const fetchMock = vi.fn(async (_url: string) => sourcesResponse())
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/painel-demo')
    fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair da demonstração' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', {
        name: 'Saiba o que mudou. Entenda o que importa. Chegue à fonte oficial.',
      })).toBeInTheDocument()
    })
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(requestedUrls.some((url) => url.includes('/auth/logout'))).toBe(false)
    expect(requestedUrls.filter((url) => /\/auth\/(?:me|refresh|logout)/.test(url))).toEqual([])
  })
})
