import type { ProductApiFetch } from './product-api'
export type CardChoice = { status: 'CONFIRMED' | 'SKIPPED'; conceptCodes: string[]; ncmCodes: string[] }
export type AssistantData = {
  version: number; release: {id:string;version:string}; companyName:string
  state:{completed:boolean;cards:Record<string,CardChoice>;units:Record<string,{cards:Record<string,CardChoice>}>}
  concepts:{code:string;label:string;dimensionCode:string}[]
  cards:{establishmentId:string;cnaeCode:string;description:string;phraseSegment:string;
    suggestions:{kind:string;target:string;segment:string}[]}[]
}
export async function assistantRequest<T>(apiFetch:ProductApiFetch,tenantId:string,path:string,body?:unknown):Promise<T>{
  const response=await apiFetch(path,{method:body?'PUT':'GET',headers:{'x-tenant-id':tenantId,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})})
  const result=await response.json()
  if(!response.ok) throw new Error(result.error??'request_failed')
  return result
}
export function assistantSteps(data:AssistantData){return [{id:'company',title:'Empresa'},
  {id:'establishments',title:'Estabelecimentos'},...data.cards.map(c=>({id:'cnae:'+c.cnaeCode,title:c.description,unit:c.establishmentId,card:c})),{id:'summary',title:'Resumo'}]}
export function choiceFor(data:AssistantData,id:string,unit?:string){return unit?data.state.units[unit]?.cards[id]:data.state.cards[id]}
export function initialStep(data:AssistantData){const steps=assistantSteps(data);const index=steps.findIndex(step=>!choiceFor(data,step.id,'unit' in step?step.unit:undefined));return index<0?0:index}
