import * as Dialog from '@radix-ui/react-dialog'
import { useEffect,useState } from 'react'
import type { ProductApiFetch,Establishment } from './product-api'
import { assistantRequest,assistantSteps,choiceFor,initialStep,type AssistantData } from './onboarding-assistant-api'
import './onboarding-assistant.css'
type Phrase={segment:string;phrases:string[];version_no:number}
export function OnboardingAssistant({apiFetch,tenantId,companyId,units,onClose,onSaved,animate=false}:{apiFetch:ProductApiFetch;tenantId:string;companyId:string;units:Establishment[];onClose:()=>void;onSaved:()=>void;animate?:boolean}){
  const [data,setData]=useState<AssistantData|null>(null)
  const [index,setIndex]=useState(0),[codes,setCodes]=useState<string[]>([]),[ncms,setNcms]=useState('')
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[importing,setImporting]=useState(animate)
  const [phrases,setPhrases]=useState<Phrase[]>([]),[phrase,setPhrase]=useState('Preparando seu perfil tributário.')
  const path='/api/v1/companies/'+companyId+'/onboarding'
  const load=async()=>{const result=await assistantRequest<AssistantData>(apiFetch,tenantId,path);setData(result);setIndex(initialStep(result));setError('')}
  useEffect(()=>{let active=true;assistantRequest<AssistantData>(apiFetch,tenantId,path).then(result=>{if(active){setData(result);setIndex(initialStep(result))}}).catch(()=>{if(active)setError('Não foi possível carregar o assistente.')});assistantRequest<{items:Phrase[]}>(apiFetch,tenantId,'/api/v1/onboarding/phrases').then(r=>{if(active)setPhrases(r.items)}).catch(()=>{});return()=>{active=false}},[apiFetch,tenantId,path])
  useEffect(()=>{if(!importing)return;const timer=setTimeout(()=>setImporting(false),6000);return()=>clearTimeout(timer)},[importing])
  useEffect(()=>{if(!importing)return;const groups=data?.cards[0]?.phraseSegments??[data?.cards[0]?.phraseSegment??'generico'];const matched=phrases.filter(p=>groups.includes(p.segment)).flatMap(p=>p.phrases);const pool=matched.length?matched:phrases.find(p=>p.segment==='generico')?.phrases??['Preparando seu perfil tributário.'];const pick=()=>setPhrase(pool[Math.floor(Math.random()*pool.length)]??'Preparando seu perfil tributário.');pick();const timer=setInterval(pick,1600);return()=>clearInterval(timer)},[importing,phrases,data])
  const steps=data?assistantSteps(data):[],step=steps[index]
  useEffect(()=>{if(!data||!step)return;const saved=choiceFor(data,step.id,'unit'in step?step.unit:undefined);setCodes(saved?.conceptCodes??[]);setNcms((saved?.ncmCodes??[]).join(', '))},[data,index])
  const save=async(skip:boolean)=>{if(!data||!step)return;setBusy(true);setError('');try{
    const result=await assistantRequest<Pick<AssistantData,'state'|'version'|'release'>>(apiFetch,tenantId,path,{expectedVersion:data.version,releaseId:data.release.id,cardId:step.id,...('unit'in step?{establishmentId:step.unit}:{}),status:skip?'SKIPPED':'CONFIRMED',conceptCodes:skip?[]:codes,ncmCodes:skip?[]:ncms.split(/[,;\s]+/).filter(Boolean)})
    setData({...data,...result});onSaved();if(index<steps.length-1)setIndex(index+1);else onClose()
  }catch(e){const code=e instanceof Error?e.message:'';setError(code==='profile_version_conflict'?'O perfil mudou em outra tela. Recarregue antes de salvar.':code==='taxonomy_release_changed'?'A taxonomia mudou. Recarregue e confira suas escolhas.':code==='taxonomy_selection_review_required'?'Há escolhas de uma taxonomia anterior. Feche o assistente e revise o perfil tributário antes de continuar.':'Não foi possível salvar este card. Confira os dados.')}finally{setBusy(false)}}
  const card=step&&'card'in step?step.card:undefined
  const suggested=card?[...new Set(card.suggestions.filter(s=>s.kind==='PRODUCT').map(s=>s.target).concat(data?.concepts.filter(c=>c.dimensionCode==='sector'&&card.suggestions.some(s=>s.segment===c.label)).map(c=>c.code)??[]))]:[]
  const suggestedNcms=card?[...new Set(card.suggestions.filter(s=>s.kind==='NCM').map(s=>s.target))]:[]
  return <Dialog.Root open onOpenChange={open=>{if(!open&&!busy)onClose()}}><Dialog.Portal><Dialog.Overlay className="onb-overlay"/><Dialog.Content className="onb-dialog" aria-describedby="onb-description">
    <Dialog.Title>Assistente do perfil tributário</Dialog.Title><p id="onb-description">Cada card é salvo separadamente. Você pode fechar e retomar depois.</p>
    <button type="button" aria-label="Fechar assistente" onClick={onClose} disabled={busy}>Fechar</button>
    {error&&<div role="alert">{error} <button onClick={()=>void load()}>Recarregar</button></div>}
    {importing?<div className="onb-import" role="status"><span className="onb-orbit"/>{phrase}</div>:!data||!step?<p role="status">Carregando assistente…</p>:<>
      <p>Card {index+1} de {steps.length} · Taxonomia {data.release.version}</p><h3>{step.title}</h3>
      {step.id==='company'&&<p>{data.companyName}. Confira o cadastro na tela de empresa antes de continuar.</p>}
      {step.id==='establishments'&&<><p>Confira matriz, filiais e Inscrição Estadual. Quando a consulta estadual falhar, informe a IE manualmente na edição da unidade.</p><ul>{units.map(unit=><li key={unit.id}>{unit.name} · {unit.uf} · IE: {unit.stateRegistration??'Não informada'}</li>)}</ul></>}
      {card&&<><p>{units.find(u=>u.id===card.establishmentId)?.name} · CNAE {card.cnaeCode}</p><p>Sugestões publicadas. Marque apenas o que corresponde às operações desta unidade.</p>
        {!card.suggestions.length&&<p>Sem vínculos publicados para este CNAE. Você pode escolher manualmente ou pular.</p>}
        <button onClick={()=>{setCodes(suggested);setNcms(suggestedNcms.join(', '))}}>Selecionar sugestões para conferir</button>
        <label>Segmentos e produtos<select multiple aria-label="Segmentos e produtos" value={codes} onChange={e=>setCodes(Array.from(e.target.selectedOptions,o=>o.value))}>{data.concepts.filter(c=>['sector','product'].includes(c.dimensionCode)).map(c=><option key={c.code} value={c.code}>{c.label}{suggested.includes(c.code)?' (sugerido)':''}</option>)}</select></label>
        <label>NCMs (separadas por vírgula)<textarea value={ncms} onChange={e=>setNcms(e.target.value)} /></label></>}
      {step.id==='summary'&&<><p>Confira os cards antes de concluir. As escolhas pertencem à unidade indicada.</p><ul>{steps.slice(0,-1).map((s,i)=><li key={s.id+('unit'in s?s.unit:'')}><button onClick={()=>setIndex(i)}>{s.title}</button> · {choiceFor(data,s.id,'unit'in s?s.unit:undefined)?.status==='CONFIRMED'?'Confirmado':choiceFor(data,s.id,'unit'in s?s.unit:undefined)?.status==='SKIPPED'?'Pulado':'Pendente'}</li>)}</ul></>}
      <footer><button disabled={busy||index===0} onClick={()=>setIndex(index-1)}>Voltar</button><button disabled={busy||step.id==='summary'} onClick={()=>void save(true)}>Pular</button><button disabled={busy} onClick={()=>void save(false)}>{busy?'Salvando…':step.id==='summary'?'Concluir':'Salvar e próximo'}</button></footer>
    </>}
  </Dialog.Content></Dialog.Portal></Dialog.Root>
}
