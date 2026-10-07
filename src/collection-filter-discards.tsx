import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleHelp } from 'lucide-react'
import type { ProductApiFetch } from './product-api'
import {
  fetchCollectionFilterDiscards,
  fetchCollectionFilterDiscardAlerts,
  type CollectionFilterDiscardAlert,
} from './collection-filter-api'

const PAGE_SIZE = 50
const REASONS: Record<string, string> = {
  NO_TAX_TERM: 'Nenhum termo tributário identificado',
  EXCLUDE_ALWAYS: 'Tipo configurado para excluir sempre',
  NO_STRONG_TERM: 'Nenhum termo forte identificado',
}

function date(value: string | null, time = false) {
  if (!value) return 'Não informado'
  const parsed = new Date(time ? value : `${value.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return 'Não informado'
  return time
    ? parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function safeUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

function percent(value: number | string) {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(number)
    : 'Não informado'
}

export function CollectionFilterDiscards({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const [input, setInput] = useState('')
  const [source, setSource] = useState('')
  const [page, setPage] = useState(0)
  const query = useQuery({
    queryKey: ['collection-filter', 'discarded', source, page],
    queryFn: () => fetchCollectionFilterDiscards(apiFetch, {
      sourceCode: source, limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE,
    }),
    retry: false,
  })
  function filter(event: FormEvent) {
    event.preventDefault()
    setSource(input.trim().toLowerCase())
    setPage(0)
  }
  const items = query.data?.items.slice(0, PAGE_SIZE) ?? []
  return <section className="cf-card cf-discard-panel" aria-labelledby="cf-discard-title">
    <div className="cf-card-title"><h2 id="cf-discard-title">Desconsiderados</h2>
      <p>Publicações descartadas antes de entrar no acervo. Trilha operacional por 3 meses, sem texto integral ou resumo.</p>
    </div>
    <details className="cf-settings"><summary><CircleHelp size={16} aria-hidden="true" />Ajuda — Desconsiderados</summary>
      <p>A fonte usa o código do coletor, como dou. O filtro busca no servidor e reinicia a paginação. Motivo e termo explicam a decisão; a versão e a revisão identificam a política aplicada. Expiração indica quando termina a guarda de 3 meses. O link oficial permite conferir o ato original.</p>
    </details>
    <form className="cf-review-filters" onSubmit={filter}>
      <label>Fonte<input value={input} maxLength={100} placeholder="Todas as fontes · código, ex.: dou" onChange={event => setInput(event.target.value)} /></label>
      <button type="submit">Filtrar</button>
      <button type="button" onClick={() => { setInput(''); setSource(''); setPage(0) }}>Limpar filtro</button>
      <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar desconsiderados</button>
    </form>
    {query.isPending ? <p role="status">Carregando desconsiderados…</p>
      : query.isError ? <div className="cf-error" role="alert">Não foi possível carregar os desconsiderados. Tente atualizar.</div>
      : <>
        {!items.length && <p className="cf-empty">Nenhum desconsiderado nesta página para a fonte selecionada.</p>}
        <div className="cf-review-list">
          {items.map(item => {
            const url = safeUrl(item.official_url)
            return <article className="cf-review-item" key={item.id}>
              <h3>{item.title}</h3>
              <dl className="cf-discard-details">
                <div><dt>Ato</dt><dd>{item.act_number ?? 'Não informado'}</dd></div>
                <div><dt>Tipo</dt><dd>{item.canonical_type ?? item.raw_type ?? 'Não informado'}</dd></div>
                {item.raw_type && item.raw_type !== item.canonical_type && <div><dt>Tipo original</dt><dd>{item.raw_type}</dd></div>}
                <div><dt>Fonte / seção</dt><dd>{item.source_code} / {item.section || 'Não informada'}</dd></div>
                <div><dt>Coletor</dt><dd>{item.connector_key}</dd></div>
                <div><dt>Publicação</dt><dd>{date(item.published_on)}</dd></div>
                <div><dt>Motivo / regra</dt><dd>{REASONS[item.reason_code] ?? 'Decisão do filtro'} <code>{item.reason_code}</code></dd></div>
                <div><dt>Termo decisivo</dt><dd>{item.decisive_term ?? 'Nenhum termo decisivo'}</dd></div>
                <div><dt>Política</dt><dd>v{item.policy_version} · revisão {item.policy_revision}</dd></div>
                <div><dt>Descarte (Brasília)</dt><dd>{date(item.discarded_at, true)}</dd></div>
                <div><dt>Expiração (Brasília)</dt><dd>{date(item.expires_at, true)}</dd></div>
              </dl>
              {url ? <a href={url} target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a> : <span>Link oficial indisponível</span>}
            </article>
          })}
        </div>
      </>}
    <nav className="cf-pagination" aria-label="Páginas de desconsiderados">
      <button type="button" disabled={page === 0 || query.isFetching} onClick={() => setPage(current => Math.max(0, current - 1))}>Anterior</button>
      <span aria-live="polite">Página {page + 1}</span>
      <button type="button" disabled={query.isFetching || query.isError || (query.data?.items.length ?? 0) <= PAGE_SIZE} onClick={() => setPage(current => current + 1)}>Próxima</button>
    </nav>
  </section>
}

export function CollectionFilterDiscardAlerts({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const [status, setStatus] = useState<CollectionFilterDiscardAlert['status'] | 'ALL'>('OPEN')
  const query = useQuery({
    queryKey: ['collection-filter', 'discard-alerts', status],
    queryFn: () => fetchCollectionFilterDiscardAlerts(apiFetch, status === 'ALL' ? undefined : status),
    retry: false,
  })
  return <section className="cf-card cf-discard-panel" aria-labelledby="cf-alert-title">
    <div className="cf-card-title"><h2 id="cf-alert-title">Alertas de descarte</h2>
      <p>Saltos da taxa de descarte em relação às execuções anteriores. Exibição dos até 500 alertas mais recentes do status selecionado.</p>
    </div>
    <details className="cf-settings"><summary><CircleHelp size={16} aria-hidden="true" />Ajuda — Alertas de descarte</summary>
      <p>A taxa compara publicações descartadas e encontradas. A referência vem das execuções anteriores; o limiar é o valor usado para abrir o alerta. O status separa alertas abertos e reconhecidos. Esta tela permite consultar os alertas, sem alterar seu status.</p>
    </details>
    <div className="cf-review-filters">
      <label>Status do alerta<select value={status} onChange={event => setStatus(event.target.value as typeof status)}>
        <option value="OPEN">Abertos</option><option value="ACKNOWLEDGED">Reconhecidos</option><option value="ALL">Todos</option>
      </select></label>
      <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>Atualizar alertas</button>
    </div>
    {query.isPending ? <p role="status">Carregando alertas…</p>
      : query.isError ? <div className="cf-error" role="alert">Não foi possível carregar os alertas. Tente atualizar.</div>
      : <>
        {!query.data?.items.length && <p className="cf-empty">Nenhum alerta para o status selecionado.</p>}
        {query.data?.items.length === 500 && <p className="cf-warning">Limite de 500 alertas atingido; pode haver registros anteriores fora desta lista.</p>}
        <div className="cf-review-list">{query.data?.items.map(item => <article className="cf-review-item" key={item.id}>
          <h3>{item.source_code} · {item.status === 'OPEN' ? 'Aberto' : 'Reconhecido'}</h3>
          <dl className="cf-discard-details">
            <div><dt>Taxa de descarte</dt><dd>{percent(item.discard_rate)}</dd></div>
            <div><dt>Taxa de referência</dt><dd>{percent(item.baseline_rate)}</dd></div>
            <div><dt>Limiar do alerta</dt><dd>{percent(item.threshold_rate)}</dd></div>
            <div><dt>Encontradas / descartadas</dt><dd>{item.found_count} / {item.discard_count}</dd></div>
            <div><dt>Criado (Brasília)</dt><dd>{date(item.created_at, true)}</dd></div>
            <div><dt>Reconhecido (Brasília)</dt><dd>{date(item.acknowledged_at, true)}</dd></div>
            <div><dt>Execução de coleta</dt><dd><code>{item.collection_run_id}</code></dd></div>
          </dl>
        </article>)}</div>
      </>}
  </section>
}
