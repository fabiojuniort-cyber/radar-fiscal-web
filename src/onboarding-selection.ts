import type {AssistantData,CardChoice,EffectiveProfile,SegmentStep} from './onboarding-assistant-api'
export type Choice={conceptCodes:string[];ncmCodes:string[]}
export type ProductRow={key:string;label:string;product:string;ncms:string[]}
export const unique=(items:string[])=>[...new Set(items)]
export function effectiveChoice(data:AssistantData,id:string):Choice{
 const explicit=data.effectiveProfiles?.find(p=>p.establishmentId===id)
 if(explicit)return {conceptCodes:[...explicit.conceptCodes],ncmCodes:[...explicit.ncmCodes]}
 const unit=data.state.units[id],saved=Object.values(unit?.cards??{}).filter(c=>c.status==='CONFIRMED')
 return {conceptCodes:unique([...(unit?.baseConceptCodes??[]),...saved.flatMap(c=>c.conceptCodes)]),ncmCodes:unique([...(unit?.baseNcmCodes??[]),...saved.flatMap(c=>c.ncmCodes)])}
}
export function profiles(data:AssistantData):EffectiveProfile[]{
 return data.effectiveProfiles??unique(data.cards.map(c=>c.establishmentId)).map(id=>({establishmentId:id,...effectiveChoice(data,id),taxRegime:'NAO_INFORMADO',isHeadOffice:false,name:'',legacyFields:{},cnaeSegments:[],historicalCodes:[]}))
}
export function productRows(data:AssistantData,step:SegmentStep,id:string):ProductRow[]{
 const codes=unique(step.activities.filter(a=>a.establishmentId===id).flatMap(a=>a.suggestions.filter(s=>s.kind==='PRODUCT').map(s=>s.target)))
 return codes.map(code=>{const p=data.concepts.find(c=>c.code===code);return {key:code,product:code,label:p?.label??code,ncms:p?.ncmCodes??[]}}).sort((a,b)=>a.label.localeCompare(b.label,'pt-BR'))
}
/** The product's own published evidence is the only source of automatic NCM additions. */
export function toggleProduct(choice:Choice,product:string,ncms:string[],data:AssistantData,explicitNcms:string[]=[]):Choice{
 const selected=choice.conceptCodes.includes(product)
 const codes=selected?choice.conceptCodes.filter(c=>c!==product):unique([...choice.conceptCodes,product])
 const shared=new Set(data.concepts.filter(c=>codes.includes(c.code)).flatMap(c=>c.ncmCodes??[]))
 return {conceptCodes:codes,ncmCodes:selected?choice.ncmCodes.filter(n=>!ncms.includes(n)||shared.has(n)||explicitNcms.includes(n)):unique([...choice.ncmCodes,...ncms])}
}
export function segmentSnapshot(data:AssistantData,step:SegmentStep,id:string):CardChoice|undefined{
 const direct=data.state.units[id]?.cards[step.id];if(direct)return direct
 const targets=new Set(step.activities.filter(a=>a.establishmentId===id).flatMap(a=>a.suggestions.map(s=>s.target)))
 const effective=effectiveChoice(data,id)
 if(!effective.conceptCodes.some(c=>targets.has(c))&&!effective.ncmCodes.some(c=>targets.has(c)))return undefined
 return {status:'CONFIRMED',conceptCodes:effective.conceptCodes.filter(c=>targets.has(c)),ncmCodes:effective.ncmCodes.filter(c=>targets.has(c))}
}
