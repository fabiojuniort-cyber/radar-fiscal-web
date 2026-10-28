import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, History, ListChecks, Play, RotateCcw, Save, Undo2, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  AnatomyConfigError, anatomyConfigApi, describeChange, sameChange, scopeLabel,
  type Analysis, type AnatomyConfigApi, type Change, type Correction, type Described, type Nature, type Overview, type Passage, type Scope, type Suggestion,
} from './anatomy-config-api'
import type { ProductApiFetch } from './product-api'
import './anatomy-config.css'

/**
 * ANAT-CONFIG-01 (tribusca-control#116): accessible anatomy configuration. The administrator sees the act and its
 * structure side by side, the AI's reading with evidence, corrects one passage or creates a rule for similar passages
 * (explicit scope), tests the proposal (real before/after counts) and saves: saving validates and applies in one action.
 * No JSON is needed anywhere in the common flow.
 */
const NATURES: Nature[] = ['operative', 'historical', 'editorial_note', 'amendment', 'structure', 'ambiguous']
type Tab = 'trecho' | 'regras' | 'conferencia' | 'historico'
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')

export function AnatomyConfigPage({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const api = useMemo(() => anatomyConfigApi(apiFetch), [apiFetch])
  const qc = useQueryClient()
  const overview = useQuery({ queryKey: ['anat-config'], queryFn: api.overview })
  const base = useQuery({ queryKey: ['anat-config-analysis', overview.data?.current.version], queryFn: () => api.analysis({}), enabled: !!overview.data })
  const [sampleId, setSampleId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('trecho')
  const [changes, setChanges] = useState<Change[]>([])
  const [corrections, setCorrections] = useState<Correction[] | null>(null) // null = unchanged from the version in force
  const [preview, setPreview] = useState<{ signature: string; analysis: Analysis } | null>(null)
  const [showAfter, setShowAfter] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<AnatomyConfigError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [note, setNote] = useState('')

  if (overview.isError) return <Shell><p className="ac-error" role="alert">{(overview.error as AnatomyConfigError).message}</p></Shell>
  if (!overview.data) return <Shell><p className="ac-muted">Carregando a configuração…</p></Shell>
  const ov = overview.data
  const effectiveCorrections = corrections ?? ov.current.corrections
  const signature = JSON.stringify({ changes, corrections: effectiveCorrections })
  const dirty = changes.length > 0 || corrections !== null
  const tested = preview !== null && preview.signature === signature
  const analysis = tested && showAfter ? preview.analysis : base.data
  const activeSample = sampleId ?? ov.samples[0]?.id ?? null
  const sa = analysis?.samples.find((s) => s.id === activeSample)
  const described: Described | undefined = sa ? (tested && showAfter ? sa.after : sa.before) : undefined
  const changedKeys = new Map((tested ? preview.analysis.samples.find((s) => s.id === activeSample)?.diff.changed ?? [] : []).map((c) => [c.key, c]))
  const passage = described?.passages.find((p) => p.key === selected) ?? null
  const reviewAll = (analysis?.samples ?? []).flatMap((s) => (tested && showAfter ? s.after : s.before).review)

  const reset = () => { setChanges([]); setCorrections(null); setPreview(null); setConfirming(false); setNote('') }
  const addChange = (c: Change) => {
    // Adding the inverse of a pending change cancels it (undo by editing).
    const inverse = changes.findIndex((x) => sameChange(x, { ...c, action: c.action === 'add' ? 'remove' : 'add' }))
    if (inverse >= 0) setChanges(changes.filter((_, i) => i !== inverse))
    else if (!changes.some((x) => sameChange(x, c))) setChanges([...changes, c])
    setNotice(null); setError(null)
  }
  const setCorrection = (c: Correction | null, key: string) => {
    const rest = effectiveCorrections.filter((x) => !(x.sampleId === activeSample && x.partKey === key))
    setCorrections(c ? [...rest, c] : rest); setNotice(null); setError(null)
  }
  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label); setError(null); setNotice(null)
    try { await fn() } catch (e) { setError(e instanceof AnatomyConfigError ? e : new AnatomyConfigError('client', 0, 'Não foi possível concluir. Verifique a conexão e tente de novo.')) } finally { setBusy(null) }
  }
  const test = () => run('Testando no conjunto de exemplos…', async () => {
    const analysis = await api.analysis({ changes, corrections: effectiveCorrections })
    setPreview({ signature, analysis }); setShowAfter(true)
  })
  const save = () => run('Salvando e aplicando…', async () => {
    const r = await api.save({ basedOnVersion: ov.current.version, changes, corrections: effectiveCorrections, ...(note.trim() ? { note: note.trim() } : {}) })
    reset(); await qc.invalidateQueries({ queryKey: ['anat-config'] }); await qc.invalidateQueries({ queryKey: ['anat-config-versions'] })
    setNotice(`Configuração salva e aplicada (versão ${r.version}). Vale para as novas análises; nada do acervo foi reprocessado.`)
  })
  const reload = () => run('Recarregando a versão atual…', async () => { setPreview(null); await qc.invalidateQueries({ queryKey: ['anat-config'] }) })

  return (
    <Shell>
      <header className="ac-header">
        <div>
          <h1>Anatomia dos atos</h1>
          <p className="ac-muted">A IA leu os exemplos, montou a estrutura e classificou cada trecho. Confira, ajuste em português e teste antes de salvar.</p>
        </div>
        <div className="ac-status" aria-label="Configuração em uso">
          <strong>{ov.current.origin === 'shipped' ? 'Configuração de fábrica' : `Versão ${ov.current.version} em uso`}</strong>
          <span className="ac-muted">{ov.current.origin === 'saved' ? `Salva em ${fmtDate(ov.current.createdAt)}${ov.current.note ? ` — ${ov.current.note}` : ''}` : 'Nenhuma alteração salva ainda.'}</span>
        </div>
      </header>
      <p className="ac-banner" role="note">
        <b>Exemplos sintéticos.</b> Os atos desta tela foram escritos para teste e não reproduzem normas reais. A anatomia baseada em atos oficiais será acrescentada quando as fontes estiverem acessíveis.
      </p>

      <nav className="ac-samples" aria-label="Atos de exemplo">
        {ov.samples.map((s) => {
          const count = analysis?.samples.find((x) => x.id === s.id)
          const n = count ? (tested && showAfter ? count.after : count.before).review.length : null
          return (
            <button key={s.id} type="button" aria-pressed={s.id === activeSample} onClick={() => { setSampleId(s.id); setSelected(null) }}>
              <span className="ac-chip ac-src">{ov.sources[s.source] ?? s.source}</span>
              <span>{s.title}</span>
              {n !== null && n > 0 && <span className="ac-count" aria-label={`${n} casos a conferir`}>{n}</span>}
            </button>
          )
        })}
      </nav>

      <div className="ac-legend" aria-label="Legenda">
        {NATURES.map((n) => <span key={n} className={`ac-chip k-${n}`}>{ov.natures[n]}</span>)}
        {tested && (
          <span className="ac-toggle" role="group" aria-label="Ver configuração">
            <button type="button" aria-pressed={!showAfter} onClick={() => setShowAfter(false)}>Antes</button>
            <button type="button" aria-pressed={showAfter} onClick={() => setShowAfter(true)}>Depois (proposta)</button>
          </span>
        )}
      </div>

      <div className="ac-grid">
        <nav className="ac-tree" aria-label="Estrutura do ato">
          <h2>Estrutura</h2>
          {!described && <p className="ac-muted">{base.isError ? (base.error as AnatomyConfigError).message : 'Analisando os exemplos…'}</p>}
          <ul>
            {described?.passages.map((p) => (
              <li key={p.key} style={{ paddingLeft: `${p.depth * 12}px` }}>
                <button type="button" aria-current={p.key === selected} aria-label={`${p.structure}: ${p.natureLabel}`} onClick={() => { setSelected(p.key); setTab('trecho') }}>
                  <span className={`ac-dot k-${p.nature}`} aria-hidden="true" />
                  <span className="ac-tree-label">{p.structure}{p.type !== 'unidentified' && p.label && p.label.length < 28 ? ` · ${p.label}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="ac-doc" aria-label="Texto do ato">
          {sa && <div className="ac-doc-head">{sa.title} · {ov.sources[sa.source] ?? sa.source} · resultado {described?.statusLabel.toLowerCase()}{tested && showAfter ? ' · mostrando a proposta' : ''}</div>}
          {described?.passages.map((p) => {
            const ch = changedKeys.get(p.key)
            return (
              <button type="button" key={p.key} data-k={p.nature} className={`ac-seg${p.key === selected ? ' sel' : ''}${ch && showAfter ? ' chg' : ''}`}
                style={{ marginLeft: `${Math.min(p.depth, 3) * 18}px` }} onClick={() => { setSelected(p.key); setTab('trecho') }}
                aria-label={`${p.structure}: ${p.natureLabel}`}>
                {ch && showAfter && <span className="ac-was">antes: {ch.fromLabel}</span>}
                {p.text || <i>(sem texto próprio)</i>}
              </button>
            )
          })}
        </article>

        <aside className="ac-side">
          <div className="ac-tabs" role="tablist">
            {([['trecho', 'Trecho'], ['regras', 'Regras'], ['conferencia', `Conferência (${reviewAll.length})`], ['historico', 'Histórico']] as [Tab, string][]).map(([t, label]) => (
              <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
            ))}
          </div>
          {tab === 'trecho' && <PassagePanel ov={ov} api={api} sampleId={activeSample} passage={passage}
            correction={effectiveCorrections.find((c) => c.sampleId === activeSample && c.partKey === selected) ?? null}
            onCorrect={(c) => passage && setCorrection(c, passage.key)} onAdd={addChange} />}
          {tab === 'regras' && <RulesPanel ov={ov} changes={changes} onAdd={addChange} />}
          {tab === 'conferencia' && <ReviewPanel ov={ov} items={reviewAll} onOpen={(sid, key) => { setSampleId(sid); setSelected(key); setTab('trecho') }} />}
          {tab === 'historico' && <HistoryPanel api={api} ov={ov} dirty={dirty} onRestored={async (v) => { reset(); await qc.invalidateQueries({ queryKey: ['anat-config'] }); setNotice(`Versão anterior restaurada como versão ${v}. A restauração foi registrada na auditoria.`) }} />}

          <section className="ac-pending" aria-label="Alterações em preparação">
            <h2>Alterações em preparação</h2>
            {!dirty && <p className="ac-muted">Nenhuma. Corrija um trecho ou crie uma regra para começar.</p>}
            {changes.length > 0 && (
              <ol>
                {changes.map((c, i) => (
                  <li key={i}><span>{describeChange(c, ov.catalog, ov.sources)}</span>
                    <button type="button" className="ac-link" onClick={() => { setChanges(changes.filter((_, j) => j !== i)); setError(null); setNotice(null) }}><Undo2 size={14} /> Desfazer</button></li>
                ))}
              </ol>
            )}
            {corrections !== null && <p className="ac-muted">Correções de trecho: {effectiveCorrections.length} (antes {ov.current.corrections.length}). <button type="button" className="ac-link" onClick={() => { setCorrections(null); setError(null) }}>Desfazer correções</button></p>}
            {tested && (
              <div className="ac-diff" aria-live="polite">
                <b>Resultado do teste em {preview.analysis.totals.samples} atos de exemplo</b>
                <ul>
                  <li>{preview.analysis.totals.changedPassages} trecho(s) mudam de natureza em {preview.analysis.totals.samplesChanged} ato(s).</li>
                  <li>Casos a conferir: {preview.analysis.totals.reviewBefore} → {preview.analysis.totals.reviewAfter}.</li>
                </ul>
                {preview.analysis.samples.flatMap((s) => s.diff.changed.map((c) => (
                  <p key={s.id + c.key} className="ac-change"><span className={`ac-chip k-${c.from}`}>{c.fromLabel}</span> → <span className={`ac-chip k-${c.to}`}>{c.toLabel}</span> {c.structure}: “{c.text.slice(0, 70)}”</p>
                )))}
                {preview.analysis.totals.changedPassages === 0 && <p className="ac-muted">Nenhum trecho dos exemplos muda. Salvar ainda é possível (por exemplo, para registrar correções).</p>}
              </div>
            )}
            {busy && <p className="ac-muted" role="status">{busy}</p>}
            {error && (
              <div className="ac-error" role="alert">
                <p>{error.message}</p>
                {error.issues.length > 0 && <ul>{error.issues.map((x, i) => <li key={i}>{x.message}</li>)}</ul>}
                {error.code === 'STALE_VERSION' && <button type="button" className="ac-secondary" onClick={reload}>Recarregar a versão atual</button>}
              </div>
            )}
            {notice && <p className="ac-ok" role="status">{notice}</p>}
            {!confirming ? (
              <div className="ac-actions">
                <button type="button" disabled={!dirty || !!busy} onClick={test}><Play size={15} /> Testar alterações</button>
                <button type="button" disabled={!tested || !!busy} onClick={() => setConfirming(true)} title={tested ? '' : 'Teste as alterações antes de salvar'}><Save size={15} /> Salvar configuração</button>
                <button type="button" className="ac-secondary" disabled={!dirty || !!busy} onClick={reset}><RotateCcw size={15} /> Descartar</button>
              </div>
            ) : (
              <div className="ac-confirm" role="region" aria-label="Confirmar salvamento">
                <p>Ao salvar, a configuração é validada e passa a valer imediatamente para as <b>novas análises</b>. Nada do acervo é reprocessado. A versão atual fica no histórico e pode ser restaurada.</p>
                <label className="ac-field">Observação (opcional)<input id="ac-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: estilo de nota do CONFAZ" /></label>
                <div className="ac-actions">
                  <button type="button" disabled={!!busy} onClick={save}><Save size={15} /> Confirmar e salvar</button>
                  <button type="button" className="ac-secondary" onClick={() => setConfirming(false)}>Voltar</button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="ac-app"><Link className="ac-back" to="/painel"><ArrowLeft size={15} /> Voltar ao painel</Link>{children}</main>
}

function PassagePanel({ ov, api, sampleId, passage, correction, onCorrect, onAdd }: {
  ov: Overview; api: AnatomyConfigApi; sampleId: string | null; passage: Passage | null; correction: Correction | null
  onCorrect: (c: Correction | null) => void; onAdd: (c: Change) => void
}) {
  const [fix, setFix] = useState<Nature>('editorial_note')
  const [wanted, setWanted] = useState<Nature>('editorial_note')
  const [sug, setSug] = useState<{ suggestions: Suggestion[]; unsupported: string | null } | null>(null)
  const [scopeChoice, setScopeChoice] = useState<Record<number, string>>({})
  const [family, setFamily] = useState('')
  const [err, setErr] = useState<string | null>(null)
  if (!passage || !sampleId) return <section className="ac-panel"><p className="ac-muted">Clique num trecho do texto ou da estrutura para ver como ele foi lido.</p></section>
  const ai = passage.ai
  const scopeFor = (s: Suggestion, i: number): Scope | null => {
    const v = scopeChoice[i] ?? 'source'
    if (v === 'default') return { level: 'default' }
    if (v === 'family') return family.trim() ? { level: 'family', source: (s.scope as { source: string }).source, family: family.trim() } : null
    return s.scope
  }
  return (
    <section className="ac-panel" aria-label="Trecho selecionado">
      <dl className="ac-dims">
        <dt>Estrutura</dt><dd>{passage.structure}{passage.label && passage.label.length < 40 ? ` — ${passage.label}` : ''}</dd>
        <dt>Natureza</dt><dd><span className={`ac-chip k-${passage.nature}`}>{passage.natureLabel}</span></dd>
        <dt>Vigência</dt><dd>{passage.validityLabel}<span className="ac-muted"> (notas e estilos não decidem a vigência)</span></dd>
      </dl>
      {passage.reasons.length > 0 && <p className="ac-why"><b>Por que:</b> {passage.reasons.join('; ')}.</p>}
      {(passage.references.length > 0 || passage.ncm.length > 0) && (
        <p className="ac-muted">{passage.references.length > 0 && <>Cita: {passage.references.join('; ')}. </>}{passage.ncm.length > 0 && <>NCM no trecho: {passage.ncm.join(', ')}.</>}</p>
      )}
      {ai ? (
        <div className="ac-ai">
          <h3><Wand2 size={14} /> Leitura da IA</h3>
          <p><span className={`ac-chip k-${ai.nature}`}>{ai.natureLabel}</span> · {ai.structure} · vigência: {ai.validityLabel}</p>
          <p>{ai.explanation}</p>
          <p className="ac-ev"><b>Evidência:</b> {ai.evidence}</p>
          {ai.references && ai.references.length > 0 && <p className="ac-muted">Referências: {ai.references.join('; ')}</p>}
          {ai.ambiguity && <p className="ac-warn"><b>Ambíguo:</b> {ai.ambiguity}</p>}
          <p className="ac-muted"><b>Segunda conferência{ai.secondCheck.agrees ? '' : ' (divergência)'}:</b> {ai.secondCheck.note}</p>
        </div>
      ) : <p className="ac-muted">A IA não tem leitura própria para este trecho.</p>}

      <h3>Corrigir só este trecho</h3>
      <p className="ac-muted">Vale apenas para este trecho deste ato. Fica registrada e entra na lista de conferência até uma regra atendê-la; sozinha, não muda o processamento.</p>
      {correction && <p className="ac-ok">Sua correção: {ov.natures[correction.expected]}. <button type="button" className="ac-link" onClick={() => onCorrect(null)}>Retirar correção</button></p>}
      <div className="ac-row">
        <label className="ac-field">Este trecho é<select id="ac-fix" value={fix} onChange={(e) => setFix(e.target.value as Nature)}>{NATURES.map((n) => <option key={n} value={n}>{ov.natures[n]}</option>)}</select></label>
        <button type="button" className="ac-secondary" onClick={() => onCorrect({ sampleId, partKey: passage.key, expected: fix })}>Registrar correção</button>
      </div>

      <h3>Criar regra para trechos semelhantes</h3>
      <div className="ac-row">
        <label className="ac-field">Tratar como<select id="ac-wanted" value={wanted} onChange={(e) => { setWanted(e.target.value as Nature); setSug(null) }}>{NATURES.filter((n) => n !== 'ambiguous').map((n) => <option key={n} value={n}>{ov.natures[n]}</option>)}</select></label>
        <button type="button" className="ac-secondary" onClick={async () => {
          setErr(null)
          try { setSug(await api.suggestions({ sampleId, text: passage.text, wanted })) } catch (e) { setErr(e instanceof AnatomyConfigError ? e.message : 'Não foi possível buscar sugestões.') }
        }}>Ver sugestão</button>
      </div>
      {err && <p className="ac-error" role="alert">{err}</p>}
      {sug?.unsupported && <p className="ac-warn">{sug.unsupported}</p>}
      {sug?.suggestions.map((s, i) => (
        <div key={i} className="ac-sug">
          <p><b>{s.description}</b></p>
          <p className="ac-muted">{s.why}</p>
          <label className="ac-field">Alcance
            <select id={`ac-scope-${i}`} value={scopeChoice[i] ?? 'source'} onChange={(e) => setScopeChoice({ ...scopeChoice, [i]: e.target.value })}>
              <option value="source">{scopeLabel(s.scope, ov.sources)}</option>
              <option value="default">Padrão geral (todas as fontes)</option>
              <option value="family">Só uma família de atos desta fonte</option>
            </select>
          </label>
          {(scopeChoice[i] ?? 'source') === 'family' && <label className="ac-field">Nome da família<input id={`ac-family-${i}`} value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Ex.: Ajuste SINIEF" /></label>}
          <button type="button" onClick={() => {
            const scope = scopeFor(s, i)
            if (!scope) { setErr('Informe o nome da família para usar esse alcance.'); return }
            onAdd({ scope, path: s.path, action: s.action, literal: s.literal })
          }}>Adicionar à proposta</button>
        </div>
      ))}
    </section>
  )
}

function RulesPanel({ ov, changes, onAdd }: { ov: Overview; changes: Change[]; onAdd: (c: Change) => void }) {
  const [path, setPath] = useState(ov.catalog[0]?.path ?? '')
  const [scopeKey, setScopeKey] = useState('source:CONFAZ')
  const [family, setFamily] = useState('')
  const [literal, setLiteral] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const field = ov.catalog.find((f) => f.path === path)
  const sources = Object.keys(ov.sources)
  const parseScope = (): Scope | null => {
    if (scopeKey === 'default') return { level: 'default' }
    const [kind, source] = scopeKey.split(':') as [string, string]
    if (kind === 'family') return family.trim() ? { level: 'family', source, family: family.trim() } : null
    return { level: 'source', source }
  }
  const pendingFor = (row: { scope: Scope; path: string }, lit: string) => changes.find((c) => c.path === row.path && c.literal === lit && JSON.stringify(c.scope) === JSON.stringify(row.scope))
  return (
    <section className="ac-panel" aria-label="Regras">
      <h3>Nova regra</h3>
      <label className="ac-field">Tipo de regra<select id="ac-rule-type" value={path} onChange={(e) => setPath(e.target.value)}>{ov.catalog.map((f) => <option key={f.path} value={f.path}>{f.title}</option>)}</select></label>
      {field && <p className="ac-muted">{field.help} Exemplo: <code>{field.example}</code></p>}
      <label className="ac-field">Alcance<select id="ac-rule-scope" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)}>
        <option value="default">Padrão geral (todas as fontes)</option>
        {sources.map((s) => <option key={s} value={`source:${s}`}>Fonte: {ov.sources[s]}</option>)}
        {sources.map((s) => <option key={`f${s}`} value={`family:${s}`}>Uma família da fonte {ov.sources[s]}</option>)}
      </select></label>
      {scopeKey.startsWith('family:') && <label className="ac-field">Nome da família<input id="ac-rule-family" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="Ex.: Ajuste SINIEF" /></label>}
      <label className="ac-field">Texto<input id="ac-rule-literal" value={literal} onChange={(e) => setLiteral(e.target.value)} placeholder={field ? `Ex.: ${field.example}` : ''} /></label>
      {err && <p className="ac-error" role="alert">{err}</p>}
      <button type="button" onClick={() => {
        const scope = parseScope()
        if (!literal.trim()) { setErr(`Informe o texto para "${field?.title ?? 'a regra'}".`); return }
        if (field?.kind === 'style' && /\s/u.test(literal.trim())) { setErr('Nome de estilo não pode ter espaço. Use o nome exatamente como aparece no ato.'); return }
        if (!scope) { setErr('Informe o nome da família para usar esse alcance.'); return }
        setErr(null); onAdd({ scope, path, action: 'add', literal: literal.trim() }); setLiteral('')
      }}>Adicionar à proposta</button>

      <h3>Regras em uso</h3>
      <p className="ac-muted">Clique em × para propor a retirada de um item. Proteções de fábrica não podem ser retiradas; o teste avisa.</p>
      <ul className="ac-rules">
        {ov.current.rules.map((row, i) => (
          <li key={i}>
            <p><b>{row.title}</b> <span className="ac-muted">— {row.scopeLabel}</span></p>
            <div className="ac-literals">
              {row.literals.length === 0 && <span className="ac-muted">(nenhum)</span>}
              {row.literals.map((lit) => {
                const pend = pendingFor(row, lit)
                return <span key={lit} className={`ac-lit${pend ? ' removed' : ''}`}>{lit}
                  <button type="button" aria-label={`Retirar ${lit} de ${row.title}`} disabled={!!pend} onClick={() => onAdd({ scope: row.scope, path: row.path, action: 'remove', literal: lit })}>×</button></span>
              })}
              {changes.filter((c) => c.action === 'add' && c.path === row.path && JSON.stringify(c.scope) === JSON.stringify(row.scope)).map((c) => <span key={c.literal} className="ac-lit added">{c.literal} (novo)</span>)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ReviewPanel({ ov, items, onOpen }: { ov: Overview; items: { sampleId: string; partKey: string | null; kind: string; title: string; detail: string }[]; onOpen: (sampleId: string, key: string | null) => void }) {
  if (items.length === 0) return <section className="ac-panel"><p className="ac-ok">Nenhum caso a conferir nos exemplos.</p></section>
  return (
    <section className="ac-panel" aria-label="Casos que precisam de conferência">
      <p className="ac-muted"><ListChecks size={14} /> Casos em que o motor não reconheceu o trecho, a leitura da IA difere, há ambiguidade, uma correção sua ainda não é atendida, ou o motor tem uma limitação.</p>
      <ul className="ac-review">
        {items.map((r, i) => (
          <li key={i}><button type="button" onClick={() => onOpen(r.sampleId, r.partKey)}>
            <span className="ac-muted">{ov.samples.find((s) => s.id === r.sampleId)?.title}</span>
            <b>{r.title}</b><span>{r.detail}</span></button></li>
        ))}
      </ul>
    </section>
  )
}

function HistoryPanel({ api, ov, dirty, onRestored }: { api: AnatomyConfigApi; ov: Overview; dirty: boolean; onRestored: (version: number) => Promise<void> }) {
  const versions = useQuery({ queryKey: ['anat-config-versions', ov.current.version], queryFn: api.versions })
  const audit = useQuery({ queryKey: ['anat-config-audit', ov.current.version], queryFn: api.audit })
  const [confirm, setConfirm] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <section className="ac-panel" aria-label="Histórico de versões">
      <h3><History size={14} /> Versões</h3>
      {versions.data?.length === 0 && <p className="ac-muted">Nenhuma versão salva: está em uso a configuração de fábrica.</p>}
      <ol className="ac-versions">
        {versions.data?.map((v) => (
          <li key={v.id}>
            <p><b>Versão {v.version}</b>{v.current && <span className="ac-chip k-operative">em uso</span>} <span className="ac-muted">{fmtDate(v.createdAt)} · {v.authorEmail ?? 'administrador'}</span></p>
            <p className="ac-muted">{v.kind === 'restore' ? `Restauração da versão ${v.restoredFromVersion}` : 'Salva'}{v.note ? ` — ${v.note}` : ''}{v.correctionCount ? ` · ${v.correctionCount} correção(ões)` : ''}</p>
            {!v.current && (confirm === v.id ? (
              <div className="ac-confirm">
                <p>Restaurar cria a versão {ov.current.version + 1} com o conteúdo da versão {v.version}, aplicada imediatamente às novas análises. {dirty ? 'Suas alterações em preparação serão descartadas.' : ''}</p>
                <label className="ac-field">Motivo (opcional)<input id={`ac-restore-note-${v.version}`} value={note} onChange={(e) => setNote(e.target.value)} /></label>
                {err && <p className="ac-error" role="alert">{err}</p>}
                <div className="ac-actions">
                  <button type="button" onClick={async () => {
                    setErr(null)
                    try { const r = await api.restore({ basedOnVersion: ov.current.version, versionId: v.id, ...(note.trim() ? { note: note.trim() } : {}) }); setConfirm(null); setNote(''); await onRestored(r.version) } catch (e) { setErr(e instanceof AnatomyConfigError ? e.message : 'Não foi possível restaurar.') }
                  }}>Confirmar restauração</button>
                  <button type="button" className="ac-secondary" onClick={() => setConfirm(null)}>Voltar</button>
                </div>
              </div>
            ) : <button type="button" className="ac-secondary" onClick={() => setConfirm(v.id)}><RotateCcw size={14} /> Restaurar esta versão</button>)}
          </li>
        ))}
      </ol>
      <h3>Auditoria</h3>
      <ul className="ac-audit">
        {audit.data?.map((a) => (
          <li key={a.id}><span className="ac-muted">{fmtDate(a.occurredAt)}</span> {a.action === 'ANAT_RULES_CONFIG_SAVED' ? (a.data.kind === 'RESTORE' ? 'Restauração' : 'Salvamento') : 'Tentativa recusada'}
            {typeof a.data.version === 'number' ? ` · versão ${a.data.version}` : ''}{typeof a.data.code === 'string' ? ` · ${a.data.code === 'STALE_VERSION' ? 'versão desatualizada' : a.data.code}` : ''} · {a.actorEmail ?? 'administrador'}</li>
        ))}
      </ul>
    </section>
  )
}
