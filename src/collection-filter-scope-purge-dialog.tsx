import { useState } from 'react'
import type { ProductApiFetch } from './product-api'
import { FilterDialog } from './collection-filter-dialog'
import {
  CollectionFilterApiError,
  confirmOutOfScopePublications,
  previewOutOfScopePublications,
  type CollectionFilterDirectPreview,
} from './collection-filter-api'

const numberBr = (value: number) => value.toLocaleString('pt-BR')

export function CollectionFilterScopePurgeDialog({apiFetch,onClose,onApplied}:{
  apiFetch:ProductApiFetch;onClose:()=>void;onApplied:()=>Promise<void>
}) {
  const [preview,setPreview]=useState<CollectionFilterDirectPreview|null>(null)
  const [working,setWorking]=useState(false)
  const [error,setError]=useState('')
  const [completed,setCompleted]=useState(0)
  const [stage,setStage]=useState(0)
  const [waitingContinue,setWaitingContinue]=useState(false)

  const consult=async()=>{
    setWorking(true);setError('')
    try {
      const next=await previewOutOfScopePublications(apiFetch)
      setPreview(next);setWaitingContinue(false)
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Falha ao consultar a prévia.')
    } finally{setWorking(false)}
  }

  const confirm=async()=>{
    if(!preview||working)return
    setWorking(true);setError('')
    try {
      // Every click deletes at most 500; no automatic loop or HTTP retry.
      // On continuation always refresh eligibility, including cross-source
      // and company protections, before sending a new confirmation token.
      let fresh=preview
      if(waitingContinue) {
        fresh=await previewOutOfScopePublications(apiFetch)
        setPreview(fresh)
        if(fresh.count!==preview.count||fresh.token!==preview.token) {
          setWaitingContinue(false)
          setError('A prévia mudou. Confira as novas quantidades antes de confirmar.')
          return
        }
      }
      if(fresh.count===0) {await onApplied();onClose();return}
      const result=await confirmOutOfScopePublications(apiFetch,{
        expectedCount:fresh.count,previewToken:fresh.token,
      })
      if(result.changed){
        setPreview({count:result.count??0,token:result.token??'',
          outOfScope:result.outOfScope??0,
          hiddenLegacy:result.hiddenLegacy??0,
          ruleDiscards:result.ruleDiscards??0,byRule:result.byRule??[],
          blockedCompany:result.blockedCompany??0,
          blockedOtherSource:result.blockedOtherSource??0})
        setWaitingContinue(false)
        setError('A quantidade ou as proteções mudaram. Confirme a nova prévia.')
        return
      }
      const nextCompleted=completed+result.apagadas
      setCompleted(nextCompleted);setStage(s=>s+1)
      if(result.restantes===0){await onApplied();onClose();return}
      setPreview({ ...fresh, count:result.restantes })
      // Token changed after a successful batch. Require manual continuation:
      // next click re-fetches; token comparison below would fail, so fetch a
      // fresh preview immediately (read only), never trigger a second purge.
      const latest=await previewOutOfScopePublications(apiFetch)
      setPreview(latest)
      setWaitingContinue(true)
      if(latest.count!==result.restantes) {
        setWaitingContinue(false)
        setError('A contagem mudou durante a execução. Revise a nova prévia.')
      } else if(result.apagadas===0){
        setError('Nenhuma publicação foi apagada. Revise a prévia.')
        setWaitingContinue(false)
      }
    } catch(cause){
      // On HTTP failure, the commit may be ambiguous. Never resubmit a
      // confirmation automatically. An explicit re-preview is mandatory.
      const detail=cause instanceof CollectionFilterApiError
        ? 'HTTP '+cause.status+' — '+cause.code
        : cause instanceof Error?cause.message:'erro de rede'
      setError('Etapa interrompida: '+detail+'. Consulte novamente antes de continuar.')
      setWaitingContinue(false)
      setPreview(null)
    } finally{setWorking(false)}
  }

  return <FilterDialog title="Apagar fora do escopo"
    description="Publicações DOU fora do escopo, descartadas pelo motor tributário ou ocultas pela regra antiga. Vínculos com clientes e outras fontes serão protegidos."
    onClose={onClose}>
    <div className="cf-modal-form">
      {preview&&<div className="cf-preview-summary" role="status">
        <p><strong>{numberBr(preview.outOfScope??0)} fora do escopo + {numberBr(preview.ruleDiscards??0)} pelas regras + {numberBr(preview.hiddenLegacy??0)} ocultas pela regra antiga / {numberBr(preview.blockedCompany+preview.blockedOtherSource)} protegidas</strong></p>
        {(preview.byRule??[]).length>0&&<ul aria-label="Quantidades por regra">
          {(preview.byRule??[]).map((r,i)=><li key={i}>{r.section} / {r.canonicalType} / {r.mode}: {numberBr(r.count)}</li>)}
        </ul>}
        {preview.blockedCompany>0&&<p>{numberBr(preview.blockedCompany)} vinculadas a clientes</p>}
        {preview.blockedOtherSource>0&&<p>{numberBr(preview.blockedOtherSource)} com outra origem oficial</p>}
      </div>}
      {stage>0&&<p role="status" aria-live="polite">
        {numberBr(completed)} apagadas confirmadas · etapa {stage} · lotes de até 500
      </p>}
      {error&&<p className="cf-error" role="alert">{error}</p>}
      <div className="cf-row-actions">
        <button type="button" onClick={onClose}>Cancelar</button>
        <button type="button" disabled={working}
          onClick={()=>void (!preview?consult():confirm())}>
          {working?'Processando…':!preview?'Consultar quantidade':
            waitingContinue?'Continuar':'Confirmar exclusão'}
        </button>
      </div>
    </div>
  </FilterDialog>
}
