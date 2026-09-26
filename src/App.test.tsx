import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import App from './App'
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
