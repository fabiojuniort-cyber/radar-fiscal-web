import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnatomyRulesAdminPage, errorText } from './anatomy-rules-admin'
import { AnatomyRulesApiError, approvalBlockers, type CandidateDetail } from './anatomy-rules-api'
import { parseAnatomyRulesAdminFlag } from './anatomy-rules-flag'
import type { ProductApiFetch } from './product-api'

// ANAT-ADMIN-01 P4 — FIXTURES ONLY (synthetic, identified as such); the real flow runs against the API in e2e/local.
afterEach(() => cleanup())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const AUTHOR = '11111111-1111-4111-8111-111111111111'
const REVIEWER = '22222222-2222-4222-8222-222222222222'
const CAND = '33333333-3333-4333-8333-333333333333'
const SIM = '44444444-4444-4444-8444-444444444444'
const CMP = '55555555-5555-4555-8555-555555555555'
const h = (c: string) => c.repeat(64)
const detail = (over: Partial<CandidateDetail> = {}): CandidateDetail => ({
  candidate: { id: CAND, ruleSetId: 'snap', ruleHash: h('a'), exampleSetId: 'ex', exampleSetHash: h('b'), engineHash: h('e'), createdBy: AUTHOR,
    draftId: 'd', draftRevision: 2, draftAuthor: AUTHOR, state: 'simulated', createdAt: '2026-10-24T00:00:00Z', profiles: [], examples: [{ id: 'ex-a' }] },
  simulations: [{ id: SIM, status: 'complete', passCount: 1, failCount: 0, partialCount: 0, cancelledCount: 0, inconclusiveCount: 0, reportHash: h('c'),
    requestedBy: AUTHOR, createdAt: '2026-10-24T00:00:00Z', rows: [{ exampleId: 'ex-a', outcome: 'pass', outputHash: h('d'), analysisId: h('f') }] }],
  comparisons: [{ id: CMP, exampleId: 'ex-a', comparisonHash: h('1'), baselineRuleSetId: 'base', baselineRuleHash: h('2'), createdAt: '2026-10-24T00:00:00Z',
    envelope: { differences: [{ id: 'diff1', category: 'entity', key: 'NCM@0-10#0', change: 'added', before: null, after: { literal: '8471.30.12' } }], counts: {} } }],
  reviews: [], ...over,
})

function mockApi(state: { detail: CandidateDetail; me?: boolean; confirmError?: string }) {
  const calls: { method: string; url: string; body: unknown }[] = []
  const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET'
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (url.endsWith('/api/v1/admin/me')) return json({ platformAdmin: state.me !== false, taxonomyCurator: false, licenseBypass: true, curatorDatabase: false })
    if (url.endsWith('/drafts')) return json([])
    if (url.endsWith('/candidates')) return json([state.detail.candidate])
    if (url.endsWith(`/candidates/${CAND}`)) return json(state.detail)
    if (url.endsWith('/activations') || url.endsWith('/audit')) return json([])
    if (url.endsWith(`/candidates/${CAND}/reviews`)) return json({ reviewId: 'r1' }, 201)
    if (url.endsWith('/activation/preview')) return json({ previewId: h('9').slice(0, 36), intentHash: h('8'), expiresAt: '2026-10-24T00:10:00Z', token: 'tok-once',
      affectedScope: { basis: 'shipped_defaults', targets: [{ source: 'RFB', family: null, changed: true, beforeEffectiveHash: h('3'), afterEffectiveHash: h('4') },
        { source: 'DOU', family: null, changed: false, beforeEffectiveHash: h('5'), afterEffectiveHash: h('5') }],
      publications: { status: 'unsupported', reason: 'sem metadados de fonte/família' }, analyses: { status: 'unsupported', reason: 'sem effective_profile_hash' },
      unknownFamily: 'família desconhecida', reprocessing: 'none' } }, 201)
    if (url.endsWith('/activation/confirm')) return state.confirmError ? json({ error: state.confirmError, correlationId: 'c' }, 409) : json({ activationId: 'a1', replayed: false })
    return json({ error: 'not_mocked' }, 404)
  }) as unknown as ProductApiFetch
  return { apiFetch, calls }
}
function renderPage(apiFetch: ProductApiFetch, userId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter><AnatomyRulesAdminPage apiFetch={apiFetch} userId={userId} /></MemoryRouter></QueryClientProvider>)
}
async function openCandidate() {
  const list = await screen.findByRole('region', { name: 'Versões' }).catch(() => null)
  fireEvent.click(await screen.findByRole('button', { name: /simulado/u }))
  await screen.findByText(/Candidato 33333333/u)
  return list
}

describe('Regras da Anatomia do Ato (P4)', () => {
  it('fica desligada sem a flag explícita de build', () => {
    expect(parseAnatomyRulesAdminFlag(undefined)).toBe(false)
    expect(parseAnatomyRulesAdminFlag('1')).toBe(false)
    expect(parseAnatomyRulesAdminFlag('true')).toBe(true)
  })

  it('bloqueia quem não é administrador da plataforma', async () => {
    renderPage(mockApi({ detail: detail(), me: false }).apiFetch, REVIEWER)
    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument()
  })

  it('regras de aprovação espelham o §2.5 e nunca liberam o autor', () => {
    const ok = { [`${CMP}:diff1`]: 'expected' }
    expect(approvalBlockers(detail(), SIM, ok, REVIEWER)).toEqual([])
    expect(approvalBlockers(detail(), SIM, ok, AUTHOR)).toContain('Você é autor deste candidato e não pode revisá-lo.')
    expect(approvalBlockers(detail(), SIM, {}, REVIEWER)).toContain('Toda diferença precisa ser marcada como esperada para aprovar.')
    const inconclusive = detail({ simulations: [{ ...detail().simulations[0]!, rows: [{ exampleId: 'ex-a', outcome: 'inconclusive', outputHash: null, analysisId: null }] }] })
    expect(approvalBlockers(inconclusive, SIM, ok, REVIEWER)).toContain('Todos os exemplos precisam estar em pass numa simulação completa.')
    expect(approvalBlockers(detail({ comparisons: [] }), SIM, ok, REVIEWER)).toContain('Falta uma comparação para algum exemplo.')
  })

  it('mostra pass, inconclusivo, cancelado e falhou de forma distinta', async () => {
    const rows = [['pass', 'pass'], ['inconclusive', 'inconclusivo'], ['cancelled', 'cancelado'], ['failed', 'falhou'], ['fail', 'fail'], ['partial', 'parcial']] as const
    const d = detail({ simulations: [{ ...detail().simulations[0]!, status: 'partial', rows: rows.map(([o], i) => ({ exampleId: `e${i}`, outcome: o, outputHash: null, analysisId: null })) }] })
    renderPage(mockApi({ detail: d }).apiFetch, REVIEWER)
    await openCandidate()
    for (const [outcome, label] of rows) expect(document.querySelector(`.ar-out-${outcome}`)?.textContent).toBe(label)
  })

  it('o autor vê o bloqueio e não consegue aprovar nem rejeitar', async () => {
    renderPage(mockApi({ detail: detail() }).apiFetch, AUTHOR)
    await openCandidate()
    expect(screen.getAllByText('Você é autor deste candidato e não pode revisá-lo.').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText(/Justificativa \(10/u), { target: { value: 'Justificativa suficiente.' } })
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Rejeitar' })).toBeDisabled()
  })

  it('revisor aprova só depois de decidir cada diferença; envia todas as decisões', async () => {
    const { apiFetch, calls } = mockApi({ detail: detail() })
    renderPage(apiFetch, REVIEWER)
    await openCandidate()
    fireEvent.change(screen.getByLabelText(/Justificativa \(10/u), { target: { value: 'Mudança esperada da coluna.' } })
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Decisão NCM@0-10#0'), { target: { value: 'expected' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Revisão registrada.')
    const sent = calls.find((c) => c.url.endsWith('/reviews'))!.body as { decisions: unknown[]; outcome: string; comparisonIds: string[] }
    expect(sent).toMatchObject({ outcome: 'approved', comparisonIds: [CMP], decisions: [{ comparisonId: CMP, differenceId: 'diff1', decision: 'expected' }] })
  })

  it('prévia mostra o escopo e declara contagens não suportadas; prévia obsoleta volta com aviso', async () => {
    const approved = detail({ reviews: [{ id: 'r1', simulationId: SIM, reviewer: REVIEWER, outcome: 'approved', rationale: 'ok', createdAt: '', comparisonIds: [CMP], decisions: [] }] })
    const { apiFetch, calls } = mockApi({ detail: approved, confirmError: 'PREVIEW_STALE' })
    renderPage(apiFetch, REVIEWER)
    await openCandidate()
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    const region = await screen.findByRole('region', { name: 'Confirmar ativação' })
    expect(within(region).getAllByText('não suportado')).toHaveLength(2)
    expect(within(region).getByText('Nada é reprocessado ao ativar ou retornar.')).toBeInTheDocument()
    expect(within(region).getByText('muda')).toBeInTheDocument()
    fireEvent.change(within(region).getByLabelText(/Justificativa da ativação/u), { target: { value: 'Ativação sintética de teste.' } })
    fireEvent.click(within(region).getByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText('A regra ativa mudou desde a prévia. Gere uma nova prévia.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Confirmar ativação' })).toBeNull()
    expect(calls.find((c) => c.url.endsWith('/confirm'))!.body).toMatchObject({ token: 'tok-once', intentHash: h('8') })
  })

  it('a ativação usa a revisão aprovada mesmo quando ela chega depois da primeira renderização', async () => {
    const state = { detail: detail() }
    const { apiFetch } = mockApi(state)
    renderPage(apiFetch, REVIEWER)
    await openCandidate()
    fireEvent.change(screen.getByLabelText(/Justificativa \(10/u), { target: { value: 'Mudança esperada da coluna.' } })
    fireEvent.change(screen.getByLabelText('Decisão NCM@0-10#0'), { target: { value: 'expected' } })
    state.detail = detail({ reviews: [{ id: 'r1', simulationId: SIM, reviewer: REVIEWER, outcome: 'approved', rationale: 'ok', createdAt: '', comparisonIds: [CMP], decisions: [] }] })
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    await screen.findByText('Revisão registrada.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Gerar prévia' })).toBeEnabled())
  })

  it('mensagens de erro são as do código do servidor, sem detalhes internos', () => {
    expect(errorText(new AnatomyRulesApiError('PREVIEW_EXPIRED', 409, null))).toMatch(/expirou/u)
    expect(errorText(new AnatomyRulesApiError('audit_unavailable', 503, null))).toMatch(/nada foi alterado/u)
    expect(errorText(new AnatomyRulesApiError('weird_code', 500, null))).toBe('Falha administrativa: weird_code')
  })
})

describe('estado vazio e carregamento', () => {
  it('sem candidato selecionado mostra orientação', async () => {
    renderPage(mockApi({ detail: detail() }).apiFetch, REVIEWER)
    expect(await screen.findByText('Selecione ou congele um candidato.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Nenhum rascunho ainda.')).toBeInTheDocument())
  })
})
