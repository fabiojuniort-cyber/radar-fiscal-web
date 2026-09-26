import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('TriBusca public site', () => {
  it('renders the approved home proposition', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Saiba o que mudou. Entenda o que importa. Chegue à fonte oficial.',
      }),
    ).toBeInTheDocument()
  })

  it('renders the portfolio concepts approved in PROD-01', () => {
    render(
      <MemoryRouter initialEntries={['/portfolio']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('Média afinidade')).toBeInTheDocument()
    expect(screen.getByText('Baixa afinidade')).toBeInTheDocument()
    expect(screen.getByText('Menção direta')).toBeInTheDocument()
    expect(screen.getByText('Traduzido')).toBeInTheDocument()
    expect(screen.getByText('Tradução desatualizada')).toBeInTheDocument()
  })

  it('renders the Reforma Tributária thematic page', () => {
    render(
      <MemoryRouter initialEntries={['/reforma-tributaria']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', {
        name: 'Um ponto único para acompanhar a transformação do sistema tributário.',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Notas técnicas')).toBeInTheDocument()
  })
})
