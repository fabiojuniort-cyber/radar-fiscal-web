import type {AssistantData} from './onboarding-assistant-api'
import {profileDimensions} from './onboarding-dimensions'

export function filteredTaxonomyGroups(data:AssistantData,dimension:string,query:string){
 const all=data.concepts.filter(c=>c.dimensionCode===dimension)
 const search=query.trim().toLocaleLowerCase('pt-BR')
 const title=profileDimensions.find(([code])=>code===dimension)?.[1]??dimension
 const dimensionMatches=title.toLocaleLowerCase('pt-BR').includes(search)
 const groups=(data.taxonomyGroups??[]).filter(g=>g.dimensionCode===dimension).sort((a,b)=>a.displayOrder-b.displayOrder||a.label.localeCompare(b.label,'pt-BR'))
 const known=new Set(groups.map(g=>g.code))
 return [...groups.map(g=>({...g,items:all.filter(c=>c.groupCode===g.code)})),{code:'__ungrouped',label:'Sem grupo',items:all.filter(c=>!c.groupCode||!known.has(c.groupCode))}]
  .map(g=>({...g,matches:g.items.filter(c=>!search||dimensionMatches||g.label.toLocaleLowerCase('pt-BR').includes(search)||c.label.toLocaleLowerCase('pt-BR').includes(search)||c.code.toLocaleLowerCase('pt-BR').includes(search))})).filter(g=>g.matches.length)
}
