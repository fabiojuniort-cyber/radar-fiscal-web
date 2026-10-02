import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ArchiveDateBridge } from './archive-date-bridge'

describe('ArchiveDateBridge', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.replaceState({}, '', '/painel')
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })
    document.body.innerHTML = `
      <main class="tp-main-acervo">
        <div class="tp-page-numbers">
          <button type="button">1</button>
          <button type="button" aria-current="page">2</button>
        </div>
        <aside class="tp-filter-panel"><button type="button">Limpar filtros</button></aside>
        <div class="tp-acervo-layout"></div>
      </main>
    `
  })

  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('mounts inside Acervo, persists a selected date and resets pagination only after a change', async () => {
    const pageOne = screen.getByRole('button', { name: '1' })
    const pageOneClick = vi.fn()
    pageOne.addEventListener('click', pageOneClick)

    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({ screen: 'acervo', archivePage: 2 }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ArchiveDateBridge />
      </QueryClientProvider>,
    )

    await screen.findByRole('region', { name: 'Filtro por data de publicação' })
    expect(pageOneClick).not.toHaveBeenCalled()

    const input = screen.getByLabelText('Data')
    fireEvent.change(input, { target: { value: '2024-06-15' } })

    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem('tribusca.archive.date') ?? '{}')
      expect(stored.mode).toBe('single')
      expect(stored.singleDate).toBe('2024-06-15')
      expect(new URL(window.location.href).searchParams.get('date')).toBe('2024-06-15')
      expect(pageOneClick).toHaveBeenCalled()
      const panel = JSON.parse(sessionStorage.getItem('tribusca.panel.state') ?? '{}')
      expect(panel.archivePage).toBe(1)
    })
  })

  it.each([
    { label: 'De:', from: '', to: '2024-06-20' },
    { label: 'Até:', from: '2024-06-15', to: '' },
  ])('clearing only $label preserves the opposite endpoint in the UI, URL and storage', async ({ label, from, to }) => {
    window.history.replaceState({}, '', '/painel?range=1&from=2024-06-15&to=2024-06-20')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ArchiveDateBridge />
      </QueryClientProvider>,
    )

    fireEvent.change(await screen.findByLabelText(label), { target: { value: '' } })

    await waitFor(() => {
      expect(screen.getByLabelText('De:')).toHaveValue(from)
      expect(screen.getByLabelText('Até:')).toHaveValue(to)
      expect(screen.getByRole('checkbox', { name: 'Intervalo' })).toBeChecked()
      const params = new URL(window.location.href).searchParams
      expect(params.get('range')).toBe('1')
      expect(params.get('from')).toBe(from || null)
      expect(params.get('to')).toBe(to || null)
      expect(JSON.parse(sessionStorage.getItem('tribusca.archive.date') ?? '{}'))
        .toMatchObject({ mode: 'range', from, to })
    })
  })

  it.each(['Limpar data', 'Limpar filtros'])('%s clears both range endpoints and the saved single date', async (action) => {
    sessionStorage.setItem(
      'tribusca.archive.date',
      JSON.stringify({ mode: 'range', singleDate: '2024-06-15', from: '2024-06-15', to: '2024-06-20' }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ArchiveDateBridge />
      </QueryClientProvider>,
    )

    await screen.findByLabelText('Até:')
    fireEvent.click(screen.getByRole('button', { name: action }))

    await waitFor(() => {
      expect(screen.getByLabelText('De:')).toHaveValue('')
      expect(screen.getByLabelText('Até:')).toHaveValue('')
      const params = new URL(window.location.href).searchParams
      for (const key of ['date', 'from', 'to']) expect(params.has(key)).toBe(false)
      expect(JSON.parse(sessionStorage.getItem('tribusca.archive.date') ?? '{}'))
        .toMatchObject({ singleDate: '', from: '', to: '' })
    })
  })

  it('clears the date together with the Acervo Limpar filtros action', async () => {
    sessionStorage.setItem(
      'tribusca.archive.date',
      JSON.stringify({ mode: 'single', singleDate: '2024-06-15', from: '', to: '' }),
    )

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ArchiveDateBridge />
      </QueryClientProvider>,
    )

    await screen.findByDisplayValue('2024-06-15')
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    await waitFor(() => {
      const stored = JSON.parse(sessionStorage.getItem('tribusca.archive.date') ?? '{}')
      expect(stored.singleDate).toBe('')
      expect(new URL(window.location.href).searchParams.has('date')).toBe(false)
    })
  })
})
