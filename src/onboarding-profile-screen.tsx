import {useEffect,useState} from 'react'
import {assistantRequest,segmentSteps,type AssistantData} from './onboarding-assistant-api'
import {profiles,unique} from './onboarding-selection'
import {conceptLabel,legacyLabels,regimeLabels} from './onboarding-profile-editor'
import {profileDimensions,profileDimensionGroups} from './onboarding-dimensions'
import type {Establishment,ProductApiFetch} from './product-api'

export const formatProfileCnpj=(value:string)=>value.replace(/\D/g,'').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')
function SelectedBlock({title,items,edit,onEdit,historical=false}:{title:string;items:string[];edit:string;onEdit:(card:string)=>void;historical?:boolean}){
 const [expanded,setExpanded]=useState(false)
 const values=unique(items)
 return <section className="onb-profile-block" aria-label={title}>
  <header><h3>{title} <span>· {values.length}</span></h3><button className="onb-link" aria-label={'Editar '+title} onClick={()=>onEdit(edit)}>Editar</button></header>
  <div className="onb-selected-box"><h4>SELECIONADOS</h4>{historical&&<p className="onb-hint">Há escolhas de versões anteriores. Use Editar para corrigir ou remover.</p>}
   {values.length?<><div className="onb-profile-chips">{(expanded?values:values.slice(0,12)).map(value=><span className="onb-profile-chip" key={value}>{value}</span>)}</div>{values.length>12&&<button className="onb-link" onClick={()=>setExpanded(v=>!v)}>{expanded?'ver menos':'ver todos ('+values.length+')'}</button>}</>:<p className="onb-empty-selection">Nada selecionado · <button className="onb-link" aria-label={'Adicionar '+title} onClick={()=>onEdit(edit)}>Adicionar</button></p>}
  </div>
 </section>
}
export function OnboardingProfileScreen({apiFetch,tenantId,companyId,unit,types=[],onEdit,onBack}:{apiFetch:ProductApiFetch;tenantId:string;companyId:string;unit:Establishment;types?:{code:string;name:string}[];onEdit:(card:string)=>void;onBack:()=>void}){
 const [data,setData]=useState<AssistantData|null>(null),[error,setError]=useState(false),[headerOffset,setHeaderOffset]=useState(0)
 useEffect(()=>{const header=document.querySelector('.tp-header');if(!header)return;const measure=()=>setHeaderOffset(['sticky','fixed'].includes(getComputedStyle(header).position)?Math.ceil(header.getBoundingClientRect().height):0);measure();window.addEventListener('resize',measure);const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(measure);observer?.observe(header);return()=>{observer?.disconnect();window.removeEventListener('resize',measure)}},[])
 useEffect(()=>{let active=true;assistantRequest<AssistantData>(apiFetch,tenantId,`/api/v1/companies/${companyId}/onboarding?establishmentId=${unit.id}`).then(r=>{if(active)setData(r)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[apiFetch,tenantId,companyId,unit.id])
 const profile=data&&profiles(data).find(p=>p.establishmentId===unit.id)
 const selected=(code:string)=>!data||!profile?[]:profile.conceptCodes.filter(c=>(data.concepts.find(v=>v.code===c)??data.historicalConcepts?.find(v=>v.code===c))?.dimensionCode===code).map(c=>conceptLabel(data,c))
 const legacyMap:Record<string,string>={taxes:'tax',products:'product',operations:'operation',documents:'document',obligations:'obligation',keywords:'theme',segments:'sector',activities:'actuacao'}
 const withLegacy=(code:string)=>unique([...selected(code),...Object.entries(profile?.legacyFields??{}).filter(([key])=>legacyMap[key]===code).flatMap(([,values])=>values)])
 const chosenSectors=profile&&data?unique([...withLegacy('sector'),...profile.cnaeSegments.flatMap(c=>c.segmentCode?[conceptLabel(data,c.segmentCode)]:[])]):[]
 const sectors=chosenSectors.length?chosenSectors:data?unique(segmentSteps(data).filter(g=>g.activities.some(a=>a.establishmentId===unit.id)).map(g=>g.title)):[]
 const unknown=profile&&data?profile.conceptCodes.filter(c=>![...data.concepts,...data.historicalConcepts??[]].some(v=>v.code===c)):[]
 return <section className="tp-panel-card onb-profile-page">
  <header className="onb-profile-header" style={{top:headerOffset}}><div><button className="onb-link" onClick={onBack}>Voltar aos CNPJs</button><h1>Perfil tributário</h1><h2>{data?.companyName??unit.name}</h2><p>CNPJ {formatProfileCnpj(unit.cnpj)} · {unit.isHeadOffice?'Matriz':'Filial'} · {types.find(t=>t.code===unit.typeCode)?.name??unit.typeCode??'Tipo não informado'} · {unit.uf??'UF não informada'} · IE {unit.stateRegistration||'Não informada'}</p></div><button className="onb-secondary" onClick={()=>onEdit('company')}>Editar dados e IE</button></header>
  {error?<p role="alert">Não foi possível carregar o perfil.</p>:!profile||!data?<p role="status">Carregando perfil…</p>:<div className="onb-profile-grid">
   <SelectedBlock title="Segmento" items={sectors} edit="segments" onEdit={onEdit}/>
   <SelectedBlock title="Produtos" items={withLegacy('product')} historical={profile.historicalCodes.some(c=>(data.historicalConcepts?.find(v=>v.code===c)?.dimensionCode)==='product')} edit={profile.historicalCodes.some(c=>(data.historicalConcepts?.find(v=>v.code===c)?.dimensionCode)==='product')?'profile':'segments'} onEdit={onEdit}/>
   <SelectedBlock title="NCMs" items={profile.ncmCodes} edit="segments" onEdit={onEdit}/>
   {profileDimensions.map(([code,title])=>{const items=withLegacy(code);if(code==='regime'&&profile.taxRegime!=='NAO_INFORMADO')items.push('Regime declarado: '+(regimeLabels[profile.taxRegime]??profile.taxRegime));return <SelectedBlock key={code} title={title} items={items} historical={profile.historicalCodes.some(c=>(data.historicalConcepts?.find(v=>v.code===c)?.dimensionCode)===code)} edit={'dimension-group:'+profileDimensionGroups.find(g=>g.dimensions.includes(code))!.code} onEdit={onEdit}/>})}
   {(unknown.length>0||Object.keys(profile.legacyFields).some(k=>!legacyMap[k]&&profile.legacyFields[k].length))&&<SelectedBlock title="Outras escolhas históricas" items={[...unknown,...Object.entries(profile.legacyFields).filter(([key])=>!legacyMap[key]).flatMap(([key,v])=>v.map(value=>(legacyLabels[key]??key)+': '+value))]} edit="profile" onEdit={onEdit} historical/>}
   {profile.taxRegime!=='NAO_INFORMADO'&&<button className="onb-link" onClick={()=>onEdit('profile')}>Editar regime declarado</button>}
  </div>}
 </section>
}
