import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollectionFilterAdminPage } from './collection-filter-admin'
import { CollectionFilterDiscards, CollectionFilterDiscardAlerts } from './collection-filter-discards'
import type { ProductApiFetch } from './product-api'

afterEach(cleanup)
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }) }
function mount(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{element}</MemoryRouter></QueryClientProvider>)
}
const discard = {
  id: 'discard-1', source_code: 'dou', connector_key: 'dou-inlabs', section: 'DO1',
  raw_type: 'PORTARIA', canonical_type: 'PORTARIA', title: 'Portaria administrativa', act_number: '42',
  published_on: '2026-10-07', official_url: 'https://www.in.gov.br/ato-42',
  reason_code: 'NO_TAX_TERM', decisive_term: null, policy_version: 1, policy_revision: 5,
  discarded_at: '2026-10-07T14:00:00Z', expires_at: '2027-01-07T14:00:00Z',
}
const alert = {
  id: 'alert-1', collection_run_id: 'run-1', source_code: 'dou', discard_rate: '0.9',
  baseline_rate: '0.4', threshold_rate: '0.65', found_count: 100, discard_count: 90,
  status: 'OPEN', created_at: '2026-10-07T14:00:00Z', acknowledged_at: null,
}

describe('ACT-SCOPE-02: trilha operacional', () => {
  it('exibe contrato de descarte, retenção e link seguro', async () => {
    const fetch = vi.fn(async () => json({ items: [discard],total:1 })) as ProductApiFetch
    mount(<CollectionFilterDiscards apiFetch={fetch} />)
    await screen.findByText(discard.title)
    expect(screen.getByText(/v1 · rev.5/)).toBeInTheDocument()
    expect(screen.getByText(/1 registros/)).toBeInTheDocument()
    expect(screen.getByText('07/10/2026')).toBeInTheDocument()
    expect(screen.getByText('Coleta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir fonte oficial' })).toHaveAttribute('href', discard.official_url)
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('pagina com sentinela e reinicia página ao aplicar filtro de fonte', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); calls.push(url)
      const params = new URL(url, 'https://example.test').searchParams
      return json({ items: params.get('sourceCode') ? [] : params.get('offset') === '0'
        ? Array.from({ length: 50 }, (_, i) => ({ ...discard, id: String(i), title: `Ato ${i}` }))
        : [{ ...discard, id: 'last', title: 'Último ato' }],
        total:params.get('sourceCode')?0:51 })
    }) as ProductApiFetch
    mount(<CollectionFilterDiscards apiFetch={fetch} />)
    await screen.findByText('Ato 49')
    expect(screen.queryByText('Ato 50')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await screen.findByText('Último ato')
    expect(calls.some(url => url.includes('limit=50') && url.includes('offset=50'))).toBe(true)
    fireEvent.change(screen.getByLabelText('Filtrar Fonte'), { target: { value: '  DOU  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }))
    await screen.findByText(/Nenhum documento atende aos filtros/)
    expect(calls.at(-1)).toContain('sourceCode=DOU'); expect(calls.at(-1)).toContain('offset=0')
    expect(screen.getAllByText(/Página 1/).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await screen.findByText('Ato 0')
  })

  it('não abre página fantasma quando existem exatamente 50 registros', async () => {
    const fetch = vi.fn(async () => json({ items: Array.from({ length: 50 }, (_, i) => ({ ...discard, id: String(i) })),total:50 })) as ProductApiFetch
    mount(<CollectionFilterDiscards apiFetch={fetch} />)
    await screen.findAllByText(discard.title)
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
  })

  it('diferencia erro de lista vazia e permite recuperar sem avançar página', async () => {
    let failed = true
    const fetch = vi.fn(async () => failed ? json({ error: 'unavailable' }, 503) : json({ items: [],total:0 })) as ProductApiFetch
    mount(<CollectionFilterDiscards apiFetch={fetch} />)
    await screen.findByRole('alert')
    expect(screen.queryByText(/Nenhum documento atende aos filtros/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar desconsiderados' }))
    await screen.findByText(/Nenhum desconsiderado/)
  })

  it('mostra regra desconhecida sem inventar explicação e bloqueia URL executável', async () => {
    const fetch = vi.fn(async () => json({ items: [{ ...discard, official_url: 'javascript:alert(1)', reason_code: 'CUSTOM_RULE', decisive_term: 'teste' }],total:1 })) as ProductApiFetch
    mount(<CollectionFilterDiscards apiFetch={fetch} />)
    await screen.findByText('CUSTOM_RULE')
    expect(screen.getByText('teste')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Link oficial indisponível')).toBeInTheDocument()
  })

  it('exibe percentuais NUMERIC, contagens e filtro de status dos alertas', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input)); return json({ items: String(input).includes('status=OPEN') ? [alert] : [] })
    }) as ProductApiFetch
    mount(<CollectionFilterDiscardAlerts apiFetch={fetch} />)
    await screen.findByText('90%')
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('65%')).toBeInTheDocument()
    expect(screen.getByText('100 / 90')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status do alerta'), { target: { value: 'ACKNOWLEDGED' } })
    await screen.findByText('Nenhum alerta para o status selecionado.')
    expect(calls.at(-1)).toContain('limit=500&status=ACKNOWLEDGED')
    fireEvent.change(screen.getByLabelText('Status do alerta'), { target: { value: 'ALL' } })
    await waitFor(() => expect(calls.at(-1)).toMatch(/discard-alerts\?limit=500$/))
  })

  it('explicita limite de alertas e diferencia falha de ausência', async () => {
    let failed = true
    const fetch = vi.fn(async () => failed ? json({}, 500) : json({ items: Array.from({ length: 500 }, (_, i) => ({ ...alert, id: String(i) })) })) as ProductApiFetch
    mount(<CollectionFilterDiscardAlerts apiFetch={fetch} />)
    await screen.findByRole('alert')
    expect(screen.queryByText('Nenhum alerta para o status selecionado.')).not.toBeInTheDocument()
    failed = false
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar alertas' }))
    await screen.findByText(/Limite de 500 alertas atingido/)
  })

  it('não consulta as trilhas quando o usuário não é PLATFORM_ADMIN', async () => {
    const fetch = vi.fn(async () => json({ platformAdmin: false })) as ProductApiFetch
    mount(<CollectionFilterAdminPage apiFetch={fetch} />)
    await screen.findByText('Acesso restrito')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/me', expect.anything())
    expect(screen.queryByRole('button', { name: 'Desconsiderados' })).not.toBeInTheDocument()
  })

  it('integra as abas e carrega trilhas somente quando selecionadas', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input); calls.push(url)
      if (url.endsWith('/me')) return json({ platformAdmin: true })
      if (url.endsWith('/state')) return json({ policies: [{id:'11111111-1111-4111-8111-111111111111',status:'APPROVED',version:1,revision:5}], documents: {'11111111-1111-4111-8111-111111111111':{id:'11111111-1111-4111-8111-111111111111',status:'APPROVED',version:1,revision:5,rules:[],aliases:[],terms:[]}}, newTypesOpen: 0 })
      return json({ items: url.includes('/discarded?') ? [discard] : [],total:url.includes('/discarded?')?1:0 })
    }) as ProductApiFetch
    mount(<CollectionFilterAdminPage apiFetch={fetch} />)
    const tab = await screen.findByRole('button', { name: 'Desconsiderados' })
    expect(calls.some(url => /discarded|discard-alerts/.test(url))).toBe(false)
    fireEvent.click(tab)
    await screen.findByText(discard.title)
    fireEvent.click(screen.getByRole('button', { name: 'Alertas de descarte' }))
    await screen.findByText('Nenhum alerta para o status selecionado.')
    expect(calls.some(url => url.includes('/discard-alerts?'))).toBe(true)
  })
})
