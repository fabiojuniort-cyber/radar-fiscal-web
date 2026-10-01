import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NewsSection } from './news-section'
import type { ProductApiFetch } from './product-api'

afterEach(() => {
  cleanup()
})

function renderNews(apiFetch: ProductApiFetch) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <NewsSection apiFetch={apiFetch} />
    </QueryClientProvider>,
  )
}

describe('NewsSection', () => {
  it('renders official tax news and sends the applied search to the API', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      return new Response(
        JSON.stringify({
          items: [{
            id: 'news-1',
            sourceCode: 'rfb-news',
            sourceName: 'Receita Federal — Notícias',
            agency: 'RFB',
            title: 'Receita Federal orienta sobre IBS e CBS',
            summary: 'Conteúdo tributário oficial selecionado pelo TriBusca.',
            category: 'Tributação',
            publishedAt: '2026-10-01T12:00:00.000Z',
            updatedAt: null,
            officialUrl: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/exemplo-ibs-cbs',
            tags: ['IBS', 'CBS'],
          }],
          page: 1,
          limit: 20,
          totalItems: 1,
          totalPages: 1,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      )
    }) as ProductApiFetch

    renderNews(apiFetch)

    expect(
      await screen.findByRole('heading', {
        name: 'Receita Federal orienta sobre IBS e CBS',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Conteúdo tributário oficial selecionado pelo TriBusca.'),
    ).toBeInTheDocument()
    expect(screen.getByText('IBS')).toBeInTheDocument()
    expect(screen.getByText('CBS')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Abrir notícia oficial/ }),
    ).toHaveAttribute(
      'href',
      'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/exemplo-ibs-cbs',
    )

    fireEvent.change(screen.getByLabelText('Buscar notícias'), {
      target: { value: 'split payment' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Buscar notícias' }),
    )

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/v1/news?q=split+payment&page=1&limit=20',
      )
    })
  })
})
