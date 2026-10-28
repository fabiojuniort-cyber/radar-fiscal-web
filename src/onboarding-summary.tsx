import {useState} from 'react'
import {segmentSteps,segmentChoice,segmentComplete,type AssistantData} from './onboarding-assistant-api'
import {profiles,unique} from './onboarding-selection'
import {conceptLabel,legacyLabels,regimeLabels} from './onboarding-profile-editor'
import {profileDimensions,profileDimensionGroups} from './onboarding-dimensions'

export const formatSummaryNcm=(code:string)=>code.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1.$2.$3')
const counts=(products:number,ncms:number)=>products+' '+(products===1?'produto':'produtos')+' · '+ncms+' '+(ncms===1?'NCM':'NCMs')
export function SummaryChips({title,items,ncm=false}:{title:string;items:string[];ncm?:boolean}){
 const [expanded,setExpanded]=useState(false),values=unique(items),shown=expanded?values:values.slice(0,8)
 return <div className="onb-summary-selection" role="group" aria-label={title}><h4>{title} · {values.length}</h4>
  {shown.length?<div className="onb-summary-chip-rows">{Array.from({length:Math.ceil(shown.length/8)},(_,i)=><div className="onb-summary-chip-row" key={i}>{shown.slice(i*8,i*8+8).map(value=><span className="onb-profile-chip" key={value}>{ncm?formatSummaryNcm(value):value}</span>)}</div>)}</div>:<span className="onb-empty-selection">Nada selecionado</span>}
  {values.length>8&&<button type="button" className="onb-link" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Ver menos':'+'+(values.length-8)+' ver todos'}</button>}
 </div>
}
function Block({title,count,edit,onEdit,children,status}:{title:string;count:string;edit:()=>void;onEdit?:string;children:React.ReactNode;status?:string}){
 return <section className="onb-profile-block onb-summary-block" aria-label={title}><header><h3>{title} <span>· {count}</span></h3><button type="button" className="onb-link" aria-label={onEdit??'Editar '+title} onClick={edit}>Editar</button></header>{status&&<span className="onb-summary-status">{status}</span>}<div className="onb-selected-box">{children}</div></section>
}
export function OnboardingSummary({data,onEditCard,onEditProfile}:{data:AssistantData;onEditCard:(id:string)=>void;onEditProfile:(id:string)=>void}){
 const segments=segmentSteps(data),concepts=[...data.concepts,...data.historicalConcepts??[]]
 const dimensionOf=(code:string)=>concepts.find(c=>c.code===code)?.dimensionCode
 return <div className="onb-readable-summary">{profiles(data).map(profile=>{
  const selected=profile.conceptCodes
  const productCodes=selected.filter(c=>dimensionOf(c)==='product')
  const assignedProducts=new Set<string>(),assignedNcms=new Set<string>()
  const blocks=segments.filter(g=>g.activities.some(a=>a.establishmentId===profile.establishmentId)).map(g=>{
   const activities=g.activities.filter(a=>a.establishmentId===profile.establishmentId)
   const targets=new Set(activities.flatMap(a=>a.suggestions.map(s=>s.target)))
   const products=productCodes.filter(c=>targets.has(c))
   const linked=new Set(data.concepts.filter(c=>products.includes(c.code)).flatMap(c=>c.ncmCodes??[]))
   const ncms=profile.ncmCodes.filter(c=>targets.has(c)||linked.has(c))
   products.forEach(c=>assignedProducts.add(c));ncms.forEach(c=>assignedNcms.add(c))
   return <Block key={g.id} title={g.title} count={counts(products.length,ncms.length)} edit={()=>onEditCard(g.id)} status={!segmentComplete(data,g,profile.establishmentId)?'Pendente':segmentChoice(data,g,profile.establishmentId)?.status==='SKIPPED'?'Etapa pulada':undefined}><SummaryChips title="Produtos" items={products.map(c=>conceptLabel(data,c))}/><SummaryChips title="NCMs" items={ncms} ncm/></Block>
  })
  const extraProducts=productCodes.filter(c=>!assignedProducts.has(c)).map(c=>conceptLabel(data,c)),extraNcms=profile.ncmCodes.filter(c=>!assignedNcms.has(c))
  const extras=selected.filter(c=>!dimensionOf(c)||!['product','sector',...profileDimensions.map(([code])=>code)].includes(dimensionOf(c)!)).map(c=>conceptLabel(data,c))
  const legacy=Object.entries(profile.legacyFields).filter(([,v])=>v.length)
  return <div key={profile.establishmentId} className="onb-summary-unit"><header className="onb-summary-unit-header"><h3>{profile.isHeadOffice?'Matriz':'Estabelecimento'}</h3><button type="button" className="onb-link" aria-label={'Editar escolhas - '+(profile.name||'Estabelecimento')} onClick={()=>onEditProfile(profile.establishmentId)}>Editar escolhas completas</button></header>
   <div className="onb-summary-blocks">{blocks}
    {(extraProducts.length>0||extraNcms.length>0)&&<Block title="Outros produtos e NCMs salvos" count={counts(extraProducts.length,extraNcms.length)} edit={()=>onEditProfile(profile.establishmentId)}><SummaryChips title="Produtos" items={extraProducts}/><SummaryChips title="NCMs" items={extraNcms} ncm/></Block>}
    {profileDimensions.map(([code,title])=>{const items=selected.filter(c=>dimensionOf(c)===code).map(c=>conceptLabel(data,c));if(code==='regime'&&profile.taxRegime!=='NAO_INFORMADO')items.push('Regime declarado: '+(regimeLabels[profile.taxRegime]??profile.taxRegime));return <Block key={code} title={title} count={unique(items).length+' itens'} edit={()=>onEditCard('dimension-group:'+profileDimensionGroups.find(g=>g.dimensions.includes(code))!.code)}><SummaryChips title="Selecionados" items={items}/></Block>})}
    {(legacy.length>0||extras.length>0||selected.some(c=>dimensionOf(c)==='sector')||profile.cnaeSegments.length>0)&&<Block title="Outras escolhas e perfil anterior" count={legacy.reduce((n,[,v])=>n+v.length,0)+extras.length+selected.filter(c=>dimensionOf(c)==='sector').length+profile.cnaeSegments.length+' itens'} edit={()=>onEditProfile(profile.establishmentId)}>
     {legacy.map(([key,values])=><SummaryChips key={key} title={legacyLabels[key]??key} items={values}/>)}
     <SummaryChips title="Outras escolhas" items={[...extras,...selected.filter(c=>dimensionOf(c)==='sector').map(c=>conceptLabel(data,c)),...profile.cnaeSegments.map(c=>c.cnaeCode+' · '+(c.segmentCode?conceptLabel(data,c.segmentCode):'Sem segmento'))]}/>
    </Block>}
   </div>{profile.historicalCodes.length>0&&<p className="onb-hint">Há escolhas de uma versão anterior que precisam de revisão.</p>}
  </div>
 })}</div>
}
