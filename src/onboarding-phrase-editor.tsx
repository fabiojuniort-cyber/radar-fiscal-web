import {useEffect,useState} from 'react'
import type {ProductApiFetch} from './product-api'
import {assistantRequest} from './onboarding-assistant-api'
type Row={segment:string;phrases:string[];version_no:number}
export function OnboardingPhraseEditor({apiFetch}:{apiFetch:ProductApiFetch}){
 const [rows,setRows]=useState<Row[]>([]),[segment,setSegment]=useState('generico'),[text,setText]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const load=async()=>{const result=await assistantRequest<{items:Row[]}>(apiFetch,'','/api/v1/onboarding/phrases');setRows(result.items);setText(result.items.find(r=>r.segment===segment)?.phrases.join('\n')??'')}
 useEffect(()=>{void load().catch(()=>setMessage('Não foi possível carregar as frases.'))},[apiFetch])
 const save=async()=>{const row=rows.find(r=>r.segment===segment);if(!row)return;setBusy(true);setMessage('');try{const result=await assistantRequest<{item:Row}>(apiFetch,'','/api/v1/admin/onboarding/phrases/'+segment,{expectedVersion:row.version_no,phrases:text.split('\n').map(s=>s.trim()).filter(Boolean)});setRows(rows.map(r=>r.segment===segment?result.item:r));setMessage('Frases salvas.')}catch{setMessage('Não foi possível salvar. Recarregue para conferir alterações de outra tela.')}finally{setBusy(false)}}
 return <section><h2>Frases do assistente</h2><p>Uma frase por linha. Segmentos sem correspondência usam generico.</p><label>Segmento<select value={segment} onChange={e=>{setSegment(e.target.value);setText(rows.find(r=>r.segment===e.target.value)?.phrases.join('\n')??'')}}>{rows.map(row=><option key={row.segment}>{row.segment}</option>)}</select></label><label>Frases<textarea rows={10} value={text} onChange={e=>setText(e.target.value)} /></label><button disabled={busy} onClick={()=>void save()}>Salvar frases</button><button disabled={busy} onClick={()=>void load()}>Recarregar frases</button>{message&&<p role="status">{message}</p>}</section>
}
