import type {ProductApiFetch} from './product-api'
export type CardChoice={status:'CONFIRMED'|'SKIPPED';conceptCodes:string[];ncmCodes:string[]}
export type ActivityCard={establishmentId:string;cnaeCode:string;description:string;segmentCode?:string;segmentLabel?:string;phraseSegment:string;phraseSegments?:string[];suggestions:{kind:string;target:string;segment:string}[]}
export type AssistantData={version:number;release:{id:string;version:string};companyName:string;companyCnpj?:string;
 state:{completed:boolean;cards:Record<string,CardChoice>;units:Record<string,{baseConceptCodes?:string[];baseNcmCodes?:string[];cards:Record<string,CardChoice>}>};
 concepts:{code:string;label:string;dimensionCode:string}[];cards:ActivityCard[]}
export type SegmentStep={id:string;title:string;code:string;activities:ActivityCard[]}
export function segmentSteps(data:AssistantData):SegmentStep[]{
 const groups=new Map<string,SegmentStep>()
 for(const card of data.cards){
  const code=card.segmentCode??card.suggestions.find(s=>s.kind==='SEGMENT')?.target??'sector.sem_segmento'
  const title=card.segmentLabel??card.suggestions[0]?.segment??'Outras atividades'
  const group=groups.get(code)??{id:'segment:'+code,title,code,activities:[]};group.activities.push(card);groups.set(code,group)
 }
 return [...groups.values()].sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'))
}
export function assistantSteps(data:AssistantData){return [{id:'company',title:'Empresa'}, {id:'establishments',title:'Estabelecimentos'},...segmentSteps(data),{id:'summary',title:'Resumo'}]}
export function choiceFor(data:AssistantData,id:string,unit?:string){return unit?data.state.units[unit]?.cards[id]:data.state.cards[id]}
export function segmentChoice(data:AssistantData,segment:SegmentStep,unit:string):CardChoice|undefined{
 const direct=choiceFor(data,segment.id,unit);if(direct)return direct
 const old=segment.activities.filter(a=>a.establishmentId===unit).map(a=>choiceFor(data,'cnae:'+a.cnaeCode,unit))
 if(!old.length||old.some(c=>!c))return undefined
 return {status:old.every(c=>c!.status==='SKIPPED')?'SKIPPED':'CONFIRMED',conceptCodes:[...new Set(old.flatMap(c=>c!.conceptCodes))],ncmCodes:[...new Set(old.flatMap(c=>c!.ncmCodes))]}
}
export function initialStep(data:AssistantData){
 const steps=assistantSteps(data)
 const index=steps.findIndex(step=>'activities'in step?[...new Set(step.activities.map(a=>a.establishmentId))].some(id=>!segmentChoice(data,step,id)):!choiceFor(data,step.id))
 return index<0?steps.length-1:index
}
export async function assistantRequest<T>(apiFetch:ProductApiFetch,tenantId:string,path:string,body?:unknown):Promise<T>{
 const response=await apiFetch(path,{method:body?'PUT':'GET',headers:{'x-tenant-id':tenantId,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
 const result=await response.json();if(!response.ok)throw new Error(result.error??'request_failed');return result
}
