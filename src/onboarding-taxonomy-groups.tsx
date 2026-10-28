import {useState} from 'react'
import type {AssistantData} from './onboarding-assistant-api'

export function TaxonomyGroups({data,dimension,query,selected,onToggle}:{data:AssistantData;dimension:string;query:string;selected:string[];onToggle:(code:string)=>void}){
 const [closed,setClosed]=useState<string[]>([])
 const all=data.concepts.filter(c=>c.dimensionCode===dimension)
 const search=query.trim().toLocaleLowerCase('pt-BR')
 const groups=(data.taxonomyGroups??[]).filter(g=>g.dimensionCode===dimension).sort((a,b)=>a.displayOrder-b.displayOrder||a.label.localeCompare(b.label,'pt-BR'))
 const known=new Set(groups.map(g=>g.code))
 const sections=[...groups.map(g=>({...g,items:all.filter(c=>c.groupCode===g.code)})),{code:'__ungrouped',label:'Sem grupo',items:all.filter(c=>!c.groupCode||!known.has(c.groupCode))}]
 const visible=sections.map(g=>({...g,matches:g.items.filter(c=>!search||g.label.toLocaleLowerCase('pt-BR').includes(search)||c.label.toLocaleLowerCase('pt-BR').includes(search))})).filter(g=>g.matches.length)
 if(!all.length)return <p>Não há opções publicadas nesta dimensão.</p>
 return <div className="onb-taxonomy-groups">{visible.map(g=>{const open=!!search||!closed.includes(g.code);return <div className="onb-taxonomy-group" key={g.code}>
  <button type="button" className="onb-taxonomy-toggle" aria-expanded={open} onClick={()=>setClosed(p=>p.includes(g.code)?p.filter(c=>c!==g.code):[...p,g.code])}>{open?'▾':'▸'} {g.label} · {g.matches.length}</button>
  {open&&<div className="onb-suggestions">{g.matches.map(c=><label className={'onb-suggestion '+(selected.includes(c.code)?'is-selected':'')} key={c.code}><input type="checkbox" checked={selected.includes(c.code)} onChange={()=>onToggle(c.code)}/><span>{c.label}</span></label>)}</div>}
 </div>})}{!visible.length&&<p>Nenhuma opção encontrada.</p>}</div>
}
