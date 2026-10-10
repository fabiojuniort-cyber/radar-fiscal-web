import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { ProductApiFetch } from './product-api'
import { fetchAdminMe } from './taxonomy-api'
import {
  fetchCollectionFilterNewTypes,
  fetchCollectionFilterState,
  type CollectionFilterMode,
  type CollectionFilterDirectRuleInput,
} from './collection-filter-api'
import { CollectionFilterDirectDialog } from './collection-filter-direct-dialog'
import { CollectionFilterDiscards, CollectionFilterDiscardAlerts } from './collection-filter-discards'
import './collection-filter-admin.css'

type Tab = 'types' | 'terms' | 'new-types' | 'discarded' | 'discard-alerts'
const MODES: Record<CollectionFilterMode,string> = {
  KEEP_ALWAYS: 'Manter sempre',
  KEEP_IF_TAX_TERM: 'Manter se tiver termo tributário',
  EXCLUDE_UNLESS_STRONG: 'Excluir, salvo termo forte',
  EXCLUDE_ALWAYS: 'Excluir sempre',
}

export function CollectionFilterAdminPage({ apiFetch, sessionKey = 'standalone' }: {
  apiFetch: ProductApiFetch
  sessionKey?: string
}) {
  const parent = useQueryClient()
  const client = useMemo(() => new QueryClient({
    defaultOptions: parent.getDefaultOptions(),
  }), [parent, sessionKey])
  useEffect(() => () => client.clear(), [client])
  return <QueryClientProvider client={client}>
    <CollectionFilterAdminContent key={sessionKey} apiFetch={apiFetch} />
  </QueryClientProvider>
}

function CollectionFilterAdminContent({apiFetch}:{apiFetch:ProductApiFetch}) {
  const queryClient=useQueryClient()
  const [tab,setTab]=useState<Tab>('types')
  const [rule,setRule]=useState<CollectionFilterDirectRuleInput|null>(null)
  const me=useQuery({queryKey:['admin','me'],queryFn:()=>fetchAdminMe(apiFetch),retry:false})
  const state=useQuery({
    queryKey:['collection-filter','state'],
    queryFn:()=>fetchCollectionFilterState(apiFetch),
    enabled:me.data?.platformAdmin===true,
    retry:false,
  })
  const newTypes=useQuery({
    queryKey:['collection-filter','new-types'],
    queryFn:()=>fetchCollectionFilterNewTypes(apiFetch,'OPEN'),
    enabled:me.data?.platformAdmin===true,
    retry:false,
  })
  const active=state.data?.policies.find(policy=>policy.status==='APPROVED')
  const document=active && state.data?.documents[active.id]
  if(me.isPending) return <main className="cf-loading">Verificando acesso administrativo…</main>
  if(me.isError||!me.data?.platformAdmin) return <main className="cf-denied">
    <h1>Acesso restrito</h1><p>Somente PLATFORM_ADMIN pode alterar regras de coleta.</p>
    <Link to="/painel">Voltar ao painel</Link>
  </main>
  return <div className="cf-app"><main className="cf-main">
    <header className="cf-header"><div>
      <h1>Filtro de coleta</h1>
      <p>Regras ativas imediatamente para o DOU. Classificações que descartem publicações exigem confirmação de exclusão.</p>
      <p>Política ativa: versão {active?.version ?? '—'} · revisão {active?.revision ?? '—'}</p>
    </div><Link to="/painel">Voltar ao painel</Link></header>
    <nav className="cf-tabs" aria-label="Seções do filtro">
      {([
        ['types','Tipos'],
        ['terms','Termos'],
        ['new-types','Novos tipos (' + (newTypes.data?.items.length ?? 0) + ')'],
        ['discarded','Desconsiderados'],
        ['discard-alerts','Alertas de descarte'],
      ] as Array<[Tab,string]>).map(([value,label])=>
        <button key={value} type="button" className={tab===value?'is-active':''}
          onClick={()=>setTab(value)}>{label}</button>)}
    </nav>
    {state.isPending && <p role="status">Carregando regras…</p>}
    {state.isError && <p role="alert" className="cf-error">Não foi possível carregar as regras.</p>}
    {tab==='types' && <section className="cf-card">
      <div className="cf-card-title"><h2>Tipos de ato</h2>
        <p>O modo selecionado é aplicado às próximas coletas após a confirmação administrativa.</p>
      </div>
      <button type="button" onClick={()=>setRule({
        sourceCode:'dou',section:'DO1',canonicalType:'',mode:'KEEP_ALWAYS',
      })}>Adicionar tipo DOU</button>
      <div className="cf-review-list">
        {(document?.rules ?? []).filter(r=>r.sourceCode==='dou').map(r=>
          <div key={r.sourceCode+'|'+r.section+'|'+r.canonicalType} className="cf-review-item">
            <strong>{r.sourceCode.toUpperCase()} · {r.section} · {r.canonicalType}</strong>
            <label>Modo
              <select aria-label={'Modo '+r.canonicalType} value={r.mode}
                onChange={event=>setRule({sourceCode:r.sourceCode,section:r.section,
                  canonicalType:r.canonicalType,mode:event.target.value as CollectionFilterMode})}>
                {Object.entries(MODES).map(([value,label])=>
                  <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>)}
      </div>
    </section>}
    {tab==='terms' && <section className="cf-card">
      <div className="cf-card-title"><h2>Termos tributários</h2>
        <p>As regras existentes de termo forte, fraco e negativo continuam sendo usadas pelo motor produtivo.</p>
      </div>
      {(document?.terms ?? []).map((term,index)=>
        <p key={index}>{term.text} · {term.strength} {term.sourceCode ? '· '+term.sourceCode : ''}</p>)}
      {!document?.terms.length && <p>Nenhum termo cadastrado na política vigente.</p>}
    </section>}
    {tab==='new-types' && <section className="cf-card">
      <div className="cf-card-title"><h2>Novos tipos</h2>
        <p>Classificar aplica a regra ao DOU e apresenta a quantidade de exclusões antes de confirmar.</p>
      </div>
      {newTypes.isPending && <p>Carregando…</p>}
      {newTypes.isError && <p role="alert" className="cf-error">Falha ao carregar novos tipos.</p>}
      {(newTypes.data?.items ?? []).map(item=>
        <article key={item.id} className="cf-new-type">
          <div><strong>{item.sample_raw_type}</strong>
            <p>{item.source_code} · {item.section} · {Number(item.occurrence_count)} ocorrência(s)</p>
          </div>
          {item.source_code==='dou'
            ? <button type="button" onClick={()=>setRule({
              sourceCode:'dou',section:item.section,canonicalType:item.normalized_type,
              mode:'KEEP_ALWAYS',newTypeId:item.id,
            })}>Classificar</button>
            : <small>Classificação automática restrita ao DOU.</small>}
        </article>)}
      {newTypes.data?.items.length===0 && <p>Nenhum tipo novo pendente.</p>}
    </section>}
    {tab==='discarded' && <CollectionFilterDiscards apiFetch={apiFetch}/>}
    {tab==='discard-alerts' && <CollectionFilterDiscardAlerts apiFetch={apiFetch}/>}
    {rule && <CollectionFilterDirectDialog
      apiFetch={apiFetch} initial={rule}
      onClose={()=>setRule(null)}
      onApplied={async()=>{
        await Promise.all([
          queryClient.invalidateQueries({queryKey:['collection-filter','state']}),
          queryClient.invalidateQueries({queryKey:['collection-filter','new-types']}),
        ])
      }}
    />}
  </main></div>
}
