import * as Dialog from '@radix-ui/react-dialog'
import {useCallback,useEffect,useMemo,useState} from 'react'
import {X,Check,Building2,Sparkles,Search} from 'lucide-react'
import {fetchAccountSummary,updateCompany,type ProductApiFetch,type Establishment} from './product-api'
import {searchNcmCatalog} from './product-ncm-api'
import {assistantRequest,assistantSteps,segmentSteps,segmentChoice,segmentComplete,initialStep,type AssistantData,type SegmentStep,type CardChoice} from './onboarding-assistant-api'
import {OnboardingIeEditor} from './onboarding-ie-editor'
import {BuildVersionNotice,NEW_VERSION_MESSAGE} from './build-version'
import './onboarding-assistant.css'
type Choice={conceptCodes:string[];ncmCodes:string[]}
type Row={key:string;label:string;product?:string;ncms:string[]}
export function OnboardingAssistant({apiFetch,tenantId,companyId,units,onClose,onSaved,initialEstablishmentId,versionChanged=false,animate=false}:{
 apiFetch:ProductApiFetch;tenantId:string;companyId:string;units:Establishment[];onClose:()=>void;onSaved:()=>void;initialEstablishmentId?:string;versionChanged?:boolean;animate?:boolean
}){
 const [data,setData]=useState<AssistantData|null>(null),[index,setIndex]=useState(0)
 const [reviewed,setReviewed]=useState<string[]>([])
 const [drafts,setDrafts]=useState<Record<string,Choice>>({}),[unitId,setUnitId]=useState('')
 const [query,setQuery]=useState(''),[ncmResults,setNcmResults]=useState<{code:string;description:string}[]>([]),[more,setMore]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[importing,setImporting]=useState(animate)
 const [phrases,setPhrases]=useState<{segment:string;phrases:string[]}[]>([]),[phrase,setPhrase]=useState('Preparando seu perfil…')
 const [ieEdits,setIeEdits]=useState<Record<string,boolean>>({})
 const onIeDirty=useCallback((id:string,dirty:boolean)=>setIeEdits(p=>p[id]===dirty?p:{...p,[id]:dirty}),[])
 const pendingIe=Object.values(ieEdits).some(Boolean)
 const [editingCompany,setEditingCompany]=useState(false),[name,setName]=useState(''),[location,setLocation]=useState('')
 const path='/api/v1/companies/'+companyId+'/onboarding'
 const head=units.find(u=>u.isHeadOffice)??units[0]
 const chooseStep=(result:AssistantData)=>initialEstablishmentId?Math.max(0,assistantSteps(result).findIndex(s=>'activities'in s&&s.activities.some(a=>a.establishmentId===initialEstablishmentId))):initialStep(result)
 const load=async()=>{const result=await assistantRequest<AssistantData>(apiFetch,tenantId,path);setData(result);setIndex(chooseStep(result));setError('')}
 useEffect(()=>{let active=true;assistantRequest<AssistantData>(apiFetch,tenantId,path).then(result=>{if(active){setData(result);setIndex(chooseStep(result))}}).catch(()=>{if(active)setError('Não foi possível carregar o assistente.')});assistantRequest<{items:{segment:string;phrases:string[]}[]}>(apiFetch,tenantId,'/api/v1/onboarding/phrases').then(r=>{if(active)setPhrases(r.items)}).catch(()=>{});return()=>{active=false}},[apiFetch,tenantId,path,initialEstablishmentId])
 useEffect(()=>{if(!importing)return;const timer=setTimeout(()=>setImporting(false),6000);return()=>clearTimeout(timer)},[importing])
 const groups=data?segmentSteps(data):[]
 useEffect(()=>{if(!importing)return;const tags=data?.cards[0]?.phraseSegments??[data?.cards[0]?.phraseSegment??'generico'];const matched=phrases.filter(p=>tags.includes(p.segment)).flatMap(p=>p.phrases);const pool=matched.length?matched:phrases.find(p=>p.segment==='generico')?.phrases??['Preparando seu perfil…'];const pick=()=>setPhrase(pool[Math.floor(Math.random()*pool.length)]??'Preparando seu perfil…');pick();const timer=setInterval(pick,2500);return()=>clearInterval(timer)},[importing,phrases,data])
 const steps=data?assistantSteps(data):[],step=steps[index],segment=step&&'activities'in step?step:undefined
 const activityList=segment?[...new Map(segment.activities.map(a=>[a.cnaeCode,a])).values()]:[]
 const activityCount=data?new Set(data.cards.map(a=>a.cnaeCode)).size:0
 const members=segment?[...new Set(segment.activities.map(a=>a.establishmentId))]:[]
 useEffect(()=>{if(!data||!segment)return;const next:Record<string,Choice>={};for(const id of [...new Set(segment.activities.map(a=>a.establishmentId))]){const c=segmentChoice(data,segment,id);next[id]={conceptCodes:c?.conceptCodes??[],ncmCodes:c?.ncmCodes??[]}}setDrafts(next);const first=initialEstablishmentId&&next[initialEstablishmentId]?initialEstablishmentId:Object.keys(next).find(id=>!segmentComplete(data,segment,id))??Object.keys(next)[0]??'';setUnitId(first);setReviewed([...new Set([first,...Object.keys(next).filter(id=>segmentComplete(data,segment,id))])]);setQuery('');setMore(false)},[data,index])
 const current=drafts[unitId]??{conceptCodes:[],ncmCodes:[]}
 const rows=useMemo(()=>{
  if(!data||!segment)return []
  const result=new Map<string,Row>(),associated=new Set<string>()
  for(const activity of segment.activities.filter(a=>a.establishmentId===unitId)){
   const ncms=activity.suggestions.filter(s=>s.kind==='NCM').map(s=>s.target)
   const products=activity.suggestions.filter(s=>s.kind==='PRODUCT')
   for(const p of products){const row=result.get(p.target)??{key:p.target,product:p.target,label:data.concepts.find(c=>c.code===p.target)?.label??p.target,ncms:[]};row.ncms=[...new Set([...row.ncms,...ncms])];result.set(p.target,row);ncms.forEach(n=>associated.add(n))}
   if(!products.length)for(const n of ncms)result.set('ncm:'+n,{key:'ncm:'+n,label:'NCM '+n,ncms:[n]})
  }
  return [...result.values()].sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))
 },[data,segment,unitId])
 useEffect(()=>{let active=true;if(query.trim().length<2){setNcmResults([]);return}const timer=setTimeout(()=>{void searchNcmCatalog(apiFetch,query,8).then(r=>{if(active)setNcmResults(r.items.map(n=>({code:n.code,description:n.description}))) }).catch(()=>{if(active)setNcmResults([])})},250);return()=>{active=false;clearTimeout(timer)}},[query,apiFetch])
 const searchedProducts=query.trim().length>=2?(data?.concepts??[]).filter(c=>c.dimensionCode==='product'&&c.label.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).slice(0,8):[]
 const setCurrent=(fn:(p:Choice)=>Choice)=>setDrafts(prior=>({...prior,[unitId]:fn(prior[unitId]??{conceptCodes:[],ncmCodes:[]})}))
 const rowChecked=(r:Row)=>r.product?current.conceptCodes.includes(r.product):r.ncms.every(n=>current.ncmCodes.includes(n))
 const toggleRow=(r:Row)=>setCurrent(prior=>{
  const selected=r.product?prior.conceptCodes.includes(r.product):r.ncms.every(n=>prior.ncmCodes.includes(n))
  const codes=r.product?(selected?prior.conceptCodes.filter(c=>c!==r.product):[...new Set([...prior.conceptCodes,r.product])]):prior.conceptCodes
  const used=new Set(rows.filter(row=>row.product&&codes.includes(row.product)).flatMap(row=>row.ncms))
  const ncms=selected?prior.ncmCodes.filter(n=>!r.ncms.includes(n)||used.has(n)):[...new Set([...prior.ncmCodes,...r.ncms])]
  return {conceptCodes:codes,ncmCodes:ncms}
 })
 const friendly=(e:unknown)=>e instanceof Error&&['profile_version_conflict','app_version_changed'].includes(e.message)?NEW_VERSION_MESSAGE:e instanceof Error&&e.message==='taxonomy_release_changed'?'As sugestões mudaram. Recarregue e confira suas escolhas.':e instanceof Error&&e.message==='onboarding_cards_pending'?'Ainda há etapas pendentes. Revise os segmentos antes de concluir.':'Não foi possível salvar. Sua edição foi mantida.'
 const save=async(skip:boolean)=>{if(!data||!step)return;setBusy(true);setError('');try{
  const selections=segment?members.map(id=>({establishmentId:id,conceptCodes:skip?[]:drafts[id]?.conceptCodes??[],ncmCodes:skip?[]:drafts[id]?.ncmCodes??[]})):undefined
  const result=await assistantRequest<Pick<AssistantData,'state'|'version'|'release'>>(apiFetch,tenantId,path,{expectedVersion:data.version,releaseId:data.release.id,cardId:step.id,status:skip?'SKIPPED':'CONFIRMED',conceptCodes:[],ncmCodes:[],...(selections?{units:selections}:{})})
  setData({...data,...result});onSaved();if(index<steps.length-1)setIndex(index+1);else onClose()
 }catch(e){setError(friendly(e))}finally{setBusy(false)}}
 const correctCompany=async()=>{setBusy(true);setError('');try{await updateCompany(apiFetch,tenantId,companyId,{legalName:name,businessLocationCode:location.trim()||null});const account=await fetchAccountSummary(apiFetch,tenantId);const saved=account.companies.find(c=>c.id===companyId);if(!saved)throw new Error('readback_failed');setData(d=>d?{...d,companyName:saved.legalName}:d);setEditingCompany(false);onSaved()}catch(e){setError(friendly(e))}finally{setBusy(false)}}
 const count=current.conceptCodes.length+current.ncmCodes.length
 const blocked=busy||versionChanged||pendingIe||editingCompany
 const needsReview=!!segment&&members.some(id=>!reviewed.includes(id))
 const address=head?[head.street,head.streetNumber,head.district,head.municipalityName,head.uf].filter(Boolean).join(', '):'Aguardando cadastro'
 const ieStatus=head?.stateRegistrationSource==='MANUAL'?'Informada manualmente':head?.stateRegistrationLookupStatus==='SUCCESS'?'Consulta estadual confirmada':head?.stateRegistrationLookupStatus==='NOT_FOUND'?'Não localizada':'Consulta estadual indisponível'
 return <Dialog.Root open onOpenChange={open=>{if(!open&&!busy)onClose()}}><Dialog.Portal><Dialog.Overlay className="onb-overlay"/><Dialog.Content className="onb-dialog" aria-describedby="onb-description">
  <Dialog.Title className="onb-sr">Assistente do perfil tributário</Dialog.Title><p id="onb-description" className="onb-sr">Confira os dados e escolha os itens por estabelecimento. Você pode fechar e retomar depois.</p>
  <button type="button" className="onb-close" aria-label="Fechar assistente" disabled={busy} onClick={onClose}><X size={22}/></button>
  <header className="onb-top"><span>{importing?'MONTANDO SEU PERFIL · '+(groups[0]?.title??'SUA EMPRESA'):'PASSO '+(index+1)+' DE '+steps.length+' · '+(step?.title??'CARREGANDO').toLocaleUpperCase('pt-BR')}</span><div className="onb-progress"><i style={{width:importing?'75%':((index+1)/Math.max(1,steps.length)*100)+'%'}}/></div></header>
  <div className="onb-body"><BuildVersionNotice visible={versionChanged}/>{error&&!versionChanged&&<div role="alert" className="onb-error">{error}{!data&&<button onClick={()=>void load()}>Tentar novamente</button>}</div>}
  {importing?<section className="onb-import" role="status"><Sparkles size={42}/><h2>{phrase}</h2><p>Encontramos {activityCount} atividades em {groups.length} segmentos.</p><div className="onb-loading-track"><i/></div></section>:!data||!step?<p role="status">Carregando seu perfil…</p>:<>
   {step.id==='company'&&<><h2>Estes são os dados da sua empresa?</h2><div className="onb-company-grid">
    <div><span>Razão social</span><strong>{data.companyName}</strong></div><div><span>CNPJ</span><strong>{data.companyCnpj??head?.cnpj??'Não informado'}</strong></div>
    <div><span>Endereço</span><strong>{address}</strong></div><div><span>Inscrição Estadual</span><strong>{head?.stateRegistration??'Não informada'}</strong><small>{ieStatus}</small></div>
    <div><span>Atividades</span><strong>{activityCount} atividades cadastradas</strong></div><div><span>Estabelecimentos</span><strong>{units.length} unidades</strong></div>
   </div><button className="onb-link" onClick={()=>{setName(data.companyName);setLocation(head?.businessLocationCode??'');setEditingCompany(true)}}>Corrigir algum dado</button>
    {editingCompany&&<div className="onb-correction"><label>Razão social<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Local Negócio da matriz<input value={location} onChange={e=>setLocation(e.target.value)}/></label><p>CNPJ é a identidade cadastral. Endereço e atividades são apresentados conforme o cadastro; a IE pode ser corrigida na próxima etapa.</p><button disabled={busy||versionChanged||name.trim().length<2} onClick={()=>void correctCompany()}>Salvar correção</button><button onClick={()=>setEditingCompany(false)}>Cancelar correção</button></div>}
   </>}
   {step.id==='establishments'&&<><h2>Confira seus estabelecimentos</h2><p>Informe a IE manualmente quando a consulta estadual não estiver disponível.</p>{units.map(unit=><OnboardingIeEditor key={unit.id} apiFetch={apiFetch} tenantId={tenantId} companyId={companyId} unit={unit} locked={busy||versionChanged} onBusy={setBusy} onDirty={onIeDirty} onSaved={onSaved}/>)}{pendingIe&&<p className="onb-hint" role="status">Salve ou descarte a edição da IE antes de continuar.</p>}</>}
   {segment&&<fieldset className="onb-segment-fields" disabled={busy||versionChanged}><h2>{segment.title}: o que você compra, vende ou produz?</h2><p>Sugestões a partir das suas {activityList.length} atividades de {segment.title}.</p>
    {members.length>1&&<label className="onb-unit">Estabelecimento<select aria-label="Estabelecimento" value={unitId} onChange={e=>{setUnitId(e.target.value);setReviewed(ids=>[...new Set([...ids,e.target.value])]);setQuery('');setMore(false)}}>{members.map(id=><option key={id} value={id}>{units.find(u=>u.id===id)?.name??'Unidade'}</option>)}</select><small>As escolhas ficam somente na unidade selecionada.</small></label>}
    {members.length===1&&<p className="onb-unit-name">{units.find(u=>u.id===unitId)?.name}</p>}
    <details className="onb-activities"><summary>Ver as {activityList.length} atividades deste segmento</summary><ul>{activityList.map(a=><li key={a.cnaeCode}>{a.cnaeCode} · {a.description}</li>)}</ul></details>
    <div className="onb-search-row"><label className="onb-search"><Search size={18}/><input aria-label="Buscar ou adicionar outro produto ou NCM…" placeholder="Buscar ou adicionar outro produto ou NCM…" value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" className="onb-secondary" onClick={()=>setCurrent(p=>({conceptCodes:[...new Set([...p.conceptCodes,...rows.flatMap(r=>r.product?[r.product]:[])])],ncmCodes:[...new Set([...p.ncmCodes,...rows.flatMap(r=>r.ncms)])]}))}>Marcar todos</button></div>
    {query.trim().length>=2&&<div className="onb-autocomplete" aria-label="Resultados da busca">{searchedProducts.map(p=><button key={p.code} onClick={()=>{setCurrent(c=>({...c,conceptCodes:[...new Set([...c.conceptCodes,p.code])]}));setQuery('')}}>Adicionar {p.label}</button>)}{ncmResults.map(n=><button key={n.code} onClick={()=>{setCurrent(c=>({...c,ncmCodes:[...new Set([...c.ncmCodes,n.code])]}));setQuery('')}}>Adicionar NCM {n.code} · {n.description}</button>)}{!searchedProducts.length&&!ncmResults.length&&<p>Nenhum resultado encontrado.</p>}</div>}
    {!rows.length&&<p className="onb-hint">Não há sugestões publicadas para esta unidade. Busque um item ou pule esta etapa.</p>}
    <div className="onb-suggestions" aria-label="Produtos sugeridos">{(more?rows:rows.slice(0,8)).map(row=><label key={row.key} className={'onb-suggestion '+(rowChecked(row)?'is-selected':'')}><input type="checkbox" checked={rowChecked(row)} onChange={()=>toggleRow(row)}/><span>{row.label}</span><small>{row.ncms.length?'NCM '+row.ncms.slice(0,3).join(', ')+(row.ncms.length>3?' +'+(row.ncms.length-3):''):'Sem NCM vinculada'}</small></label>)}</div>
    {rows.length>8&&!more&&<button className="onb-link" onClick={()=>setMore(true)}>+ {rows.length-8} sugestões · mostrar mais</button>}
    {needsReview&&<p className="onb-hint">Confira cada estabelecimento deste segmento antes de salvar.</p>}<div className="onb-chips" aria-label="Itens selecionados">{current.conceptCodes.map(code=><button key={code} aria-label={'Remover '+(data.concepts.find(c=>c.code===code)?.label??code)} onClick={()=>setCurrent(c=>({...c,conceptCodes:c.conceptCodes.filter(v=>v!==code)}))}>{data.concepts.find(c=>c.code===code)?.label??code} ×</button>)}{current.ncmCodes.map(code=><button key={code} aria-label={'Remover NCM '+code} onClick={()=>setCurrent(c=>({...c,ncmCodes:c.ncmCodes.filter(v=>v!==code)}))}>NCM {code} ×</button>)}</div>
   </fieldset>}
   {step.id==='summary'&&<><div className="onb-done"><Check size={26}/></div><h2>Tudo pronto! Confira seu perfil</h2><p>As escolhas abaixo pertencem a cada estabelecimento indicado.</p><div className="onb-summary">{groups.map(group=>{
    const ids=[...new Set(group.activities.map(a=>a.establishmentId))];const skipped=ids.some(id=>segmentChoice(data,group,id)?.status==='SKIPPED');const pending=ids.some(id=>!segmentComplete(data,group,id));
    return <section key={group.id} className={skipped||pending?'is-skipped':''}><div><h3>{group.title}</h3>{ids.map(id=>{const choice=segmentChoice(data,group,id);return <p key={id}><strong>{units.find(u=>u.id===id)?.name??'Unidade'}:</strong> {choice?.status==='SKIPPED'?'Segmento pulado':!choice?'Pendente':([...choice.conceptCodes.map(code=>data.concepts.find(c=>c.code===code)?.label??code),...choice.ncmCodes.map(n=>'NCM '+n)].join(', ')||'Nenhum item selecionado')}</p>})}</div><button className="onb-link" onClick={()=>setIndex(steps.findIndex(s=>s.id===group.id))}>{skipped||pending?'Revisar':'Editar'}</button></section>
   })}</div></>}
  </>}</div>
  {!importing&&data&&step&&<footer className="onb-footer"><button type="button" className="onb-secondary" disabled={blocked||index===0} onClick={()=>{setError('');setIndex(i=>i-1)}}>Voltar</button><div>{segment&&<span>{count} selecionados</span>}{step.id!=='summary'&&<button type="button" className="onb-link" disabled={blocked} onClick={()=>void save(true)}>Pular</button>}<button type="button" className={'onb-primary '+(step.id==='summary'?'is-finish':'')} disabled={blocked||needsReview} onClick={()=>void save(false)}>{busy?'Salvando…':step.id==='summary'?'Concluir perfil':step.id==='company'?'Está correto, continuar':'Salvar e continuar'}</button></div></footer>}
 </Dialog.Content></Dialog.Portal></Dialog.Root>
}
