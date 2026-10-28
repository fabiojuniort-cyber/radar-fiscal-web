import {profileDimensionGroups} from './onboarding-dimensions'
import type {ProductApiFetch} from './product-api'
export type CardChoice={status:'CONFIRMED'|'SKIPPED';conceptCodes:string[];ncmCodes:string[]}
export type ActivityCard={establishmentId:string;cnaeCode:string;description:string;segmentCode?:string;segmentLabel?:string;phraseSegment:string;phraseSegments?:string[];suggestions:{kind:string;target:string;segment:string}[]}
export type EffectiveProfile={establishmentId:string;name:string;isHeadOffice:boolean;taxRegime:string;conceptCodes:string[];ncmCodes:string[];legacyFields:Record<string,string[]>;cnaeSegments:{cnaeCode:string;segmentCode:string|null}[];historicalCodes:string[]}
export type AssistantData={version:number;release:{id:string;version:string};companyName:string;companyCnpj?:string;
 state:{completed:boolean;cards:Record<string,CardChoice>;units:Record<string,{baseConceptCodes?:string[];baseNcmCodes?:string[];cards:Record<string,CardChoice>}>};
 dimensions?:{code:string;name:string}[];effectiveProfiles?:EffectiveProfile[];historicalConcepts?:{code:string;label:string;dimensionCode:string}[];concepts:{code:string;label:string;dimensionCode:string;ncmCodes?:string[]}[];cards:ActivityCard[];segmentCards?:ActivityCard[]}
export type SegmentStep={id:string;title:string;code:string;activities:ActivityCard[]}
export function scopedAssistant(data:AssistantData,id:string):AssistantData{return {...data,cards:data.cards.filter(c=>c.establishmentId===id),...(data.segmentCards?{segmentCards:data.segmentCards.filter(c=>c.establishmentId===id)}:{}),...(data.effectiveProfiles?{effectiveProfiles:data.effectiveProfiles.filter(p=>p.establishmentId===id)}:{})}}
export function segmentSteps(data:AssistantData):SegmentStep[]{
 const groups=new Map<string,SegmentStep>()
 for(const card of data.segmentCards??data.cards){
  const code=card.segmentCode??card.suggestions.find(s=>s.kind==='SEGMENT')?.target??'sector.sem_segmento'
  const title=card.segmentLabel??card.suggestions[0]?.segment??'Outras atividades'
  const group=groups.get(code)??{id:'segment:'+code,title,code,activities:[]};group.activities.push(card);groups.set(code,group)
 }
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'))
}
export type DimensionStep={id:string;title:string;dimensions:string[]}
export function dimensionSteps(data:AssistantData):DimensionStep[]{return data.dimensions?profileDimensionGroups.map(g=>({id:'dimension-group:'+g.code,title:g.title,dimensions:g.dimensions})):[]}
export function dimensionStepComplete(data:AssistantData,step:DimensionStep){return !!choiceFor(data,step.id)||step.dimensions.filter(code=>data.dimensions?.some(d=>d.code===code)).every(code=>!!choiceFor(data,'dimension:'+code))}
export function assistantSteps(data:AssistantData){return [{id:'company',title:'Empresa e Inscrição Estadual'},...segmentSteps(data),...dimensionSteps(data),{id:'summary',title:'Resumo'}]}
export function choiceFor(data:AssistantData,id:string,unit?:string){return unit?data.state.units[unit]?.cards[id]:data.state.cards[id]}
export function segmentChoice(data:AssistantData,segment:SegmentStep,unit:string):CardChoice|undefined{
 const direct=choiceFor(data,segment.id,unit);if(direct)return direct
 const old=segment.activities.filter(a=>a.establishmentId===unit).map(a=>{const c=choiceFor(data,'cnae:'+a.cnaeCode,unit);if(!c)return undefined;const targets=new Set(a.suggestions.map(s=>s.target));return {...c,conceptCodes:c.conceptCodes.filter(code=>targets.has(code)),ncmCodes:c.ncmCodes.filter(code=>targets.has(code))}})
 if(!old.some(Boolean))return undefined
 return {status:old.filter(Boolean).every(c=>c!.status==='SKIPPED')?'SKIPPED':'CONFIRMED',conceptCodes:[...new Set(old.flatMap(c=>c?.conceptCodes??[]))],ncmCodes:[...new Set(old.flatMap(c=>c?.ncmCodes??[]))]}
}
export function segmentComplete(data:AssistantData,segment:SegmentStep,unit:string){
 return !!choiceFor(data,'profile',unit)||!!choiceFor(data,segment.id,unit)||segment.activities.filter(a=>a.establishmentId===unit).every(a=>!!choiceFor(data,'cnae:'+a.cnaeCode,unit))
}
export function initialStep(data:AssistantData){
 const steps=assistantSteps(data)
 const index=steps.findIndex(step=>'activities'in step?[...new Set(step.activities.map(a=>a.establishmentId))].some(id=>!segmentComplete(data,step,id)):'dimensions'in step?!dimensionStepComplete(data,step):!choiceFor(data,step.id))
 return index<0?steps.length-1:index
}
export async function assistantRequest<T>(apiFetch:ProductApiFetch,tenantId:string,path:string,body?:unknown):Promise<T>{
 const response=await apiFetch(path,{method:body?'PUT':'GET',headers:{'x-tenant-id':tenantId,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 const result=await response.json();if(!response.ok)throw new Error(result.error??'request_failed');return result
}


