import { useEffect, useMemo, useState } from 'react'
import { anatomyConfigEnabled } from './anatomy-config-flag'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { ProductApiFetch } from './product-api'
import { fetchCatalogFacets } from './catalog-api'
import { fetchAdminMe } from './taxonomy-api'
import {
  editCollectionFilterActive,
  fetchCollectionFilterNewTypes,fetchCollectionFilterState,
  type CollectionFilterRule,type CollectionFilterAlias,type CollectionFilterTerm,
  type CollectionFilterDirectRuleInput,
} from './collection-filter-api'
import {
  TypesEditor,TermsEditor,NewTypeActions,type FilterOrigins,
} from './collection-filter-direct-editors'
import { normalizeFilterText } from './collection-filter-csv'
import { CollectionFilterDirectDialog } from './collection-filter-direct-dialog'
import { CollectionFilterScopePurgeDialog } from './collection-filter-scope-purge-dialog'
import { CollectionFilterDiscards,CollectionFilterDiscardAlerts } from './collection-filter-discards'
import './collection-filter-admin.css'

type Tab='types'|'terms'|'new-types'|'discarded'|'discard-alerts'
const normalTerm=(term:CollectionFilterTerm)=>({
  ...term,normalizedTerm:term.normalizedTerm??normalizeFilterText(term.text),
})

export function CollectionFilterAdminPage({apiFetch,sessionKey='standalone'}:{
  apiFetch:ProductApiFetch;sessionKey?:string
}) {
  const parent=useQueryClient()
  const client=useMemo(()=>new QueryClient({
    defaultOptions:parent.getDefaultOptions(),
  }),[parent,sessionKey])
  useEffect(()=>()=>client.clear(),[client])
  return <QueryClientProvider client={client}>
    <CollectionFilterAdminContent apiFetch={apiFetch} key={sessionKey}/>
  </QueryClientProvider>
}
function CollectionFilterAdminContent({apiFetch}:{apiFetch:ProductApiFetch}) {
  const qc=useQueryClient()
  const [tab,setTab]=useState<Tab>('types')
  const [directRule,setDirectRule]=useState<CollectionFilterDirectRuleInput|null>(null)
  const [scopePurgeOpen,setScopePurgeOpen]=useState(false)
  const [dismissedNewTypes,setDismissedNewTypes]=useState<Set<string>>(()=>new Set())
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const me=useQuery({queryKey:['admin','me'],queryFn:()=>fetchAdminMe(apiFetch),retry:false})
  const state=useQuery({
    queryKey:['collection-filter','state'],
    queryFn:()=>fetchCollectionFilterState(apiFetch),
    refetchInterval:60000,
    enabled:me.data?.platformAdmin===true,retry:false,
  })
  const newTypes=useQuery({
    queryKey:['collection-filter','new-types'],
    queryFn:()=>fetchCollectionFilterNewTypes(apiFetch,'OPEN'),
    refetchInterval:q=>q.state.data?.inventory?.status==='WARMING'||q.state.data?.inventory?.status==='REFRESHING'?3000:30000,
    // Fetch the archive-backed queue only when the administrator opens its tab.
    enabled:me.data?.platformAdmin===true&&tab==='new-types',retry:false,
  })
  const facets=useQuery({
    queryKey:['collection-filter','origin-facets'],
    queryFn:()=>fetchCatalogFacets(apiFetch),
    refetchInterval:60000,
    enabled:me.data?.platformAdmin===true,retry:false,
  })
  const approved=state.data?.policies.find(p=>p.status==='APPROVED')
  const document=approved&&state.data?.documents[approved.id]
  const rules=document?.rules??[]
  const aliases=document?.aliases??[]
  const terms=document?.terms??[]
  const origins:FilterOrigins=useMemo(()=>{
    const allRules=[...rules,...(newTypes.data?.items??[]).map(n=>({
      sourceCode:n.source_code,section:n.section,canonicalType:n.normalized_type,actName:n.act_name||n.sample_raw_type,
      mode:'KEEP_ALWAYS' as const,helpText:null,
    }))]
    const sources=new Map((facets.data?.sources??[]).map(s=>[s.code,s]))
    allRules.forEach(r=>{
      if(!sources.has(r.sourceCode))sources.set(r.sourceCode,{
        code:r.sourceCode,name:r.sourceCode,
      })
    })
    terms.forEach(t=>{
      if(t.sourceCode&&!sources.has(t.sourceCode))sources.set(t.sourceCode,{
        code:t.sourceCode,name:t.sourceCode,
      })
    })
    if(!sources.has('dou'))sources.set('dou',{code:'dou',name:'DOU'})
    return {actNames:state.data?.actNames,sources:[...sources.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),
      rules:allRules,allTypes:(facets.data?.actTypes??[]).map(normalizeFilterText)}
  },[rules,terms,newTypes.data,facets.data,state.data?.actNames])

  // Keep successfully classified items hidden even while the server inventory
  // is refreshing from its previous cached policy revision.
  const visibleNewTypes=(newTypes.data?.items??[]).filter(item=>!dismissedNewTypes.has(item.id))

  const refresh=async()=>{
    await Promise.all([
      qc.invalidateQueries({queryKey:['collection-filter','state']}),
      qc.invalidateQueries({queryKey:['collection-filter','new-types']}),
    ])
  }
  const edit=async(
    action:Parameters<typeof editCollectionFilterActive>[1],
    payload:Record<string,unknown>,
  )=>{
    setError('');setBusy(true)
    try{await editCollectionFilterActive(apiFetch,action,payload);await refresh()}
    catch(cause){
      setError(cause instanceof Error?cause.message:'Não foi possível atualizar a política.')
      throw cause
    }finally{setBusy(false)}
  }
  const onKeep=async(rule:CollectionFilterRule)=>{
    await edit('RULE_KEEP',{
      sourceCode:rule.sourceCode,section:rule.section,canonicalType:rule.canonicalType,
      mode:'KEEP_ALWAYS',
    })
  }
  const onRemoveRule=async(rule:CollectionFilterRule)=>{
    await edit('RULE_DELETE',{
      sourceCode:rule.sourceCode,section:rule.section,canonicalType:rule.canonicalType,
    })
  }
  const onAlias=async(action:'ALIAS_PUT'|'ALIAS_DELETE',alias:CollectionFilterAlias)=>{
    await edit(action,{...alias})
  }
  const onTerm=async(term:CollectionFilterTerm,old?:CollectionFilterTerm)=>{
    await edit('TERM_PUT',{term:normalTerm(term),
      ...(old?{oldTerm:normalTerm(old)}:{})})
  }
  const onRemoveTerm=async(term:CollectionFilterTerm)=>{
    await edit('TERM_DELETE',{oldTerm:normalTerm(term)})
  }

  if(me.isPending)return <main className="cf-loading">Verificando acesso administrativo…</main>
  if(me.isError||!me.data?.platformAdmin)return <div className="cf-app">
    <main className="cf-denied"><ShieldCheck size={30}/>
      <h1>Acesso restrito</h1>
      <p>O Filtro de Coleta é exclusivo de administradores globais.</p>
      <Link to="/painel">Voltar ao painel</Link>
    </main>
  </div>
  if(state.isPending||state.isError||!approved||!document)return <div className="cf-app">
    <main className="cf-denied"><h1>Filtro de Coleta</h1>
      {state.isError||!document&&!state.isPending
        ?<><p role="alert">Não foi possível carregar a política ativa. Tente novamente antes de editar.</p>
          <button type="button" onClick={()=>void state.refetch()}>Tentar novamente</button></>
        :<p role="status">Carregando a política…</p>}
      <Link to="/painel">Voltar ao painel</Link>
    </main>
  </div>
  return <div className="cf-app">
    <header className="cf-header">
      <Link to="/painel" className="cf-back"><ArrowLeft size={16}/> Painel</Link>
      <div className="cf-heading"><span>Administração da plataforma</span>
        <h1>Filtro de Coleta</h1>
        <p>Configure o que o Trifaros mantém antes de persistir novas publicações.
          Nome do ato desconhecido sempre fica e vai para Novos tipos.</p>
      </div>
      <nav aria-label="Áreas administrativas">
        <Link to="/admin/taxonomia">Taxonomia</Link>
        <Link to="/admin/administradores">Administradores</Link>
        {anatomyConfigEnabled() && <Link to="/admin/anatomia">Anatomia dos atos</Link>}
        <button type="button" onClick={()=>setScopePurgeOpen(true)}>Reaplicar filtro ao acervo</button>
      </nav>
    </header>
    <main className="cf-main">
      <section className="cf-status-grid">
        <article><span>Política publicada</span>
          <strong>v{document.version} · revisão {document.revision}</strong></article>
        <article><span>Novos tipos</span>
          <strong>{state.data?.inventory?.status==='WARMING'?'Atualizando…':(newTypes.data?visibleNewTypes.length:state.data?.newTypesOpen??0)}</strong></article>
        <article><span>Regra de segurança</span>
          <strong>Desconhecido = manter</strong></article>
      </section>
      {error&&<p role="alert" className="cf-error">{error}</p>}
      <nav className="cf-tabs" aria-label="Configuração do filtro">
        {([
          ['types','Tipos'],
          ['terms','Termos'],
          ['new-types',`Novos tipos (${newTypes.data?visibleNewTypes.length:state.data?.newTypesOpen??0})`],
          ['discarded','Desconsiderados'],
          ['discard-alerts','Alertas de descarte'],
        ] as Array<[Tab,string]>).map(([value,label])=>
          <button type="button" key={value} className={tab===value?'is-active':''}
            onClick={()=>setTab(value)}>{label}</button>
        )}
      </nav>
      {tab==='types'&&<TypesEditor
        apiFetch={apiFetch} origins={origins} rules={rules} terms={terms}
        aliases={aliases} busy={busy}
        onKeep={onKeep} onConfirm={setDirectRule}
        onRemoveRule={onRemoveRule} onAlias={onAlias} onTerm={onTerm}
        onRemoveTerm={onRemoveTerm}/>}
      {tab==='terms'&&<TermsEditor
        apiFetch={apiFetch} origins={origins} rules={rules} terms={terms}
        aliases={aliases} busy={busy}
        onKeep={onKeep} onConfirm={setDirectRule}
        onRemoveRule={onRemoveRule} onAlias={onAlias} onTerm={onTerm}
        onRemoveTerm={onRemoveTerm}/>}
      {tab==='new-types'&&<section className="cf-card">
        <div className="cf-card-title"><div><h2>Novos tipos</h2>
          <p>Nomes de ato ainda não configurados são mantidos automaticamente até sua classificação.</p>
        </div></div>
        {newTypes.data?.inventory?.status==='REFRESHING'&&<p role="status">Atualizando as contagens em segundo plano. Exibindo o último inventário concluído.</p>}
        {newTypes.isPending||newTypes.data?.inventory?.status==='WARMING'?<p role="status">Preparando os Nomes de ato em segundo plano…</p>:
          newTypes.data?.inventory?.status==='FAILED'?<p className="cf-error" role="alert">Não foi possível atualizar o inventário. Nova tentativa será feita automaticamente.</p>:
          newTypes.isError?<p className="cf-error">Não foi possível carregar novos tipos.</p>:
          visibleNewTypes.length?<div className="cf-list">
            {visibleNewTypes.map(item=><article key={item.id} className="cf-new-type">
              <div><strong>{item.act_name||item.sample_raw_type}</strong>
                <span>{item.source_code}{item.section?` · ${item.section}`:''} · {Number(item.occurrence_count)} ocorrência(s)</span>
                <small>Primeira: {item.first_seen_at?new Date(item.first_seen_at).toLocaleString('pt-BR'):'—'} · Última: {item.last_seen_at?new Date(item.last_seen_at).toLocaleString('pt-BR'):'—'}</small>
                {item.examples?.length?<ul className="cf-example-list">
                  {item.examples.slice(0,3).map(example=><li key={example.id}>
                    {example.officialUrl?<a href={example.officialUrl} target="_blank"
                      rel="noreferrer">{example.title}</a>:<span>{example.title}</span>}
                  </li>)}
                </ul>:null}
              </div>
              <div className="cf-new-type-resolution">
                <NewTypeActions item={item} apiFetch={apiFetch} origins={origins}
                  mergeRules={rules} pending={busy} error={error||null}
                  onClassify={canonicalType=>{
                    // Both DOU and DOE-SP use revision-bound F3 preview and save.
                    setDirectRule({
                      sourceCode:item.source_code,section:item.section,
                      canonicalType,mode:'KEEP_ALWAYS',
                      ...(item.queue_basis==='ARCHIVE_ACT_NAME'?{queueBasis:item.queue_basis,actName:item.act_name}:{newTypeId:item.id}),
                    })
                  }}
                  onMerge={canonicalType=>edit(item.queue_basis==='ARCHIVE_ACT_NAME'?'ALIAS_PUT':'NEWTYPE_MERGE',{
                    sourceCode:item.source_code,section:item.section,
                    canonicalType,...(item.queue_basis==='ARCHIVE_ACT_NAME'?{}:{newTypeId:item.id}),alias:item.normalized_type,
                  })}
                  onTerm={term=>onTerm(term)}/>
              </div>
            </article>)}
          </div>:<p className="cf-empty">Nenhum tipo novo pendente.</p>}
      </section>}
      {tab==='discarded'&&<CollectionFilterDiscards apiFetch={apiFetch}/>}
      {tab==='discard-alerts'&&<CollectionFilterDiscardAlerts apiFetch={apiFetch}/>}
      <footer className="cf-footer">
        <span>Alterações aplicadas diretamente à política publicada</span>
        <span>Referência atual: versão {document.version}</span>
      </footer>
      {scopePurgeOpen&&<CollectionFilterScopePurgeDialog
        apiFetch={apiFetch} onClose={()=>setScopePurgeOpen(false)} onApplied={refresh}/>}
      {directRule&&<CollectionFilterDirectDialog
        apiFetch={apiFetch} initial={directRule}
        onClose={()=>setDirectRule(null)} onApplied={saved=>{
          // A classification with the same source, section and Nome do ato
          // resolves this queue item. Never hide a different rule edited by hand.
          if((directRule.newTypeId||directRule.queueBasis)&&
            saved.sourceCode===directRule.sourceCode&&
            normalizeFilterText(saved.section)===normalizeFilterText(directRule.section)&&
            normalizeFilterText(saved.canonicalType)===
              normalizeFilterText(directRule.actName??directRule.canonicalType)){
            const savedName=normalizeFilterText(saved.canonicalType)
            const matchingIds=(newTypes.data?.items??[])
              .filter(item=>item.source_code===saved.sourceCode&&
                normalizeFilterText(item.section)===normalizeFilterText(saved.section)&&
                normalizeFilterText(item.act_name||item.sample_raw_type)===savedName)
              .map(item=>item.id)
            if(matchingIds.length)setDismissedNewTypes(previous=>
              new Set([...previous,...matchingIds]))
          }
          void refresh()
        }}/>}
    </main>
  </div>
}

