import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import App from './App'
import mainSource from './main.tsx?raw'
import styles from './styles.css?raw'
import { selectFeaturedStates } from './content'

afterEach(() => cleanup())

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

describe('TriBusca WEB-02', () => {
  it('renders the approved public navigation', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'Cobertura' })).toHaveAttribute('href', '/cobertura')
    expect(screen.getByRole('link', { name: 'Portfólio' })).toHaveAttribute('href', '/portfolio')
    expect(screen.getByRole('link', { name: 'Como funciona' })).toHaveAttribute('href', '/como-funciona')
    expect(screen.getByRole('link', { name: 'Reforma Tributária' })).toHaveAttribute('href', '/reforma-tributaria')
  })

  it('opens access in a modal', () => {
    renderApp()

    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Entrar na TriBusca' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Esqueci minha senha' })).toBeInTheDocument()
  })

  it('validates password requirements in real time', () => {
    renderApp()

    fireEvent.click(screen.getAllByRole('button', { name: 'Criar conta' })[0])
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'Abcdef1!' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'Abcdef1!' } })

    expect(screen.getByLabelText('Mínimo de 8 caracteres: atendido')).toBeInTheDocument()
    expect(screen.getByLabelText('Uma letra maiúscula: atendido')).toBeInTheDocument()
    expect(screen.getByLabelText('Uma letra minúscula: atendido')).toBeInTheDocument()
    expect(screen.getByLabelText('Um número: atendido')).toBeInTheDocument()
    expect(screen.getByLabelText('Um caractere especial: atendido')).toBeInTheDocument()
    expect(screen.getByLabelText('As senhas coincidem: atendido')).toBeInTheDocument()
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
    expect(styles).not.toMatch(/\.footer-logo\s*\{[^}]*filter:/s)
  })

  it('locks WEB-05 accessibility and Sonar contrast tokens', () => {
    expect(styles).toMatch(/\.carousel-dots button\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;/s)
    expect(styles).toMatch(/\.carousel-dots button::before\s*\{[^}]*background:\s*#607086;/s)
    expect(styles).toContain('border: 1px solid #74859a;')
    expect(styles).toMatch(/\.password-rules span\s*\{[^}]*color:\s*#607086;/s)
    expect(styles).toContain('.sonar-medium { --signal-color: #9a6900; }')
    expect(styles).toContain('.sonar-state-low strong { color: #237032; }')
  })

  it('self-hosts only the approved Inter weights used by the interface', () => {
    for (const weight of [400, 700, 800, 900]) {
      expect(mainSource).toContain(`@fontsource/inter/${weight}.css`)
    }
  })

  it('renders federal coverage and all 27 UFs with placeholders', () => {
    renderApp('/cobertura')

    expect(screen.getByText('DOU / INLABS')).toBeInTheDocument()
    const stateCards = screen.getAllByTestId('state-coverage-card')
    expect(stateCards).toHaveLength(27)
    expect(stateCards[0]).toHaveTextContent('São Paulo / SP')
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
