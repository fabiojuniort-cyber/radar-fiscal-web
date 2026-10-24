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

// ANAT-ADMIN-01 P4 R1 regressions (COORD review of 1269b69). Fixtures only.
describe('P4 R1', () => {
  const B = '66666666-6666-4666-8666-666666666666'
  const approvedReview = { id: 'r1', simulationId: SIM, reviewer: REVIEWER, outcome: 'approved' as const, rationale: 'ok', createdAt: '', comparisonIds: [CMP], decisions: [] }
  function twoCandidates() {
    const a = detail({ reviews: [approvedReview] })
    const b = detail({ reviews: [{ ...approvedReview, id: 'r2' }] }); b.candidate = { ...b.candidate, id: B, state: 'approved', ruleHash: h('7') }
    a.candidate = { ...a.candidate, state: 'approved' }
    const calls: { url: string; body: unknown }[] = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (url.endsWith('/api/v1/admin/me')) return json({ platformAdmin: true, taxonomyCurator: false, licenseBypass: true, curatorDatabase: false })
      if (url.endsWith('/drafts')) return json([])
      if (url.endsWith('/candidates')) return json([a.candidate, b.candidate])
      if (url.endsWith(`/candidates/${CAND}`)) return json(a)
      if (url.endsWith(`/candidates/${B}`)) return json(b)
      if (url.endsWith('/activations') || url.endsWith('/audit')) return json([])
      if (url.endsWith('/activation/preview')) {
        const body = JSON.parse(String(init!.body)) as { candidateId: string }
        return json({ previewId: 'p-' + body.candidateId.slice(0, 4), intentHash: h('8'), expiresAt: '2026-10-24T00:10:00Z', token: `tok-${body.candidateId.slice(0, 4)}`,
          affectedScope: { basis: 'shipped_defaults', targets: [], publications: { status: 'unsupported', reason: 'r' }, analyses: { status: 'unsupported', reason: 'r' }, unknownFamily: 'u', reprocessing: 'none' } }, 201)
      }
      if (url.endsWith('/activation/confirm')) return json({ activationId: 'a1', replayed: false })
      return json({ error: 'not_mocked' }, 404)
    }) as unknown as ProductApiFetch
    return { apiFetch, calls }
  }

  it('P4-R1-01: uma prévia de A nunca pode ser confirmada na tela de B', async () => {
    const { apiFetch, calls } = twoCandidates()
    renderPage(apiFetch, REVIEWER)
    const buttons = await screen.findAllByRole('button', { name: /aprovado/u })
    // Warm both candidates in the query cache first (the review's precondition), then go back to A.
    fireEvent.click(buttons[1]!)
    await screen.findByText(/Candidato 66666666/u)
    fireEvent.click(buttons[0]!)
    await screen.findByText(/Candidato 33333333/u)
    fireEvent.click(screen.getByRole('button', { name: 'Gerar prévia' }))
    const region = await screen.findByRole('region', { name: 'Confirmar ativação' })
    expect(within(region).getByText(/33333333/u)).toBeInTheDocument()
    expect(within(region).getByText(/Ativar · escopo global/u)).toBeInTheDocument()
    // Both candidates are cached; switch to B.
    fireEvent.click(buttons[1]!)
    await screen.findByText(/Candidato 66666666/u)
    expect(screen.queryByRole('region', { name: 'Confirmar ativação' })).toBeNull()
    expect(calls.some((c) => c.url.endsWith('/activation/confirm'))).toBe(false)
    // Back to A: the old token is gone too (a new preview is required).
    fireEvent.click(buttons[0]!)
    await screen.findByText(/Candidato 33333333/u)
    expect(screen.queryByRole('region', { name: 'Confirmar ativação' })).toBeNull()
  })

  it('P4-R1-02: congelar exige que o conteúdo visível esteja salvo', async () => {
    let release: (() => void) | null = null
    const draft = { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', author: AUTHOR, revision: 1, updatedAt: '', profiles: [{ a: 1 }], examples: [{ id: 'ex-a' }] }
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/v1/admin/me')) return json({ platformAdmin: true, taxonomyCurator: false, licenseBypass: true, curatorDatabase: false })
      if (url.endsWith('/drafts') && (init?.method ?? 'GET') === 'GET') return json([draft])
      if (url.endsWith(`/drafts/${draft.id}`) && init?.method === 'PUT') { await new Promise<void>((r) => { release = r }); return json({ id: draft.id, revision: 2 }) }
      if (url.endsWith('/candidates') || url.endsWith('/activations') || url.endsWith('/audit')) return json([])
      return json({ error: 'not_mocked' }, 404)
    }) as unknown as ProductApiFetch
    renderPage(apiFetch, AUTHOR)
    fireEvent.click(await screen.findByRole('button', { name: /Rascunho dddddddd/u }))
    const freezeButton = screen.getByRole('button', { name: /Congelar candidato/u })
    expect(freezeButton).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Perfis (JSON, ANAT-PROFILE/1)'), { target: { value: '[{"a":2}]' } })
    expect(freezeButton).toBeDisabled()
    expect(screen.getByText('Há alterações não salvas: salve antes de congelar.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(release).not.toBeNull())
    expect(freezeButton).toBeDisabled() // save still in flight
    release!()
    await screen.findByText(/Rascunho salvo \(revisão 2\)/u)
    await waitFor(() => expect(freezeButton).toBeEnabled())
    // Switching drafts discards unsaved edits explicitly (the loaded content is the saved one).
    fireEvent.change(screen.getByLabelText('Exemplos sintéticos (JSON, até 20)'), { target: { value: '[]' } })
    expect(freezeButton).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Rascunho dddddddd/u }))
    expect(freezeButton).toBeEnabled()
  })
})

describe('P4 R2', () => {
  const A = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', author: AUTHOR, revision: 1, updatedAt: '', profiles: [{ a: 1 }], examples: [{ id: 'ex-a' }] }
  const B = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', author: AUTHOR, revision: 4, updatedAt: '', profiles: [{ b: 1 }], examples: [{ id: 'ex-b' }] }
  const NEW = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
  function slowDrafts() {
    const gates: (() => void)[] = []
    const calls: { url: string; method: string }[] = []
    const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method ?? 'GET'; calls.push({ url, method })
      if (url.endsWith('/api/v1/admin/me')) return json({ platformAdmin: true, taxonomyCurator: false, licenseBypass: true, curatorDatabase: false })
      if (url.endsWith('/drafts') && method === 'GET') return json([A, B])
      if (url.endsWith('/drafts') && method === 'POST') { await new Promise<void>((r) => gates.push(r)); return json({ id: NEW, revision: 1 }, 201) }
      if (url.endsWith(`/drafts/${A.id}`) && method === 'PUT') { await new Promise<void>((r) => gates.push(r)); return json({ id: A.id, revision: 2 }) }
      if (url.endsWith('/candidates') || url.endsWith('/activations') || url.endsWith('/audit')) return json([])
      return json({ error: 'not_mocked' }, 404)
    }) as unknown as ProductApiFetch
    return { apiFetch, calls, gates }
  }
  const profilesBox = () => screen.getByLabelText('Perfis (JSON, ANAT-PROFILE/1)') as HTMLTextAreaElement
  const freezeButton = () => screen.getByRole('button', { name: /Congelar candidato/u })

  it('P4-R2-01: save lento de A e tentativa de selecionar B — a resposta de A não altera B', async () => {
    const { apiFetch, gates } = slowDrafts()
    renderPage(apiFetch, AUTHOR)
    fireEvent.click(await screen.findByRole('button', { name: /Rascunho aaaaaaaa/u }))
    fireEvent.change(profilesBox(), { target: { value: '[{"a":2}]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(gates).toHaveLength(1))
    const bButton = screen.getByRole('button', { name: /Rascunho bbbbbbbb/u })
    expect(bButton).toBeDisabled()
    fireEvent.click(bButton)
    gates[0]!()
    await screen.findByText(/Rascunho salvo \(revisão 2\)/u)
    expect(screen.getByText(/Editando aaaaaaaa\S* · revisão 2/u)).toBeInTheDocument()
    expect(profilesBox().value).toBe('[{"a":2}]')
    await waitFor(() => expect(freezeButton()).toBeEnabled())
  })

  it('P4-R2-01: criação em andamento e tentativa de abrir outro rascunho', async () => {
    const { apiFetch, gates } = slowDrafts()
    renderPage(apiFetch, AUTHOR)
    await screen.findByRole('button', { name: /Rascunho aaaaaaaa/u })
    fireEvent.click(screen.getByRole('button', { name: 'Novo rascunho' }))
    fireEvent.change(profilesBox(), { target: { value: '[{"n":1}]' } })
    fireEvent.change(screen.getByLabelText('Exemplos sintéticos (JSON, até 20)'), { target: { value: '[{"id":"ex-n"}]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(gates).toHaveLength(1))
    const aButton = screen.getByRole('button', { name: /Rascunho aaaaaaaa/u })
    expect(aButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Novo rascunho' })).toBeDisabled()
    fireEvent.click(aButton)
    gates[0]!()
    await screen.findByText(/Editando cccccccc\S* · revisão 1/u)
    expect(profilesBox().value).toBe('[{"n":1}]')
    expect(screen.getByRole('button', { name: /Rascunho aaaaaaaa/u })).toHaveAttribute('aria-pressed', 'false')
  })

  it('P4-R2-01: edição bloqueada enquanto o save está pendente', async () => {
    const { apiFetch, gates } = slowDrafts()
    renderPage(apiFetch, AUTHOR)
    fireEvent.click(await screen.findByRole('button', { name: /Rascunho aaaaaaaa/u }))
    fireEvent.change(profilesBox(), { target: { value: '[{"a":2}]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(gates).toHaveLength(1))
    expect(profilesBox()).toHaveAttribute('readonly')
    expect(screen.getByLabelText('Exemplos sintéticos (JSON, até 20)')).toHaveAttribute('readonly')
    expect(screen.getByText(/edição e troca de rascunho bloqueadas/u)).toBeInTheDocument()
    gates[0]!()
    await waitFor(() => expect(profilesBox()).not.toHaveAttribute('readonly'))
    await waitFor(() => expect(freezeButton()).toBeEnabled())
  })

  it('P4-R2-01: resposta tardia de A não habilita congelar para o alvo errado', async () => {
    const { apiFetch, calls, gates } = slowDrafts()
    renderPage(apiFetch, AUTHOR)
    fireEvent.click(await screen.findByRole('button', { name: /Rascunho aaaaaaaa/u }))
    fireEvent.change(profilesBox(), { target: { value: '[{"a":2}]' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    await waitFor(() => expect(gates).toHaveLength(1))
    fireEvent.click(screen.getByRole('button', { name: /Rascunho bbbbbbbb/u })) // blocked while A's save is in flight
    gates[0]!()
    await screen.findByText(/Rascunho salvo \(revisão 2\)/u)
    // Whatever is shown, the identity, the content and the freeze target belong together (A, revision 2, A's text).
    const shown = screen.getByText(/Editando /u).textContent!
    expect(shown).toMatch(/aaaaaaaa\S* · revisão 2/u)
    expect(profilesBox().value).not.toContain('"b"')
    await waitFor(() => expect(freezeButton()).toBeEnabled())
    fireEvent.click(freezeButton())
    await waitFor(() => expect(calls.some((c) => c.url.includes('/freeze'))).toBe(true))
    expect(calls.filter((c) => c.url.includes('/freeze')).every((c) => c.url.includes(A.id))).toBe(true)
  })
})

