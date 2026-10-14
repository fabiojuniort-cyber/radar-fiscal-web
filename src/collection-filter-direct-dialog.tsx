import {useEffect,useRef,useState} from 'react'
import type {ProductApiFetch} from './product-api'
import {FilterDialog} from './collection-filter-dialog'
import {
  previewDirectCollectionFilterRule,saveDirectCollectionFilterRule,applyDirectCollectionFilterRule,
  type CollectionFilterDirectRuleInput,type CollectionFilterDirectPreview,
  type CollectionFilterMode,
} from './collection-filter-api'

const numberBr=(n:number)=>n.toLocaleString('pt-BR')
const MODES:Array<[CollectionFilterMode,string]>=[
  ['KEEP_ALWAYS','Manter sempre'],
  ['KEEP_IF_TAX_TERM','Manter só se tiver termo tributário'],
  ['EXCLUDE_UNLESS_STRONG','Excluir, salvo termo forte'],
  ['EXCLUDE_ALWAYS','Excluir sempre'],
]

/** Exclusion modes save the rule and purge eligible history on confirmation. */
export function CollectionFilterDirectDialog({
  apiFetch,initial,onClose,onApplied,
}:{
  apiFetch:ProductApiFetch
  initial:CollectionFilterDirectRuleInput
  onClose:()=>void
  onApplied:()=>Promise<void>
}){
  const [rule,setRule]=useState<Omit<CollectionFilterDirectRuleInput,'mode'> &
    {mode:CollectionFilterMode|''}>({...initial,mode:initial.newTypeId?'':initial.mode})
  const [preview,setPreview]=useState<CollectionFilterDirectPreview|null>(null)
  const [working,setWorking]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [deleted,setDeleted]=useState(0)
  const executing=useRef(false)
  const stopped=useRef(false)
  const saved=useRef(false)
  const excludes=rule.mode==='EXCLUDE_ALWAYS'||rule.mode==='EXCLUDE_UNLESS_STRONG'
  const close=()=>{stopped.current=true;onClose()}
  useEffect(()=>{stopped.current=false;return ()=>{stopped.current=true}},[])

  useEffect(()=>{setPreview(null);setError(null)},[rule])

  const showPreview=async()=>{
    if(!rule.mode||executing.current)return
    setWorking(true);setError(null)
    try {
      const result=await previewDirectCollectionFilterRule(apiFetch,{
        ...rule,mode:rule.mode as CollectionFilterMode,
      })
      if(!result.confirmationToken || !Number.isInteger(result.policyRevision))
        throw new Error('A API não oferece a prévia F3 segura; atualização necessária.')
      setPreview(result)
    } catch(e){setPreview(null);setError(e instanceof Error?e.message:'Falha ao consultar prévia F3.')}
    finally{setWorking(false)}
  }

  const save=async()=>{
    if(!preview||!rule.mode||working||executing.current)return
    executing.current=true
    setWorking(true);setError(null)
    try {
      if(excludes){
        let fresh=preview
        let removed=deleted
        for(let step=0;step<1000;step++){
          if(stopped.current)return
          if(!fresh.confirmationToken||!Number.isInteger(fresh.policyRevision))
            throw new Error('Prévia segura indisponível. Consulte novamente.')
          const result=await applyDirectCollectionFilterRule(apiFetch,{
            ...rule,mode:rule.mode as CollectionFilterMode,
            expectedCount:fresh.count,previewToken:fresh.token,
            confirmationToken:fresh.confirmationToken,policyRevision:fresh.policyRevision!,
            resume:saved.current,
          })
          if(result.changed)throw new Error('A prévia mudou. Consulte e confirme novamente.')
          saved.current=true
          removed+=result.deletedCount
          setDeleted(removed)
          if(result.restantes===0){await onApplied();close();return}
          if(result.deletedCount===0)throw new Error('Exclusão interrompida sem progresso. Consulte novamente.')
          if(stopped.current)return
          const next=await previewDirectCollectionFilterRule(apiFetch,{
            ...rule,mode:rule.mode as CollectionFilterMode,
          })
          if(next.count!==result.restantes||next.policyRevision!==result.revision)
            throw new Error('A quantidade ou a política mudou. Consulte e confirme novamente.')
          fresh=next
          setPreview(next)
        }
        throw new Error('Limite de etapas atingido. Consulte novamente para continuar.')
      }
      const result=await saveDirectCollectionFilterRule(apiFetch,{
        ...rule,mode:rule.mode as CollectionFilterMode,
      },preview)
      if(result.deletedCount!==0)throw new Error('A API relatou exclusão inesperada: revisão necessária.')
      await onApplied()
      close()
    } catch(e){
      setPreview(null)
      setError(e instanceof Error?e.message:'Falha ao salvar regra. Consulte novamente a prévia.')
    } finally{executing.current=false;setWorking(false)}
  }

  return (
    <FilterDialog title="Classificar tipo de publicação"
      description="Ao salvar um modo Excluir, os documentos elegíveis também serão apagados. Vínculos com clientes, matches e outras origens permanecem protegidos."
      onClose={close}>
      <div className="cf-modal-form">
        <fieldset disabled={working||saved.current} style={{border:0,padding:0,margin:0}}>
        <label>Fonte
          <select aria-label="Fonte" value={rule.sourceCode}
            onChange={e=>setRule(r=>({...r,sourceCode:e.target.value}))}>
            <option value="dou">DOU</option>
          </select>
        </label>
        <label>Seção
          <input aria-label="Seção" value={rule.section} maxLength={50} required
            onChange={e=>setRule(r=>({...r,section:e.target.value}))}/>
        </label>
        <label>Tipo
          <input aria-label="Tipo" value={rule.canonicalType} maxLength={300} required
            onChange={e=>setRule(r=>({...r,canonicalType:e.target.value}))}/>
        </label>
        <label>Modo
          <select aria-label="Modo" value={rule.mode}
            onChange={e=>setRule(r=>({...r,mode:e.target.value as CollectionFilterMode|''}))}>
            <option value="">Selecione o modo</option>
            {MODES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        </fieldset>
        {preview&&<div role="status" className="cf-preview-summary">
          <p><strong>{numberBr(preview.count)} publicações {excludes?'serão apagadas ao salvar':'históricas correspondem à regra'}.</strong></p>
          <p>{excludes?'A exclusão será física e processada em lotes.':'Nenhuma publicação será apagada ao salvar.'} Revisão da política: {preview.policyRevision}.</p>
          <p><strong>{numberBr(preview.blockedCompany+preview.blockedOtherSource)} protegidas.</strong></p>
          {preview.blockedCompany>0&&<p>{numberBr(preview.blockedCompany)} com empresa cliente.</p>}
          {preview.blockedOtherSource>0&&<p>{numberBr(preview.blockedOtherSource)} com outra origem oficial.</p>}
          {Boolean(preview.samples?.length)&&<div>
            <p>Amostras da prévia:</p>
            <ul>{(preview.samples??[]).map(item=><li key={item.id}>
              {item.title} ({item.section}; {item.officialType||'tipo oficial não informado'})
              {item.protection? ` — protegida: ${item.protection}`:''}
            </li>)}</ul>
          </div>}
        </div>}
        {deleted>0&&<p role="status">{numberBr(deleted)} publicações apagadas.</p>}
        {error&&<p className="cf-error" role="alert">{error}</p>}
        <div className="cf-row-actions">
          <button type="button" onClick={close}>{working?'Parar após o lote atual':'Cancelar'}</button>
          <button type="button"
            disabled={working||!rule.mode||!rule.section.trim()||!rule.canonicalType.trim()}
            onClick={()=>void (preview?save():showPreview())}>
            {working?'Processando…':preview?excludes?`Salvar e excluir ${numberBr(preview.count)} publicações`:'Salvar classificação sem excluir':'Consultar prévia F3'}
          </button>
        </div>
      </div>
    </FilterDialog>
  )
}

