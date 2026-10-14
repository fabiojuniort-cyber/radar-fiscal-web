import {useEffect,useState} from 'react'
import type {ProductApiFetch} from './product-api'
import {FilterDialog} from './collection-filter-dialog'
import {
  previewDirectCollectionFilterRule,saveDirectCollectionFilterRule,
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

/** Classifying a type NEVER purges already persisted publications. */
export function CollectionFilterDirectDialog({
  apiFetch,initial,onClose,onApplied,
}:{
  apiFetch:ProductApiFetch
  initial:CollectionFilterDirectRuleInput
  onClose:()=>void
  onApplied:()=>Promise<void>
}){
  const [rule,setRule]=useState<Omit<CollectionFilterDirectRuleInput,'mode'> &
    {mode:CollectionFilterMode|''}>({...initial,mode:initial.newTypeId||initial.queueBasis?'':initial.mode})
  const [preview,setPreview]=useState<CollectionFilterDirectPreview|null>(null)
  const [working,setWorking]=useState(false)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{setPreview(null);setError(null)},[rule])

  const showPreview=async()=>{
    if(!rule.mode)return
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
    if(!preview||!rule.mode||working)return
    setWorking(true);setError(null)
    try {
      const result=await saveDirectCollectionFilterRule(apiFetch,{
        ...rule,mode:rule.mode as CollectionFilterMode,
      },preview)
      if(result.deletedCount!==0)throw new Error('A API relatou exclusão inesperada: revisão necessária.')
      await onApplied()
      onClose()
    } catch(e){
      setPreview(null)
      setError(e instanceof Error?e.message:'Falha ao salvar regra. Consulte novamente a prévia.')
    } finally{setWorking(false)}
  }

  return (
    <FilterDialog title="Classificar Nome do ato"
      description="A prévia mostra o impacto da regra F3. Salvar a classificação não apaga publicações existentes; exclusões históricas exigem autorização separada."
      onClose={onClose}>
      <div className="cf-modal-form">
        <label>Fonte
          <select aria-label="Fonte" value={rule.sourceCode}
            onChange={e=>setRule(r=>({...r,sourceCode:e.target.value}))}>
            <option value="dou">DOU</option>
            <option value="doe-sp">DOE-SP</option>
          </select>
        </label>
        <label>Seção
          <input aria-label="Seção" value={rule.section} maxLength={50} required
            onChange={e=>setRule(r=>({...r,section:e.target.value}))}/>
        </label>
        <label>Nome do ato
          <input aria-label="Nome do ato" value={rule.actName??rule.canonicalType} maxLength={300} required
            onChange={e=>setRule(r=>({...r,canonicalType:e.target.value,actName:undefined}))}/>
        </label>
        <label>Modo
          <select aria-label="Modo" value={rule.mode}
            onChange={e=>setRule(r=>({...r,mode:e.target.value as CollectionFilterMode|''}))}>
            <option value="">Selecione o modo</option>
            {MODES.map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {preview&&<div role="status" className="cf-preview-summary">
          <p><strong>{numberBr(preview.count)} publicações históricas correspondem à regra.</strong></p>
          <p>Não serão apagadas ao salvar. Revisão da política: {preview.policyRevision}.</p>
          <p><strong>{numberBr(preview.blockedCompany+preview.blockedOtherSource)} protegidas.</strong></p>
          {preview.blockedCompany>0&&<p>{numberBr(preview.blockedCompany)} com empresa cliente.</p>}
          {preview.blockedOtherSource>0&&<p>{numberBr(preview.blockedOtherSource)} com outra origem oficial.</p>}
          {Boolean(preview.samples?.length)&&<div>
            <p>Nome do ato: {preview.actName||rule.actName||rule.canonicalType}</p><p>Amostras da prévia:</p>
            <ul>{(preview.samples??[]).map(item=><li key={item.id}>
              {item.title} ({item.section}; {item.actName||'Nome do ato não informado'})
              {item.protection? ` — protegida: ${item.protection}`:''}
            </li>)}</ul>
          </div>}
        </div>}
        {error&&<p className="cf-error" role="alert">{error}</p>}
        <div className="cf-row-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button"
            disabled={working||!rule.mode||!rule.section.trim()||!rule.canonicalType.trim()}
            onClick={()=>void (preview?save():showPreview())}>
            {working?'Processando…':preview?'Salvar classificação sem excluir':'Consultar prévia F3'}
          </button>
        </div>
      </div>
    </FilterDialog>
  )
}
