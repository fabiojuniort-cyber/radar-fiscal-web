import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, FlaskConical, GitCompare, History, Play, ShieldCheck, Snowflake, Square } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AnatomyRulesApiError, anatomyRulesApi, approvalBlockers, shortHash,
  type CandidateDetail, type Draft, type Preview, type RowOutcome,
} from './anatomy-rules-api'
import type { ProductApiFetch } from './product-api'
import { fetchAdminMe } from './taxonomy-api'
import './anatomy-rules-admin.css'

/**
 * ANAT-ADMIN-01 P4 (tribusca-control#116): administration of anatomy rules — draft → freeze → simulate → compare →
 * review → activation preview → confirm → history (P3 §7, T1–T8). Behind VITE_ENABLE_ANAT_RULES_ADMIN (off by default):
 * not available to real users. Synthetic examples only; nothing here reprocesses publications.
 */
const ERRORS: Record<string, string> = {
  platform_admin_required: 'Seu usuário não possui acesso de administrador da plataforma.',
  STALE_REVISION: 'O rascunho foi alterado em outra sessão. Recarregue antes de salvar.',
  AUTHOR_CANNOT_REVIEW: 'O autor do candidato não pode revisá-lo.',
  REVIEW_INCOMPLETE: 'A revisão está incompleta: falta comparação ou decisão para alguma diferença.',
  SIMULATION_NOT_PASSING: 'A simulação não está toda em pass; não é possível aprovar.',
  COMPARISON_MISMATCH: 'A comparação não corresponde a este candidato, exemplo, motor ou base.',
  PREVIEW_EXPIRED: 'A prévia expirou ou não pertence a você. Gere uma nova prévia.',
  PREVIEW_CONSUMED: 'Esta prévia já foi usada.',
  PREVIEW_STALE: 'A regra ativa mudou desde a prévia. Gere uma nova prévia.',
  ENGINE_MISMATCH: 'O candidato foi congelado com outro motor; congele novamente.',
  SIMULATION_UNAVAILABLE: 'O executor de simulação está indisponível.',
  LIMIT_EXCEEDED: 'Um limite foi excedido (exemplos, tamanho ou saída).',
  QUEUE_FULL: 'A fila de simulações está cheia. Tente em instantes.',
  QUEUE_TIMEOUT: 'A espera na fila excedeu o limite. Tente em instantes.',
  RESERVED_EXAMPLE_ID: 'Este identificador de exemplo é reservado e não pode ser usado.',
  DUPLICATE_EXAMPLE_ID: 'Há identificadores de exemplo repetidos.',
  INVALID_EXAMPLE: 'Algum exemplo é inválido.',
  CANONICAL_KEY_UNSUPPORTED: 'Uma chave usa caracteres não suportados (acima de U+E000).',
  CANONICAL_NUMBER_UNSUPPORTED: 'Um número está fora do formato suportado.',
  baseline_required: 'Não há regra ativa neste escopo: informe a base (snapshot) da comparação.',
  audit_unavailable: 'A auditoria está indisponível; nada foi alterado.',
  invalid_request: 'Os dados enviados são inválidos.',
}
export function errorText(error: unknown): string {
  if (error instanceof AnatomyRulesApiError) return ERRORS[error.code] ?? `Falha administrativa: ${error.code}`
  if (error instanceof DOMException && error.name === 'AbortError') return 'Execução cancelada.'
  return 'Não foi possível concluir a operação.'
}
const OUTCOME: Record<RowOutcome, string> = {
  pass: 'pass', fail: 'fail', partial: 'parcial', inconclusive: 'inconclusivo', cancelled: 'cancelado', failed: 'falhou',
}
const STATE: Record<string, string> = { frozen: 'congelado', simulated: 'simulado', approved: 'aprovado', rejected: 'rejeitado', active: 'ativo', superseded: 'substituído' }

function parseJsonArray(text: string, label: string): { value?: unknown[]; error?: string } {
  try {
    const v: unknown = JSON.parse(text)
    if (!Array.isArray(v) || v.length === 0) return { error: `${label}: informe uma lista JSON não vazia.` }
    return { value: v }
  } catch { return { error: `${label}: JSON inválido.` } }
}

export function AnatomyRulesAdminPage({ apiFetch, userId }: { apiFetch: ProductApiFetch; userId: string }) {
  const api = useMemo(() => anatomyRulesApi(apiFetch), [apiFetch])
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: () => fetchAdminMe(apiFetch), retry: false })
  const [selected, setSelected] = useState<string | null>(null)
  if (me.isPending) return <main className="auth-panel-loading">Verificando acesso administrativo…</main>
  if (me.isError || !me.data?.platformAdmin) {
    return <div className="ar-app"><main className="ar-denied"><ShieldCheck size={30} /><h1>Acesso restrito</h1>
      <p>Esta área é exclusiva de administradores globais da plataforma.</p><Link to="/painel">Voltar ao painel</Link></main></div>
  }
  return (
    <div className="ar-app">
      <header className="ar-header">
        <Link to="/painel" className="ar-back"><ArrowLeft size={16} /> Painel</Link>
        <h1>Regras da Anatomia do Ato</h1>
        <p className="ar-note" role="note">Ambiente de ensaio: exemplos sintéticos. Ativar ou retornar não reprocessa publicações nem decide direito.</p>
      </header>
      <div className="ar-layout">
        <section className="ar-column" aria-label="Versões"><DraftsPanel api={api} onFrozen={setSelected} /><CandidatesPanel api={api} selected={selected} onSelect={setSelected} /></section>
        <section className="ar-column ar-main" aria-label="Candidato">{selected ? <CandidatePanel key={selected} api={api} id={selected} userId={userId} /> : <p className="ar-empty">Selecione ou congele um candidato.</p>}</section>
      </div>
      <HistoryPanel api={api} />
    </div>
  )
}

function DraftsPanel({ api, onFrozen }: { api: ReturnType<typeof anatomyRulesApi>; onFrozen: (id: string) => void }) {
  const qc = useQueryClient()
  const drafts = useQuery({ queryKey: ['anat', 'drafts'], queryFn: api.drafts, retry: false })
  const [editing, setEditing] = useState<Draft | null>(null)
  const [profiles, setProfiles] = useState('[]'); const [examples, setExamples] = useState('[]')
  const [local, setLocal] = useState<string | null>(null)
  // P4-R1-02: what the server holds for `editing` (as shown when loaded or last saved). Freeze needs visible == saved.
  const [savedText, setSavedText] = useState<{ profiles: string; examples: string } | null>(null)
  // P4-R2-01: identity of the current edit session (bumped on every load). A save captures it with its target, and
  // its response only touches this panel while that identity is still the one shown.
  const session = useRef(0); const [sessionKey, setSessionKey] = useState(0)
  const load = (d: Draft | null) => {
    const p = JSON.stringify(d?.profiles ?? [], null, 2); const e = JSON.stringify(d?.examples ?? [], null, 2)
    session.current += 1; setSessionKey(session.current)
    setEditing(d); setProfiles(p); setExamples(e); setLocal(null); setSavedText(d ? { profiles: p, examples: e } : null)
  }
  type SaveRequest = { key: number; target: { id: string; revision: number } | null; profiles: string; examples: string }
  const save = useMutation({
    mutationFn: async (sent: SaveRequest) => {
      const p = parseJsonArray(sent.profiles, 'Perfis'); const e = parseJsonArray(sent.examples, 'Exemplos')
      const problem = p.error ?? e.error ?? (e.value && e.value.length > 20 ? 'Exemplos: no máximo 20.' : null)
      if (problem) { setLocal(problem); throw new Error('local') }
      setLocal(null)
      return sent.target ? api.updateDraft(sent.target.id, sent.target.revision, p.value!, e.value!) : api.createDraft(p.value!, e.value!)
    },
    onSuccess: async (r, sent) => {
      await qc.invalidateQueries({ queryKey: ['anat', 'drafts'] })
      if (sent.key !== session.current) return // another draft is shown now: its selection and saved state are untouched
      setSavedText({ profiles: sent.profiles, examples: sent.examples }) // exactly what was sent, even if typing continued
      setEditing((d) => (d ? { ...d, id: r.id, revision: r.revision } : { id: r.id, revision: r.revision, author: '', updatedAt: '', profiles: [], examples: [] }))
    },
  })
  const dirty = savedText === null || savedText.profiles !== profiles || savedText.examples !== examples
  const freeze = useMutation({
    mutationFn: () => api.freeze(editing!.id, editing!.revision),
    onSuccess: async (r) => { await qc.invalidateQueries({ queryKey: ['anat', 'candidates'] }); onFrozen(r.candidateId) },
  })
  const locked = save.isPending || freeze.isPending // no switching drafts or editing while a request for this one is in flight
  const ownSave = save.variables?.key === sessionKey
  return (
    <div className="ar-card">
      <h2>Rascunhos</h2>
      {drafts.isPending ? <p className="ar-muted">Carregando…</p> : drafts.isError ? <p className="ar-error" role="alert">{errorText(drafts.error)}</p>
        : drafts.data.length === 0 ? <p className="ar-muted">Nenhum rascunho ainda.</p>
        : <ul className="ar-list">{drafts.data.map((d) => <li key={d.id}><button type="button" onClick={() => load(d)} aria-pressed={editing?.id === d.id} disabled={locked}>
            Rascunho {shortHash(d.id)} · revisão {d.revision}</button></li>)}</ul>}
      <button type="button" className="ar-secondary" onClick={() => load(null)} disabled={locked}>Novo rascunho</button>
      <label className="ar-field">Perfis (JSON, ANAT-PROFILE/1)<textarea value={profiles} onChange={(e) => setProfiles(e.target.value)} readOnly={locked} rows={6} spellCheck={false} /></label>
      <label className="ar-field">Exemplos sintéticos (JSON, até 20)<textarea value={examples} onChange={(e) => setExamples(e.target.value)} readOnly={locked} rows={6} spellCheck={false} /></label>
      <p className="ar-muted">{editing ? `Editando ${shortHash(editing.id)} · revisão ${editing.revision}` : 'Novo rascunho (não salvo)'}</p>
      {local && <p className="ar-error" role="alert">{local}</p>}
      {locked && <p className="ar-muted" role="status">Aguardando o servidor: edição e troca de rascunho bloqueadas.</p>}
      {save.isError && !local && ownSave && <p className="ar-error" role="alert">{errorText(save.error)}</p>}
      {save.isSuccess && ownSave && <p className="ar-ok" role="status">Rascunho salvo (revisão {save.data.revision}).</p>}
      <div className="ar-actions">
        <button type="button" onClick={() => save.mutate({ key: sessionKey, target: editing && { id: editing.id, revision: editing.revision }, profiles, examples })} disabled={save.isPending}>Salvar rascunho</button>
        <button type="button" onClick={() => freeze.mutate()} disabled={!editing || dirty || save.isPending || freeze.isPending}><Snowflake size={15} /> Congelar candidato</button>
      </div>
      {editing && dirty && <p className="ar-warn" role="note">Há alterações não salvas: salve antes de congelar.</p>}
      {freeze.isError && <p className="ar-error" role="alert">{errorText(freeze.error)}</p>}
      {freeze.isSuccess && <p className="ar-ok" role="status">{freeze.data.created ? 'Candidato congelado.' : 'Candidato já existia com os mesmos hashes.'}</p>}
    </div>
  )
}

function CandidatesPanel({ api, selected, onSelect }: { api: ReturnType<typeof anatomyRulesApi>; selected: string | null; onSelect: (id: string) => void }) {
  const list = useQuery({ queryKey: ['anat', 'candidates'], queryFn: api.candidates, retry: false })
  return (
    <div className="ar-card">
      <h2>Candidatos</h2>
      {list.isPending ? <p className="ar-muted">Carregando…</p> : list.isError ? <p className="ar-error" role="alert">{errorText(list.error)}</p>
        : list.data.length === 0 ? <p className="ar-muted">Nenhum candidato congelado.</p>
        : <ul className="ar-list">{list.data.map((c) => (
          <li key={c.id}><button type="button" onClick={() => onSelect(c.id)} aria-pressed={selected === c.id}>
            <span className={`ar-badge ar-state-${c.state}`}>{STATE[c.state] ?? c.state}</span>
            <span className="ar-hashes">perfis {shortHash(c.ruleHash)} · exemplos {shortHash(c.exampleSetHash)} · motor {shortHash(c.engineHash)}</span>
          </button></li>))}</ul>}
    </div>
  )
}

function CandidatePanel({ api, id, userId }: { api: ReturnType<typeof anatomyRulesApi>; id: string; userId: string }) {
  const qc = useQueryClient()
  const detail = useQuery({ queryKey: ['anat', 'candidate', id], queryFn: () => api.candidate(id), retry: false })
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['anat', 'candidate', id] }), qc.invalidateQueries({ queryKey: ['anat', 'candidates'] })])
  const abort = useRef<AbortController | null>(null)
  const [scope, setScope] = useState('global'); const [baseline, setBaseline] = useState('')
  const run = <T,>(fn: (signal: AbortSignal) => Promise<T>) => { abort.current = new AbortController(); return fn(abort.current.signal) }
  const simulate = useMutation({ mutationFn: () => run((s) => api.simulate(id, s)), onSettled: refresh })
  const compare = useMutation({ mutationFn: () => run((s) => api.compare(id, scope, baseline.trim() || null, s)), onSettled: refresh })
  if (detail.isPending) return <p className="ar-muted">Carregando candidato…</p>
  if (detail.isError) return <p className="ar-error" role="alert">{errorText(detail.error)}</p>
  const d = detail.data; const c = d.candidate
  const busy = simulate.isPending || compare.isPending
  return (
    <div className="ar-stack">
      <div className="ar-card">
        <h2>Candidato {shortHash(c.id)} <span className={`ar-badge ar-state-${c.state}`}>{STATE[c.state]}</span></h2>
        <dl className="ar-meta">
          <dt>Perfis</dt><dd><code>{shortHash(c.ruleHash)}</code></dd><dt>Exemplos</dt><dd><code>{shortHash(c.exampleSetHash)}</code></dd>
          <dt>Motor</dt><dd><code>{shortHash(c.engineHash)}</code></dd><dt>Snapshot</dt><dd><code>{c.ruleSetId}</code></dd>
        </dl>
      </div>
      <div className="ar-card">
        <h2><FlaskConical size={16} /> Simulação</h2>
        <p className="ar-muted">Somente pass em todos os exemplos permite aprovar. Nenhuma seleção positiva é produzida.</p>
        <div className="ar-actions">
          <button type="button" onClick={() => simulate.mutate()} disabled={busy}><Play size={15} /> Simular</button>
          {busy && <button type="button" className="ar-secondary" onClick={() => abort.current?.abort()}><Square size={15} /> Cancelar</button>}
        </div>
        {simulate.isPending && <p role="status" className="ar-muted">Executando em ambiente isolado…</p>}
        {simulate.isError && <p className="ar-error" role="alert">{errorText(simulate.error)}</p>}
        {d.simulations.length === 0 ? <p className="ar-muted">Nenhuma simulação.</p> : d.simulations.slice(0, 3).map((s) => (
          <table key={s.id} className="ar-table"><caption>Simulação {shortHash(s.id)} · {s.status}</caption>
            <thead><tr><th>Exemplo</th><th>Resultado</th></tr></thead>
            <tbody>{s.rows.map((r) => <tr key={r.exampleId}><td>{r.exampleId}</td><td><span className={`ar-badge ar-out-${r.outcome}`}>{OUTCOME[r.outcome]}</span></td></tr>)}</tbody>
          </table>))}
      </div>
      <div className="ar-card">
        <h2><GitCompare size={16} /> Comparação</h2>
        <div className="ar-row">
          <label className="ar-field">Escopo<input value={scope} onChange={(e) => setScope(e.target.value)} /></label>
          <label className="ar-field">Base (snapshot; vazio = regra ativa)<input value={baseline} onChange={(e) => setBaseline(e.target.value)} /></label>
        </div>
        <button type="button" onClick={() => compare.mutate()} disabled={busy}>Comparar com a base</button>
        {compare.isPending && <p role="status" className="ar-muted">Comparando…</p>}
        {compare.isError && <p className="ar-error" role="alert">{errorText(compare.error)}</p>}
      </div>
      <ReviewPanel api={api} detail={d} userId={userId} onDone={refresh} />
      <ActivationPanel api={api} detail={d} onDone={refresh} />
    </div>
  )
}

function ReviewPanel({ api, detail, userId, onDone }: { api: ReturnType<typeof anatomyRulesApi>; detail: CandidateDetail; userId: string; onDone: () => Promise<unknown> }) {
  // Latest comparison per example (the API lists newest first), the same rule as approvalBlockers.
  const seen = new Set<string>()
  const comps = detail.comparisons.filter((k) => (seen.has(k.exampleId) ? false : (seen.add(k.exampleId), true)))
  const [simulationId, setSimulationId] = useState<string | null>(detail.simulations[0]?.id ?? null)
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const [rationale, setRationale] = useState('')
  const blockers = approvalBlockers(detail, simulationId, decisions, userId)
  const isAuthor = userId === detail.candidate.createdBy || userId === detail.candidate.draftAuthor
  const submit = useMutation({
    mutationFn: (outcome: 'approved' | 'rejected') => api.review(detail.candidate.id, {
      simulationId: simulationId!, outcome, rationale, comparisonIds: comps.map((k) => k.id),
      decisions: comps.flatMap((k) => k.envelope.differences.map((d) => ({ comparisonId: k.id, differenceId: d.id, decision: decisions[`${k.id}:${d.id}`] ?? 'not_evaluated' }))),
    }),
    onSuccess: onDone,
  })
  return (
    <div className="ar-card">
      <h2>Revisão</h2>
      {isAuthor && <p className="ar-warn" role="note">Você é autor deste candidato e não pode revisá-lo.</p>}
      <label className="ar-field">Simulação<select value={simulationId ?? ''} onChange={(e) => setSimulationId(e.target.value || null)}>
        <option value="">—</option>{detail.simulations.map((s) => <option key={s.id} value={s.id}>{shortHash(s.id)} · {s.status}</option>)}</select></label>
      {comps.length === 0 ? <p className="ar-muted">Nenhuma comparação ainda.</p> : comps.map((k) => (
        <details key={k.id} className="ar-diff" open>
          <summary>{k.exampleId} · {k.envelope.differences.length} diferença(s) · <code>{shortHash(k.comparisonHash)}</code></summary>
          {k.envelope.differences.length === 0 ? <p className="ar-muted">Sem diferenças. Isso não substitui a simulação.</p> : (
            <table className="ar-table"><thead><tr><th>Item</th><th>Antes</th><th>Depois</th><th>Decisão</th></tr></thead><tbody>
              {k.envelope.differences.map((d) => { const key = `${k.id}:${d.id}`; return (
                <tr key={key}><td>{d.category} · {d.change}<br /><code>{d.key}</code></td><td><pre>{JSON.stringify(d.before, null, 1)}</pre></td><td><pre>{JSON.stringify(d.after, null, 1)}</pre></td>
                  <td><select aria-label={`Decisão ${d.key}`} value={decisions[key] ?? 'not_evaluated'} onChange={(e) => setDecisions((m) => ({ ...m, [key]: e.target.value }))}>
                    <option value="not_evaluated">não avaliada</option><option value="expected">esperada</option><option value="regression">regressão</option></select></td></tr>) })}
            </tbody></table>)}
        </details>))}
      <label className="ar-field">Justificativa (10 a 4000 caracteres; não vai para a auditoria)<textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} /></label>
      {blockers.length > 0 && <ul className="ar-blockers" aria-label="Pendências para aprovar">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>}
      <div className="ar-actions">
        <button type="button" onClick={() => submit.mutate('approved')} disabled={blockers.length > 0 || rationale.trim().length < 10 || submit.isPending}>Aprovar</button>
        <button type="button" className="ar-secondary" onClick={() => submit.mutate('rejected')} disabled={isAuthor || !simulationId || rationale.trim().length < 10 || submit.isPending}>Rejeitar</button>
      </div>
      {submit.isError && <p className="ar-error" role="alert">{errorText(submit.error)}</p>}
      {submit.isSuccess && <p className="ar-ok" role="status">Revisão registrada.</p>}
      {detail.reviews.length > 0 && <ul className="ar-list ar-compact">{detail.reviews.map((r) => <li key={r.id}>{r.outcome === 'approved' ? 'Aprovada' : 'Rejeitada'} · {shortHash(r.id)}</li>)}</ul>}
    </div>
  )
}

function ActivationPanel({ api, detail, onDone }: { api: ReturnType<typeof anatomyRulesApi>; detail: CandidateDetail; onDone: () => Promise<unknown> }) {
  const approved = detail.reviews.filter((r) => r.outcome === 'approved')
  // The selection defaults to the newest approved review (approvals may arrive after this panel first rendered).
  const [chosen, setReviewId] = useState('')
  const reviewId = approved.some((r) => r.id === chosen) ? chosen : (approved[0]?.id ?? '')
  const [scope, setScope] = useState('global'); const [action, setAction] = useState<'activate' | 'rollback'>('activate')
  // P4-R1-01: a preview is bound to the candidate, action and scope it was generated for; it is never shown (nor
  // confirmable) under another candidate, and a late response for a previous selection is dropped.
  const [held, setPending] = useState<{ preview: Preview; candidateId: string; action: 'activate' | 'rollback'; scope: string } | null>(null)
  const [justification, setJustification] = useState('')
  const candidateId = detail.candidate.id
  const pending = held && held.candidateId === candidateId ? held : null
  const preview = useMutation({
    mutationFn: async () => ({ preview: await api.preview({ action, candidateId, reviewId, scope }), candidateId, action, scope }),
    onSuccess: (p) => { if (p.candidateId === candidateId) setPending(p) },
  })
  const confirm = useMutation({
    mutationFn: () => { if (!pending || pending.candidateId !== candidateId) throw new Error('preview_not_for_this_candidate'); return api.confirm({ token: pending.preview.token, intentHash: pending.preview.intentHash, justification }) },
    onSuccess: async () => { setPending(null); await onDone() },
    onError: (e) => { if (e instanceof AnatomyRulesApiError && ['PREVIEW_EXPIRED', 'PREVIEW_STALE', 'PREVIEW_CONSUMED'].includes(e.code)) setPending(null) },
  })
  if (approved.length === 0) return <div className="ar-card"><h2>Ativação</h2><p className="ar-muted">Disponível após uma revisão aprovada.</p></div>
  return (
    <div className="ar-card">
      <h2>Ativação e retorno</h2>
      {!pending ? (<>
        <div className="ar-row">
          <label className="ar-field">Ação<select value={action} onChange={(e) => setAction(e.target.value as 'activate' | 'rollback')}><option value="activate">Ativar</option><option value="rollback">Retornar</option></select></label>
          <label className="ar-field">Escopo<input value={scope} onChange={(e) => setScope(e.target.value)} /></label>
          <label className="ar-field">Revisão<select value={reviewId} onChange={(e) => setReviewId(e.target.value)}>{approved.map((r) => <option key={r.id} value={r.id}>{shortHash(r.id)}</option>)}</select></label>
        </div>
        <button type="button" onClick={() => preview.mutate()} disabled={!reviewId || preview.isPending}>Gerar prévia</button>
        {preview.isError && <p className="ar-error" role="alert">{errorText(preview.error)}</p>}
        {confirm.isError && <p className="ar-error" role="alert">{errorText(confirm.error)}</p>}
        {confirm.isSuccess && <p className="ar-ok" role="status">{confirm.data.replayed ? 'Ativação já registrada (repetição).' : 'Ativação registrada.'}</p>}
      </>) : (
        <div className="ar-confirm" role="region" aria-label="Confirmar ativação">
          <p><strong>Candidato {shortHash(pending.candidateId)}</strong> · {pending.action === 'activate' ? 'Ativar' : 'Retornar'} · escopo {pending.scope}</p>
          <p>Prévia {shortHash(pending.preview.previewId)} · expira {new Date(pending.preview.expiresAt).toLocaleTimeString('pt-BR')} · base: {pending.preview.affectedScope.basis === 'active_candidate' ? 'regra ativa' : 'perfis padrão do motor'}</p>
          <table className="ar-table"><thead><tr><th>Fonte</th><th>Família</th><th>Perfil efetivo</th></tr></thead><tbody>
            {pending.preview.affectedScope.targets.map((t) => <tr key={`${t.source}|${t.family ?? ''}`}><td>{t.source}</td><td>{t.family ?? 'todas'}</td><td>{t.changed ? 'muda' : 'igual'}</td></tr>)}
          </tbody></table>
          <ul className="ar-limits">
            <li>Publicações afetadas: <strong>não suportado</strong> — {pending.preview.affectedScope.publications.reason}</li>
            <li>Análises existentes: <strong>não suportado</strong> — {pending.preview.affectedScope.analyses.reason}</li>
            <li>Família desconhecida: {pending.preview.affectedScope.unknownFamily}</li>
            <li>Nada é reprocessado ao ativar ou retornar.</li>
          </ul>
          <label className="ar-field">Justificativa da ativação (10 a 4000 caracteres)<textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} /></label>
          <div className="ar-actions">
            <button type="button" onClick={() => confirm.mutate()} disabled={justification.trim().length < 10 || confirm.isPending}>Confirmar</button>
            <button type="button" className="ar-secondary" onClick={() => setPending(null)}>Descartar prévia</button>
          </div>
        </div>
      )}
    </div>
  )
}

function HistoryPanel({ api }: { api: ReturnType<typeof anatomyRulesApi> }) {
  const activations = useQuery({ queryKey: ['anat', 'activations'], queryFn: api.activations, retry: false })
  const audit = useQuery({ queryKey: ['anat', 'audit'], queryFn: api.audit, retry: false })
  return (
    <section className="ar-card ar-history" aria-label="Histórico">
      <h2><History size={16} /> Histórico</h2>
      <h3>Ativações</h3>
      {activations.isPending ? <p className="ar-muted">Carregando…</p> : activations.isError ? <p className="ar-error" role="alert">{errorText(activations.error)}</p>
        : activations.data.length === 0 ? <p className="ar-muted">Nenhuma ativação.</p>
        : <ul className="ar-list ar-compact">{activations.data.map((a) => <li key={a.id}>{a.kind === 'activate' ? 'Ativação' : 'Retorno'} · {a.scope} · candidato {shortHash(a.candidateId)} · {a.supersededAt ? 'substituída' : 'vigente'}</li>)}</ul>}
      <h3>Auditoria</h3>
      {audit.isPending ? <p className="ar-muted">Carregando…</p> : audit.isError ? <p className="ar-error" role="alert">{errorText(audit.error)}</p>
        : audit.data.length === 0 ? <p className="ar-muted">Sem eventos.</p>
        : <ul className="ar-list ar-compact">{audit.data.slice(0, 50).map((e) => <li key={e.id}><code>{e.action.replace('ANAT_RULES_', '')}</code> · {new Date(e.occurredAt).toLocaleString('pt-BR')}</li>)}</ul>}
    </section>
  )
}
