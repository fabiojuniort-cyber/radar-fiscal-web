import {useState} from 'react'
import {segmentSteps,segmentChoice,segmentComplete,type AssistantData} from './onboarding-assistant-api'
import {profiles,unique} from './onboarding-selection'
import {conceptLabel,legacyLabels,regimeLabels} from './onboarding-profile-editor'
import {profileDimensions,profileDimensionGroups} from './onboarding-dimensions'

export const formatSummaryNcm=(code:string)=>code.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1.$2.$3')
const counts=(products:number,ncms:number)=>products+' '+(products===1?'produto':'produtos')+' · '+ncms+' '+(ncms===1?'NCM':'NCMs')
export type SummaryItem={code:string;label:string}
export const summaryItems=(items:(string|SummaryItem)[])=>[...new Map(items.map(item=>{const value=typeof item==='string'?{code:item,label:item}:item;return [value.code,value] as const})).values()]
export function SummaryChips({title,items,ncm=false}:{title:string;items:(string|SummaryItem)[];ncm?:boolean}){
 const [expanded,setExpanded]=useState(false),values=summaryItems(items),shown=expanded?values:values.slice(0,8)
 return <div className="onb-summary-selection" role="group" aria-label={title}><h4>{title} · {values.length}</h4>
  {shown.length?<div className="onb-summary-chip-rows">{Array.from({length:Math.ceil(shown.length/8)},(_,i)=><div className="onb-summary-chip-row" key={i}>{shown.slice(i*8,i*8+8).map(value=><span className="onb-profile-chip" key={value.code} data-code={value.code}>{ncm?formatSummaryNcm(value.code):value.label}</span>)}</div>)}</div>:<span className="onb-empty-selection">Nada selecionado</span>}
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
  const selected=unique(profile.conceptCodes),ncmCodes=unique(profile.ncmCodes)
  const labeled=(codes:string[])=>unique(codes).map(code=>({code,label:conceptLabel(data,code)}))
  const productCodes=selected.filter(c=>dimensionOf(c)==='product')
  const assignedProducts=new Set<string>(),assignedNcms=new Set<string>()
  const blocks=segments.filter(g=>g.activities.some(a=>a.establishmentId===profile.establishmentId)).map(g=>{
   const activities=g.activities.filter(a=>a.establishmentId===profile.establishmentId)
   const targets=new Set(activities.flatMap(a=>a.suggestions.map(s=>s.target)))
   const products=productCodes.filter(c=>targets.has(c))
   const linked=new Set(data.concepts.filter(c=>products.includes(c.code)).flatMap(c=>c.ncmCodes??[]))
   const ncms=ncmCodes.filter(c=>targets.has(c)||linked.has(c))
   products.forEach(c=>assignedProducts.add(c));ncms.forEach(c=>assignedNcms.add(c))
   return <Block key={g.id} title={g.title} count={counts(products.length,ncms.length)} edit={()=>onEditCard(g.id)} status={!segmentComplete(data,g,profile.establishmentId)?'Pendente':segmentChoice(data,g,profile.establishmentId)?.status==='SKIPPED'?'Etapa pulada':undefined}><SummaryChips title="Produtos" items={labeled(products)}/><SummaryChips title="NCMs" items={ncms} ncm/></Block>
  })
  const extraProducts=labeled(productCodes.filter(c=>!assignedProducts.has(c))),extraNcms=ncmCodes.filter(c=>!assignedNcms.has(c))
  const extras=labeled(selected.filter(c=>!dimensionOf(c)||!['product','sector',...profileDimensions.map(([code])=>code)].includes(dimensionOf(c)!)))
  const legacy=Object.entries(profile.legacyFields).map(([key,values])=>[key,unique(values)] as const).filter(([,v])=>v.length)
  return <div key={profile.establishmentId} className="onb-summary-unit"><header className="onb-summary-unit-header"><h3>{profile.isHeadOffice?'Matriz':'Estabelecimento'}</h3><button type="button" className="onb-link" aria-label={'Editar escolhas - '+(profile.name||'Estabelecimento')} onClick={()=>onEditProfile(profile.establishmentId)}>Editar escolhas completas</button></header>
   <div className="onb-summary-blocks">{blocks}
    {(extraProducts.length>0||extraNcms.length>0)&&<Block title="Outros produtos e NCMs salvos" count={counts(extraProducts.length,extraNcms.length)} edit={()=>onEditProfile(profile.establishmentId)}><SummaryChips title="Produtos" items={extraProducts}/><SummaryChips title="NCMs" items={extraNcms} ncm/></Block>}
    {profileDimensions.map(([code,title])=>{const items=labeled(selected.filter(c=>dimensionOf(c)===code));if(code==='regime'&&profile.taxRegime!=='NAO_INFORMADO')items.push({code:'declared-regime:'+profile.taxRegime,label:'Regime declarado: '+(regimeLabels[profile.taxRegime]??profile.taxRegime)});return <Block key={code} title={title} count={summaryItems(items).length+' itens'} edit={()=>code==='regime'&&profile.taxRegime!=='NAO_INFORMADO'?onEditProfile(profile.establishmentId):onEditCard('dimension-group:'+profileDimensionGroups.find(g=>g.dimensions.includes(code))!.code)}><SummaryChips title="Selecionados" items={items}/></Block>})}
    {(legacy.length>0||extras.length>0||selected.some(c=>dimensionOf(c)==='sector')||profile.cnaeSegments.length>0)&&<Block title="Outras escolhas e perfil anterior" count={legacy.reduce((n,[,v])=>n+v.length,0)+extras.length+selected.filter(c=>dimensionOf(c)==='sector').length+profile.cnaeSegments.length+' itens'} edit={()=>onEditProfile(profile.establishmentId)}>
     {legacy.map(([key,values])=><SummaryChips key={key} title={legacyLabels[key]??key} items={values}/>)}
     <SummaryChips title="Outras escolhas" items={[...extras,...labeled(selected.filter(c=>dimensionOf(c)==='sector')),...profile.cnaeSegments.map(c=>({code:'cnae:'+c.cnaeCode+':'+(c.segmentCode??''),label:c.cnaeCode+' · '+(c.segmentCode?conceptLabel(data,c.segmentCode):'Sem segmento')}))]}/>
    </Block>}
   </div>{profile.historicalCodes.length>0&&<p className="onb-hint">Há escolhas de uma versão anterior que precisam de revisão.</p>}
  </div>
 })}</div>
}
