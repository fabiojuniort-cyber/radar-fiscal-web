import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownUp, CircleHelp, Download } from 'lucide-react'
import type { ProductApiFetch } from './product-api'
import {
  fetchCollectionFilterDiscards,
  fetchCollectionFilterDiscardAlerts,
  type CollectionFilterDiscardAlert,
  type CollectionFilterDiscard, type CollectionDiscardFilterKey,
  type CollectionDiscardFilters, type CollectionDiscardSortBy,
} from './collection-filter-api'
import {buildCollectionDiscardsWorkbook} from './collection-filter-xlsx'

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

/**
 * Migration 029's generated is_hidden predicate, repeated ONLY for display of
 * already-archived rows (whose publications no longer exist). This must never
 * affect purge eligibility, policy decisions or other archived rule labels.
 */
export function wasLegacyHidden029(row: Pick<CollectionFilterDiscard,
  'title' | 'raw_type' | 'discard_origin' | 'reason_code'>): boolean {
  if (row.discard_origin !== 'ARCHIVE' || row.reason_code !== 'ARCHIVE_PURGE') return false
  const type = (row.raw_type ?? '').toLocaleUpperCase('pt-BR')
  const title = (row.title ?? '').toLocaleUpperCase('pt-BR')
  return ['AVISO DE LICITAÇÃO', 'COMUNICADO DGFIN',
    'PORTARIA DO COORDENADOR GERAL', 'COMISSÃO DE ANÁLISE DE PROJETOS',
    'COMISSAO DE ANALISE DE PROJETOS'].some(needle =>
      type.includes(needle) || title.includes(needle))
}

export function discardRuleModeLabel(r: CollectionFilterDiscard): string {
  if (wasLegacyHidden029(r) && !r.rule_mode && !r.archive_policy_rule) {
    return 'Regra antiga (029)'
  }
  return [r.archive_policy_rule ?? r.canonical_type ?? '—',
    r.rule_mode ?? '—',
    'v' + r.policy_version + ' · rev.' + r.policy_revision].join(' / ')
}

function percent(value: number | string) {
  const number = Number(value)
  return Number.isFinite(number)
    ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(number)
    : 'Não informado'
}

const REPORT_COLUMNS: Array<{
  key:CollectionDiscardFilterKey; sort:CollectionDiscardSortBy; title:string;
  value:(row:CollectionFilterDiscard)=>string;
}> = [
  {key:'discardedOn',sort:'discardedAt',title:'Data do descarte',
    value:r=>date(r.discarded_at,true)},
  {key:'origin',sort:'origin',title:'Origem',
    value:r=>r.discard_origin==='ARCHIVE'?'Apagada do acervo':'Coleta'},
  {key:'sourceCode',sort:'source',title:'Fonte',value:r=>r.source_code},
  {key:'section',sort:'section',title:'Seção',value:r=>r.section||'—'},
  {key:'type',sort:'type',title:'Tipo',
    value:r=>r.canonical_type??r.raw_type??'—'},
  {key:'title',sort:'title',title:'Título',value:r=>r.title},
  {key:'actNumber',sort:'actNumber',title:'Nº do ato',
    value:r=>r.act_number??'—'},
  {key:'publishedOn',sort:'publishedOn',title:'Publicação',
    value:r=>date(r.published_on)},
  {key:'ruleMode',sort:'ruleMode',title:'Regra/Modo',
    value:r=>discardRuleModeLabel(r)},
  {key:'reasonCode',sort:'reasonCode',title:'Motivo',
    value:r=>REASONS[r.reason_code]??r.reason_code},
  {key:'decisiveTerm',sort:'decisiveTerm',title:'Termo decisivo',
    value:r=>r.decisive_term??'—'},
  {key:'officialUrl',sort:'officialUrl',title:'Link oficial',
    value:r=>r.official_url??'—'},
]

export function CollectionFilterDiscards({apiFetch}:{apiFetch:ProductApiFetch}) {
  const [draft,setDraft]=useState<CollectionDiscardFilters>({})
  const [filters,setFilters]=useState<CollectionDiscardFilters>({})
  const [sortBy,setSortBy]=useState<CollectionDiscardSortBy>('discardedAt')
  const [sortDir,setSortDir]=useState<'asc'|'desc'>('desc')
  const [page,setPage]=useState(0)
  const [exporting,setExporting]=useState(false)
  const [exportError,setExportError]=useState('')
  const query=useQuery({
    queryKey:['collection-filter','discarded','report',filters,sortBy,sortDir,page],
    queryFn:()=>fetchCollectionFilterDiscards(apiFetch,{
      ...filters,sortBy,sortDir,limit:PAGE_SIZE,offset:PAGE_SIZE*page,
    }),
    retry:false,
  })
  const total=query.data?.total??0
  const pages=Math.max(1,Math.ceil(total/PAGE_SIZE))
  function apply() {
    setFilters(Object.fromEntries(Object.entries(draft).filter(([,v])=>v?.trim())
      .map(([key,value])=>[key,key==='sourceCode'?value.trim().toLowerCase():value.trim()])) as CollectionDiscardFilters)
    setPage(0)
  }
  function reset(){
    setDraft({});setFilters({});setPage(0);setExportError('')
  }
  function sort(key:CollectionDiscardSortBy){
    if(sortBy===key)setSortDir(v=>v==='asc'?'desc':'asc')
    else{setSortBy(key);setSortDir('asc')}
    setPage(0)
  }
  async function exportAll(){
    if(exporting)return
    setExporting(true);setExportError('')
    try{
      const output:CollectionFilterDiscard[]=[]
      let offset=0,totalExpected:number|null=null
      const ids=new Set<string>()
      while(true){
        const chunk=await fetchCollectionFilterDiscards(apiFetch,{
          ...filters,sortBy,sortDir,offset,limit:500,
        })
        if(totalExpected===null)totalExpected=chunk.total
        if(chunk.total!==totalExpected)throw new Error('Os registros mudaram durante a exportação; consulte novamente.')
        for(const row of chunk.items){
          if(ids.has(row.id))throw new Error('Duplicidade detectada durante a exportação; tente novamente.')
          ids.add(row.id);output.push(row)
        }
        offset+=chunk.items.length
        if(offset>=totalExpected)break
        if(chunk.items.length===0)throw new Error('Exportação incompleta. Nenhum arquivo foi gerado.')
      }
      if(output.length!==(totalExpected??0))throw new Error('Exportação incompleta.')
      const blob=buildCollectionDiscardsWorkbook(
        REPORT_COLUMNS.map(c=>c.title),
        output.map(r=>REPORT_COLUMNS.map(c=>c.value(r))),
      )
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url;a.download='desconsiderados.xlsx'
      document.body.appendChild(a);a.click();a.remove()
      URL.revokeObjectURL(url)
    }catch(error){setExportError(error instanceof Error?error.message:'Não foi possível exportar.')}
    finally{setExporting(false)}
  }
  return <section className="cf-card cf-discard-panel" aria-labelledby="cf-discard-title">
    <div className="cf-card-title"><h2 id="cf-discard-title">Desconsiderados</h2>
      <p>Relatório de publicações descartadas na coleta ou apagadas do acervo, retido por 3 meses.</p>
    </div>
    <details className="cf-settings">
      <summary><CircleHelp size={16} aria-hidden="true"/>Ajuda — Desconsiderados</summary>
      <p>Uma linha por documento. Os filtros e a ordenação aplicam-se ao relatório inteiro, não apenas à página exibida. A exportação Excel inclui todas as linhas do filtro atual. O link é sempre a referência oficial preservada.</p>
    </details>
    <div className="cf-grid">
      <div className="cf-grid-toolbar">
        <span role="status">{total.toLocaleString('pt-BR')} registros · Página {page+1} de {pages}</span>
        <button type="button" onClick={apply}>Aplicar filtros</button>
        <button type="button" onClick={reset}>Limpar filtros</button>
        <button type="button" disabled={query.isFetching}
          onClick={()=>void query.refetch()}>Atualizar desconsiderados</button>
        <button type="button" disabled={exporting||query.isPending||query.isError}
          onClick={()=>void exportAll()}><Download size={15}/>{exporting?'Exportando…':'Exportar Excel'}</button>
      </div>
      {exportError&&<p className="cf-error" role="alert">{exportError}</p>}
      {query.isPending?<p role="status">Carregando desconsiderados…</p>
        :query.isError?<p className="cf-error" role="alert">Não foi possível consultar o relatório.</p>
        :<div className="cf-table-wrap cf-grid-scroll">
          <table aria-label="Relatório de Desconsiderados">
            <thead>
              <tr>{REPORT_COLUMNS.map(c=><th key={c.key}
                aria-sort={sortBy===c.sort?(sortDir==='asc'?'ascending':'descending'):'none'}>
                <div className="cf-column-head">
                  <button type="button" aria-label={'Ordenar '+c.title}
                    onClick={()=>sort(c.sort)}>{c.title}<ArrowDownUp size={13}/></button>
                </div>
              </th>)}</tr>
              <tr>{REPORT_COLUMNS.map(c=><th key={c.key}>
                {c.key==='origin'?
                  <select aria-label={'Filtrar '+c.title} value={draft.origin??''}
                    onChange={e=>setDraft(v=>({...v,origin:e.target.value}))}>
                    <option value="">Todas</option><option value="COLLECTION">Coleta</option>
                    <option value="ARCHIVE">Apagada do acervo</option>
                  </select>:
                  <input aria-label={'Filtrar '+c.title}
                    placeholder={c.key==='publishedOn'||c.key==='discardedOn'?'AAAA-MM-DD':'Filtrar…'}
                    value={draft[c.key]??''}
                    onChange={e=>setDraft(v=>({...v,[c.key]:e.target.value}))}/>}
              </th>)}</tr>
            </thead>
            <tbody>{query.data?.items.map(r=><tr key={r.id}>
              {REPORT_COLUMNS.map(c=><td key={c.key}>
                {c.key==='officialUrl'?
                  (safeUrl(r.official_url)?<a href={safeUrl(r.official_url)??'#'}
                    target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a>:'Link oficial indisponível')
                  :c.value(r)}
              </td>)}
            </tr>)}</tbody>
          </table>
          {!query.data?.items.length&&<p className="cf-empty">Nenhum documento atende aos filtros.</p>}
        </div>}
      <nav className="cf-grid-pagination" aria-label="Páginas do relatório">
        <button type="button" disabled={page===0||query.isFetching}
          onClick={()=>setPage(v=>Math.max(0,v-1))}>Anterior</button>
        <span>Página {page+1} de {pages}</span>
        <button type="button" disabled={page+1>=pages||query.isFetching}
          onClick={()=>setPage(v=>v+1)}>Próxima</button>
      </nav>
    </div>
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
