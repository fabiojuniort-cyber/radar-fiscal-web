import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AnatomyConfigPage } from './anatomy-config'
import { parseAnatomyConfigFlag } from './anatomy-config-flag'
import type { ProductApiFetch } from './product-api'

// ANAT-CONFIG-01 — FIXTURES ONLY (synthetic); the real flow runs against the API in e2e/anatomy-config-real.spec.ts.
afterEach(() => cleanup())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const natures = { operative: 'Dispositivo do ato', historical: 'Redação anterior (histórico)', editorial_note: 'Nota editorial', amendment: 'Texto que altera outro ato', structure: 'Elemento estrutural', ambiguous: 'A conferir (não reconhecido)' }
const passage = (nature: string, text: string, key: string) => ({ key, partId: key, parentKey: null, depth: 0, type: 'clause', structure: 'Cláusula', label: '', text,
  nature, natureLabel: natures[nature as keyof typeof natures], validity: 'unknown', validityLabel: 'Não determinada', reasons: ['nenhuma regra reconheceu este bloco'], references: [], ncm: [],
  ai: { anchor: text, structure: 'Nota de alteração', nature: 'editorial_note', natureLabel: 'Nota editorial', validity: 'not_determined', validityLabel: 'Não determinada',
    evidence: 'estilo "NotaAlteracao"', explanation: 'Nota do editor.', secondCheck: { agrees: true, note: 'Releitura confirma.' } },
  correction: null, effectiveNature: nature, effectiveNatureLabel: natures[nature as keyof typeof natures] })
const described = (nature: string) => ({ status: 'complete', statusLabel: 'Completo', documentHash: 'd'.repeat(64), corrections: { applied: [], stale: [] }, passages: [passage(nature, 'Acrescentado pelo Ajuste Exemplo.', 'a'.repeat(16))],
  review: nature === 'ambiguous' ? [{ sampleId: 's1', partKey: 'a'.repeat(16), kind: 'not_recognized', title: 'Trecho não reconhecido', detail: 'x' }] : [], counts: {} })
const analysis = (after: string) => ({ basedOnVersion: 0, changes: 1, totals: { samples: 1, passages: 1, changedPassages: after === 'ambiguous' ? 0 : 1, samplesChanged: after === 'ambiguous' ? 0 : 1, reviewBefore: 1, reviewAfter: after === 'ambiguous' ? 1 : 0 },
  samples: [{ id: 's1', title: 'Ajuste fictício', source: 'CONFAZ', provenance: { kind: 'synthetic', note: '' }, before: described('ambiguous'), after: described(after),
    diff: { changed: after === 'ambiguous' ? [] : [{ key: 'a'.repeat(16), structure: 'Cláusula', text: 'Acrescentado', from: 'ambiguous', fromLabel: natures.ambiguous, to: after, toLabel: natures.editorial_note }], appeared: 0, disappeared: 0, reviewBefore: 1, reviewAfter: 0 } }] })

function mockApi(opts: { saveStatus?: number; version?: { current: number } } = {}) {
  const calls: { method: string; url: string; body: unknown }[] = []
  const apiFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input); const method = init?.method ?? 'GET'; const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body })
    if (url.endsWith('/anatomy-config')) return json({ current: { versionId: null, version: opts.version?.current ?? 0, origin: 'shipped', corrections: [], rules: [] },
      catalog: [{ path: 'classes.editorialNote', group: 'classes', field: 'editorialNote', title: 'Estilo de nota editorial', help: 'h', example: 'Remisso', produces: 'editorial_note', kind: 'style' }],
      samples: [{ id: 's1', documentId: 's1', version: 'v1', documentHash: 'd'.repeat(64), title: 'Ajuste fictício', source: 'CONFAZ', family: null, format: 'html', provenance: { kind: 'synthetic', note: '' }, covers: [], annotated: 1 }], natures, sources: { CONFAZ: 'CONFAZ' } })
    if (url.endsWith('/documents/s1/analyses') && method === 'GET') return json([])
    if (url.endsWith('/documents/s1/analyses')) return json({ analysisRecordId: 'r1', documentId: 's1', documentVersion: 'v1', documentHash: 'd'.repeat(64), configVersion: 0, configVersionId: null,
      engineAnalysisId: 'e'.repeat(64), correctionsApplied: [], correctionsStale: [], described: described('ambiguous') }, 201)
    if (url.endsWith('/analysis')) return json({ ...analysis(body?.changes?.length ? 'editorial_note' : 'ambiguous'), basedOnVersion: opts.version?.current ?? 0 })
    if (url.endsWith('/suggestions')) return json({ wantedLabel: 'Nota editorial', unsupported: null, suggestions: [{ scope: { level: 'source', source: 'CONFAZ' }, path: 'classes.editorialNote', action: 'add', literal: 'NotaAlteracao',
      description: 'Incluir "NotaAlteracao" em estilo de nota editorial — Fonte: CONFAZ', why: 'O bloco usa o estilo "NotaAlteracao".' }] })
    if (url.endsWith('/save')) return opts.saveStatus === 409 ? json({ error: 'STALE_VERSION', message: 'Outra pessoa salvou uma configuração depois que você começou.' }, 409) : json({ versionId: 'v1', version: 1 }, 201)
    return json({ error: 'not_mocked' }, 404)
  }) as unknown as ProductApiFetch
  return { apiFetch, calls }
}
const renderPage = (apiFetch: ProductApiFetch, client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => render(<QueryClientProvider client={client}><MemoryRouter><AnatomyConfigPage apiFetch={apiFetch} /></MemoryRouter></QueryClientProvider>)
async function proposeRule() {
  fireEvent.click((await screen.findAllByText('Acrescentado pelo Ajuste Exemplo.'))[0]!)
  const panel = await screen.findByRole('region', { name: 'Trecho selecionado' })
  fireEvent.click(within(panel).getByRole('button', { name: 'Ver sugestão' }))
  fireEvent.click(await within(panel).findByRole('button', { name: 'Adicionar à proposta' }))
}

describe('ANAT-CONFIG-01 screen', () => {
  it('flag is off unless exactly "true"', () => {
    expect(parseAnatomyConfigFlag('true')).toBe(true)
    for (const v of [undefined, 'false', '1', 'TRUE', '']) expect(parseAnatomyConfigFlag(v)).toBe(false)
  })

  it('shows the act, the AI reading and three separate dimensions, with no JSON editor', async () => {
    const { apiFetch } = mockApi(); const { container } = renderPage(apiFetch)
    fireEvent.click((await screen.findAllByText('Acrescentado pelo Ajuste Exemplo.'))[0]!)
    const panel = await screen.findByRole('region', { name: 'Trecho selecionado' })
    for (const t of ['Estrutura', 'Natureza', 'Vigência', 'Leitura da IA']) expect(within(panel).getByText(t)).toBeTruthy()
    expect(within(panel).getByText(/notas e estilos não decidem a vigência/u)).toBeTruthy()
    expect(container.querySelector('textarea')).toBeNull()
  })

  it('save is blocked until tested; one save call applies (no freeze/review); undo removes the edit', async () => {
    const { apiFetch, calls } = mockApi(); renderPage(apiFetch)
    await proposeRule()
    expect(screen.getByText(/Incluir "NotaAlteracao" em estilo de nota editorial — Fonte: CONFAZ/u, { selector: 'span' })).toBeTruthy()
    expect((screen.getByRole('button', { name: /Salvar configuração/u }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Testar alterações/u }))
    expect(await screen.findByText('1 trecho(s) mudam de natureza em 1 ato(s).')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Salvar configuração/u }))
    const confirm = screen.getByRole('region', { name: 'Confirmar salvamento' })
    expect(confirm.textContent).toMatch(/Nada do acervo é reprocessado/u)
    fireEvent.click(within(confirm).getByRole('button', { name: /Confirmar e salvar/u }))
    await screen.findByText(/Configuração salva e aplicada \(versão 1\)/u)
    const writes = calls.filter((c) => c.method === 'POST' && !c.url.endsWith('/analysis') && !c.url.endsWith('/suggestions'))
    expect(writes.map((c) => c.url.split('/').pop())).toEqual(['save'])
    expect(writes[0]!.body).toMatchObject({ basedOnVersion: 0, changes: [{ path: 'classes.editorialNote', literal: 'NotaAlteracao', scope: { level: 'source', source: 'CONFAZ' } }] })
  })

  it('a concurrent save shows the explanation and keeps the edits', async () => {
    const { apiFetch } = mockApi({ saveStatus: 409 }); renderPage(apiFetch)
    await proposeRule()
    fireEvent.click(screen.getByRole('button', { name: /Testar alterações/u }))
    await screen.findByText(/Resultado do teste/u)
    fireEvent.click(screen.getByRole('button', { name: /Salvar configuração/u }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e salvar/u }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Outra pessoa salvou/u)
    expect(screen.getByRole('button', { name: 'Recarregar a versão atual' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Desfazer/u }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('passage correction needs a reason and is bound to the document version and passage', async () => {
    const { apiFetch, calls } = mockApi(); renderPage(apiFetch)
    fireEvent.click((await screen.findAllByText('Acrescentado pelo Ajuste Exemplo.'))[0]!)
    const panel = await screen.findByRole('region', { name: 'Trecho selecionado' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar correção' }))
    expect(within(panel).getByRole('alert').textContent).toMatch(/Informe o motivo/u)
    fireEvent.change(within(panel).getByLabelText('Motivo (obrigatório)'), { target: { value: 'É nota do editor' } })
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar correção' }))
    fireEvent.click(screen.getByRole('button', { name: /Testar alterações/u }))
    await screen.findByText(/Resultado do teste/u)
    const body = calls.filter((c) => c.url.endsWith('/analysis')).at(-1)!.body as { corrections: unknown[] }
    expect(body.corrections).toEqual([{ documentId: 's1', documentHash: 'd'.repeat(64), partKey: 'a'.repeat(16), expected: 'editorial_note', reason: 'É nota do editor' }])
  })

  it('new analysis of the document calls the consumer and reports the configuration version used', async () => {
    const { apiFetch, calls } = mockApi(); renderPage(apiFetch)
    fireEvent.click(await screen.findByRole('button', { name: /Nova análise deste documento/u }))
    expect((await screen.findByText(/Análise registrada: documento v1, configuração versão 0/u))).toBeTruthy()
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/documents/s1/analyses'))).toBe(true)
  })

  it('CONFIG-R2-02: a test made on another base version no longer allows saving; the save sends the tested base', async () => {
    const version = { current: 1 }
    const { apiFetch, calls } = mockApi({ version })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    renderPage(apiFetch, client)
    await proposeRule()
    fireEvent.click(screen.getByRole('button', { name: /Testar alterações/u }))
    await screen.findByText(/Resultado do teste/u)
    expect((screen.getByRole('button', { name: /Salvar configuração/u }) as HTMLButtonElement).disabled).toBe(false)
    // Another administrator saves: the overview refreshes to version 2 with the same pending edits.
    version.current = 2
    await client.invalidateQueries({ queryKey: ['anat-config'] })
    await screen.findByText(/o teste foi feito na versão 1 e a tela mostra a versão 2/u)
    expect((screen.getByRole('button', { name: /Salvar configuração/u }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls.some((c) => c.url.endsWith('/save'))).toBe(false)
    // Re-test on the new base; the save then carries the base version of THAT test.
    fireEvent.click(screen.getByRole('button', { name: /Testar alterações/u }))
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar configuração/u }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: /Salvar configuração/u }))
    fireEvent.click(screen.getByRole('button', { name: /Confirmar e salvar/u }))
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/save')).length).toBe(1))
    expect((calls.find((c) => c.url.endsWith('/save'))!.body as { basedOnVersion: number }).basedOnVersion).toBe(2)
  })
})
