import type {AssistantData} from './onboarding-assistant-api'

/** Identity is kept separate from the display label. Legacy text has no canonical code. */
export type ProfileItem={identity:string;label:string;code?:string}
export const canonicalProfileItem=(code:string,label=code):ProfileItem=>({identity:'code:'+code,code,label})
export const legacyProfileItem=(field:string,value:string):ProfileItem=>({identity:'legacy:'+JSON.stringify([field,value]),label:value})
export const uniqueProfileItems=(items:ProfileItem[])=>[...new Map(items.map(item=>[item.identity,item])).values()]
export function selectedProfileItems(data:AssistantData,codes:string[],dimension:string):ProfileItem[]{
 return codes.flatMap(code=>{
  const concept=data.concepts.find(c=>c.code===code)??data.historicalConcepts?.find(c=>c.code===code)
  return concept?.dimensionCode===dimension?[canonicalProfileItem(code,concept.label)]:[]
 })
}

