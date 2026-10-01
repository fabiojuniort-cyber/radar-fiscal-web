import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import appSource from './App.tsx?raw'
import authSource from './auth-session.tsx?raw'
import mainSource from './main.tsx?raw'
import { selectFeaturedStates } from './content'
import { parseDemoAccessFlag } from './demo-access'
import { STATE_CAROUSEL_AUTOPLAY_MS } from './public-experience'
import type { PublicPublication, PublicSource } from './public-api'

const strongTestPassword = ['Senha', 'Segura', '2026!'].join('-')

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

function publicationsResponse(items: PublicPublication[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse()))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
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

  it('creates a real account only after backend confirmation and routes to login with the email filled', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/auth/register') {
        return {
          status: 201,
          json: async () => ({
            user: {
              id: 'user-signup',
              email: 'nova.pessoa@example.com',
              name: 'Nova Pessoa',
            },
            tenant: {
              id: 'tenant-signup',
              name: 'Empresa Nova',
              slug: 'empresa-nova-abc',
            },
            membership: { role: 'OWNER' },
            next: 'LOGIN',
          }),
        } as Response
      }

      return sourcesResponse()
    })

    vi.stubGlobal('fetch', fetchMock)
    renderApp('/como-funciona')

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Nome completo'), {
      target: { value: 'Nova Pessoa' },
    })
    fireEvent.change(within(dialog).getByLabelText('E-mail corporativo'), {
      target: { value: 'nova.pessoa@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Empresa Nova' },
    })
    fireEvent.change(within(dialog).getByLabelText('CNPJ'), {
      target: { value: '12.345.678/0001-95' },
    })
    fireEvent.change(within(dialog).getByLabelText('Senha'), {
      target: { value: strongTestPassword },
    })
    fireEvent.change(within(dialog).getByLabelText('Confirmar senha'), {
      target: { value: strongTestPassword },
    })
    fireEvent.click(within(dialog).getByLabelText(/Aceite dos Termos/))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    ))

    await screen.findByRole('heading', { name: 'Entrar na TriBusca' })
    expect(screen.getByRole('status')).toHaveTextContent('Conta criada com sucesso')
    expect(screen.getByLabelText('E-mail')).toHaveValue('nova.pessoa@example.com')
  })

  it('opens the published legal documents from signup consent', () => {
    vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse()))
    renderApp('/')

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    const signupDialog = screen.getByRole('dialog', {
      name: 'Criar conta',
    })
    fireEvent.click(
      within(signupDialog).getByRole('button', {
        name: 'Termos de uso',
      }),
    )

    expect(
      screen.getByRole('dialog', {
        name: 'Termos de Uso da TriBusca',
      }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Fechar',
      }),
    )

    fireEvent.click(
      within(signupDialog).getByRole('button', {
        name: 'Política de privacidade',
      }),
    )

    expect(
      screen.getByRole('dialog', {
        name: 'Política de Privacidade da TriBusca',
      }),
    ).toBeInTheDocument()
  })

  it('shows a duplicate-email state and does not claim signup success', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/auth/register') {
        return {
          status: 409,
          json: async () => ({
            error: 'email_already_registered',
          }),
        } as Response
      }

      return sourcesResponse()
    })

    vi.stubGlobal('fetch', fetchMock)
    renderApp('/como-funciona')

    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    const dialog = screen.getByRole('dialog')

    fireEvent.change(within(dialog).getByLabelText('Nome completo'), {
      target: { value: 'Pessoa Existente' },
    })
    fireEvent.change(within(dialog).getByLabelText('E-mail corporativo'), {
      target: { value: 'existente@example.com' },
    })
    fireEvent.change(within(dialog).getByLabelText('Empresa'), {
      target: { value: 'Empresa Existente' },
    })
    fireEvent.change(within(dialog).getByLabelText('Senha'), {
      target: { value: strongTestPassword },
    })
    fireEvent.change(within(dialog).getByLabelText('Confirmar senha'), {
      target: { value: strongTestPassword },
    })
    fireEvent.click(within(dialog).getByLabelText(/Aceite dos Termos/))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Este e-mail já está cadastrado',
    )
    expect(within(dialog).getByRole('heading', { name: 'Criar conta' })).toBeInTheDocument()
    expect(within(dialog).queryByText(/Conta criada com sucesso/)).not.toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-login-value' } })
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
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'test-login-value' } })
    fireEvent.click(screen.getByRole('dialog').querySelector('button[type="submit"]')!)

    await waitFor(
      () => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/auth/me',
          expect.objectContaining({
            credentials: 'include',
          }),
        )
      },
      { timeout: 3000 },
    )
    await screen.findByRole(
      'heading',
      { name: 'Olá, owner.' },
      { timeout: 3000 },
    )
    expect(screen.getByRole('button', { name: 'Selecionar empresa ativa' })).toBeInTheDocument()
    expect(screen.queryByText('Conta autenticada')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ credentials: 'include' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menu do usuário' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))
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
    expect(screen.queryByRole('heading', { name: /Olá,/ })).not.toBeInTheDocument()
  })

  it('keeps São Paulo first and returns five carousel states', () => {
    const selected = selectFeaturedStates(() => 0.42)

    expect(selected).toHaveLength(5)
    expect(selected[0].uf).toBe('SP')
    expect(new Set(selected.map((state) => state.uf)).size).toBe(5)
  })

  it('WEB-16-R1 autoplays after 15s, pauses on hover and resumes on mouse leave', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    renderApp()
    const carousel = screen.getByTestId('state-carousel')
    const position = screen.getByTestId('state-carousel-position')

    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS)
    })
    expect(position).toHaveTextContent('2 / 5')

    fireEvent.mouseEnter(carousel)
    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS * 2)
    })
    expect(position).toHaveTextContent('2 / 5')

    fireEvent.mouseLeave(carousel)
    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS)
    })
    expect(position).toHaveTextContent('3 / 5')
  })

  it('WEB-16-R1 disables autoplay when reduced motion is preferred', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    renderApp()
    const carousel = screen.getByTestId('state-carousel')
    const position = screen.getByTestId('state-carousel-position')

    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS * 3)
    })
    expect(position).toHaveTextContent('1 / 5')

    fireEvent.click(screen.getByRole('button', { name: 'Próximo estado' }))
    expect(position).toHaveTextContent('2 / 5')
  })

  it('WEB-20 renders real latest captures and shows a neutral empty state when a state has no recent publications', async () => {
    const realFederal: PublicPublication = {
      id: 'pub-fed-1',
      title: 'Ato federal coletado de verdade',
      actType: 'INSTRUÇÃO NORMATIVA',
      actNumber: '123/2026',
      agency: 'RFB',
      uf: null,
      publishedOn: '2026-09-30',
      effectiveOn: null,
      officialUrl: 'https://example.test/federal',
    }
    const realState: PublicPublication = {
      ...realFederal,
      id: 'pub-sp-1',
      title: 'Publicação estadual real de São Paulo',
      actType: 'PORTARIA',
      actNumber: '45/2026',
      uf: 'SP',
      officialUrl: 'https://example.test/sp',
    }

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('/public/v1/sources')) {
        return sourcesResponse([
          {
            code: 'doe-sp',
            name: 'DOE-SP',
            jurisdictionLevel: 'STATE',
            uf: 'SP',
            isActive: true,
            status: 'ONLINE',
            lastRunStatus: 'SUCCESS',
            lastSuccessAt: new Date().toISOString(),
            lastAttemptAt: new Date().toISOString(),
            importedToday: 1,
            totalPublications: 1,
          },
        ])
      }

      if (url.includes('/public/v1/publications')) {
        const parsed = new URL(url, 'https://tribusca.test')
        const uf = parsed.searchParams.get('uf')
        if (uf === 'SP') return publicationsResponse([realState])
        if (uf) return publicationsResponse([])
        return publicationsResponse([realFederal])
      }

      return sourcesResponse()
    }))

    renderApp()

    await waitFor(() => expect(screen.getByText('Ato federal coletado de verdade')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByText('Publicação estadual real de São Paulo')).toBeInTheDocument())
    expect(screen.queryByText(/Exemplo de captura/)).not.toBeInTheDocument()

    const stateTabs = screen.getAllByRole('tab', { name: /^Exibir / })
    fireEvent.click(stateTabs[1])

    await waitFor(() => {
      const card = screen.getByText(/Últimas publicações/).closest('.ref-state-publications-card')
      expect(card).toHaveTextContent('Nenhuma publicação recente disponível.')
    })
  })

  it('WEB-18 supports swipe, arrows and UF pills while keeping São Paulo first', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    renderApp()
    const carousel = screen.getByTestId('state-carousel')
    const position = screen.getByTestId('state-carousel-position')

    expect(within(carousel).getByText('SP')).toBeInTheDocument()

    fireEvent.touchStart(carousel, { touches: [{ clientX: 260, clientY: 200 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 120, clientY: 205 }] })
    expect(position).toHaveTextContent('2 / 5')

    fireEvent.touchStart(carousel, { touches: [{ clientX: 120, clientY: 200 }] })
    fireEvent.touchEnd(carousel, { changedTouches: [{ clientX: 270, clientY: 204 }] })
    expect(position).toHaveTextContent('1 / 5')

    fireEvent.click(screen.getByRole('button', { name: 'Próximo estado' }))
    expect(position).toHaveTextContent('2 / 5')
    fireEvent.click(screen.getByRole('button', { name: 'Estado anterior' }))
    expect(position).toHaveTextContent('1 / 5')

    const ufPills = screen.getAllByRole('tab', { name: /^Exibir / })
    fireEvent.click(ufPills[2])
    expect(position).toHaveTextContent('3 / 5')
  })

  it('WEB-18 shows Verificando… while federal coverage is loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)))
    renderApp()

    expect(screen.getAllByText('Verificando…')).toHaveLength(6)
  })

  it('WEB-16-R1 shows ONLINE state coverage from /public/v1/sources', async () => {
    const items: PublicSource[] = [{
      code: 'doe-sp',
      name: 'Diário Oficial do Estado de São Paulo',
      jurisdictionLevel: 'STATE',
      uf: 'SP',
      isActive: true,
      status: 'ONLINE',
      lastRunStatus: 'SUCCESS',
      lastSuccessAt: '2026-09-29T09:00:00.000Z',
      lastAttemptAt: '2026-09-29T09:00:00.000Z',
      importedToday: 4,
      totalPublications: 123,
    }]
    vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse(items)))

    renderApp()

    await waitFor(() => {
      expect(screen.getByTestId('state-carousel-status')).toHaveTextContent('Online')
    })
  })

  it('WEB-16-R1 keeps a state without a source as Ainda não consultada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sourcesResponse([])))

    renderApp()

    await waitFor(() => {
      expect(screen.getByTestId('state-carousel-status')).toHaveTextContent('Ainda não consultada')
    })
    expect(screen.getByTestId('state-carousel-status')).not.toHaveTextContent('Online')
  })

  it('WEB-16-R1 shows unknown state coverage when /public/v1/sources fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('public sources unavailable')
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByTestId('state-carousel-status')).toHaveTextContent('—')
  })

  it('exposes individually named carousel controls', () => {
    renderApp()

    const stateButtons = screen.getAllByRole('tab', { name: /^Exibir / })
    expect(stateButtons).toHaveLength(5)
    expect(new Set(stateButtons.map((button) => button.getAttribute('aria-label'))).size).toBe(5)
    expect(screen.getByRole('button', { name: 'Estado anterior' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo estado' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pausar' })).toBeInTheDocument()
  })

  it('WEB-18 pauses and resumes the state carousel on explicit control', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    renderApp()
    const position = screen.getByTestId('state-carousel-position')
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }))
    expect(screen.getByRole('button', { name: 'Reproduzir' })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS * 2)
    })
    expect(position).toHaveTextContent('1 / 5')

    fireEvent.click(screen.getByRole('button', { name: 'Reproduzir' }))
    act(() => {
      vi.advanceTimersByTime(STATE_CAROUSEL_AUTOPLAY_MS)
    })
    expect(position).toHaveTextContent('2 / 5')
  })

  it('uses the official light footer signature without CSS recoloring', () => {
    renderApp()

    const footerLogo = screen.getAllByRole('img', { name: 'TriBusca' }).at(-1)
    expect(footerLogo).toHaveAttribute('src', '/brand/tribusca-logo-horizontal-light.png')
  })

  it('keeps text labels for every Sonar level', () => {
    renderApp('/portfolio')

    expect(screen.getByText(/Alta.*sinal próximo ao centro/)).toBeInTheDocument()
    expect(screen.getByText(/Média.*distância intermediária/)).toBeInTheDocument()
    expect(screen.getByText(/Baixa.*sinal distante/)).toBeInTheDocument()
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
    await waitFor(() => expect(within(douCard as HTMLElement).getByText('Coleta Online')).toBeInTheDocument())
    expect(within(douCard as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(douCard as HTMLElement).getByText('517')).toBeInTheDocument()

    const spCard = screen.getByText('São Paulo / SP').closest('.coverage-card')
    expect(spCard).not.toBeNull()
    await waitFor(() => expect(within(spCard as HTMLElement).getByText('Coleta Em validação')).toBeInTheDocument())
    expect(within(spCard as HTMLElement).getByText('0')).toBeInTheDocument()
    expect(within(spCard as HTMLElement).getByText('91')).toBeInTheDocument()
  })

  it('keeps planned-but-absent Coverage sources as Ainda não consultada after a successful response', async () => {
    renderApp('/cobertura')

    await waitFor(() => expect(screen.getAllByText('Coleta Ainda não consultada').length).toBeGreaterThan(20))
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
    const coverageCards = document.querySelectorAll('.coverage-card')
    for (const card of coverageCards) {
      expect(card).not.toHaveTextContent('Ainda não consultada')
    }
    expect(screen.getAllByText('—').length).toBeGreaterThan(20)
  })

  it('shows only released availability badges on the Home portfolio', () => {
    renderApp()

    expect(screen.getAllByText('Disponível')).toHaveLength(2)
    expect(screen.queryByText('Em desenvolvimento')).not.toBeInTheDocument()
  })

  it('shows the same factual availability on the portfolio page', () => {
    renderApp('/portfolio')

    expect(screen.getAllByText('Disponível')).toHaveLength(2)
    expect(screen.queryByText('Em desenvolvimento')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Acervo' })).toHaveAttribute('href', '#acervo')
    expect(screen.getByRole('link', { name: 'Central de Monitoramento' })).toHaveAttribute('href', '#monitoramento')
    expect(screen.getByRole('link', { name: 'Sonar' })).toHaveAttribute('href', '#sonar')
    expect(screen.getByRole('link', { name: 'Revela' })).toHaveAttribute('href', '#revela')
    expect(screen.getByRole('link', { name: 'Decodifica' })).toHaveAttribute('href', '#decodifica')
    expect(screen.getByRole('link', { name: 'Perfil Tributário' })).toHaveAttribute('href', '#perfil')
  })

  it('renders the five approved Decodifica examples as a carousel', () => {
    renderApp('/portfolio')

    expect(screen.getByText(/Split payment/)).toBeInTheDocument()
    expect(screen.getByText('1 / 5')).toBeInTheDocument()
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
        name: 'Saiba o que mudou. Entenda o que importa. Cheque à fonte oficial.',
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
        name: 'Saiba o que mudou. Entenda o que importa. Cheque à fonte oficial.',
      })).toBeInTheDocument()
    })
    const requestedUrls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(requestedUrls.some((url) => url.includes('/auth/logout'))).toBe(false)
    expect(requestedUrls.filter((url) => /\/auth\/(?:me|refresh|logout)/.test(url))).toEqual([])
  })
})
