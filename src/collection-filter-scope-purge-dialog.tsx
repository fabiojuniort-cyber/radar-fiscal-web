import { useRef, useState } from 'react'
import type { ProductApiFetch } from './product-api'
import { FilterDialog } from './collection-filter-dialog'
import {
  CollectionFilterApiError,
  confirmOutOfScopePublications,
  previewOutOfScopePublications,
  type CollectionFilterDirectPreview,
} from './collection-filter-api'

const numberBr = (value: number) => value.toLocaleString('pt-BR')

function stageError(cause: unknown, step: number): string {
  const detail = cause instanceof CollectionFilterApiError
    ? 'HTTP ' + cause.status + ' — ' + (cause.detail ?? cause.code)
    : 'HTTP não disponível (erro de rede) — ' +
      (cause instanceof Error ? cause.message : 'falha desconhecida')
  return 'Etapa ' + step + ': ' + detail + '. Use Continuar para recalcular e retomar.'
}

export function CollectionFilterScopePurgeDialog({apiFetch,onClose,onApplied}:{
  apiFetch:ProductApiFetch;onClose:()=>void;onApplied:()=>Promise<void>
}) {
  const [preview,setPreview]=useState<CollectionFilterDirectPreview|null>(null)
  const [working,setWorking]=useState(false)
  const [running,setRunning]=useState(false)
  const [pausing,setPausing]=useState(false)
  const [error,setError]=useState('')
  const [completed,setCompleted]=useState(0)
  const [total,setTotal]=useState(0)
  const [stage,setStage]=useState(0)
  const [waitingContinue,setWaitingContinue]=useState(false)
  const [unacknowledgedCount,setUnacknowledgedCount]=useState<number|null>(null)
  const pausedRef=useRef(false)
  const executingRef=useRef(false)

  const close=()=>{
    pausedRef.current=true
    onClose()
  }

  const consult=async()=>{
    if(executingRef.current||working)return
    setWorking(true);setError('')
    try {
      const next=await previewOutOfScopePublications(apiFetch)
      setPreview(next);setWaitingContinue(false)
      setTotal(completed+next.count)
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Falha ao consultar a prévia.')
    } finally{setWorking(false)}
  }

  const confirm=async(manualContinue=false)=>{
    if(executingRef.current||(!preview&&!manualContinue))return
    executingRef.current=true
    pausedRef.current=false
    setRunning(true);setPausing(false);setWorking(true);setError('')
    setWaitingContinue(false)
    let finished=completed
    let step=stage+1
    let fresh=preview
    try {
      if(manualContinue){
        try {
          fresh=await previewOutOfScopePublications(apiFetch)
        } catch(cause){
          setWaitingContinue(true)
          setError(stageError(cause,step))
          return
        }
        if(unacknowledgedCount!==null){
          // A confirmation may have committed even when its response was lost.
          // Reconcile at most one 500-item batch, only after an explicit Continue.
          const reconciled=Math.min(500,Math.max(0,unacknowledgedCount-fresh.count))
          finished+=reconciled
          if(reconciled>0)step+=1
          setCompleted(finished)
          setStage(step-1)
          setUnacknowledgedCount(null)
        }
        setPreview(fresh)
        setTotal(finished+fresh.count)
      }
      if(!fresh)return
      if(fresh.count===0){await onApplied();close();return}
      while(true){
        if(pausedRef.current){
          setPreview(fresh)
          setWaitingContinue(true)
          return
        }
        let result
        try {
          result=await confirmOutOfScopePublications(apiFetch,{
            expectedCount:fresh.count,previewToken:fresh.token,
          })
        } catch(cause){
          // No automatic retry after an ambiguous HTTP failure.
          setUnacknowledgedCount(fresh.count)
          setWaitingContinue(true)
          setError(stageError(cause,step))
          return
        }
        setUnacknowledgedCount(null)
        if(result.changed){
          const newCount=result.count??0
          setPreview(result.token?{
            count:newCount,token:result.token,
            outOfScope:result.outOfScope??0,
            hiddenLegacy:result.hiddenLegacy??0,
            suspectDoe:result.suspectDoe??0,
            ruleDiscards:result.ruleDiscards??0,byRule:result.byRule??[],
            blockedCompany:result.blockedCompany??0,
            blockedOtherSource:result.blockedOtherSource??0,
          }:null)
          setTotal(finished+newCount)
          setWaitingContinue(false)
          setError('Etapa '+step+': a quantidade ou as proteções mudaram. Confirme a nova prévia.')
          return
        }
        const removed=result.apagadas??result.deletedCount??0
        const left=result.restantes
        finished+=removed
        setCompleted(finished);setTotal(finished+left);setStage(step)
        if(left===0){await onApplied();close();return}
        if(removed===0){
          setWaitingContinue(true)
          setError('Etapa '+step+': nenhuma publicação foi apagada. Use Continuar para recalcular.')
          return
        }
        if(pausedRef.current){
          setWaitingContinue(true)
          return
        }
        let next:CollectionFilterDirectPreview
        try {
          next=await previewOutOfScopePublications(apiFetch)
        } catch(cause){
          setWaitingContinue(true)
          setError(stageError(cause,step+1))
          return
        }
        setPreview(next)
        if(next.count!==left){
          setTotal(finished+next.count)
          setWaitingContinue(true)
          setError('Etapa '+(step+1)+': a contagem passou de '+numberBr(left)+
            ' para '+numberBr(next.count)+'. Use Continuar para recalcular e retomar.')
          return
        }
        fresh=next
        step+=1
      }
    } finally {
      executingRef.current=false
      setWorking(false);setRunning(false);setPausing(false)
    }
  }

  return <FilterDialog title="Reaplicar filtro ao acervo"
    description="Reaplica ao acervo o mesmo filtro da coleta. Consulte a prévia antes de confirmar; publicações vinculadas a clientes ou com outra origem oficial são preservadas."
    onClose={close}>
    <div className="cf-modal-form">
      {preview&&<div className="cf-preview-summary" role="status">
        <p><strong>{numberBr(preview.count)} não passam no filtro atual / {numberBr(preview.blockedCompany+preview.blockedOtherSource)} protegidas</strong></p>
        {(preview.byRule??[]).length>0&&<ul aria-label="Quantidades por tipo">
          {(preview.byRule??[]).map((r,i)=><li key={i}>{r.sourceCode ? r.sourceCode+' / ' : ''}{r.section} / {r.canonicalType}: {numberBr(r.count)}</li>)}
        </ul>}
        {(preview.samples??[]).length>0&&<ul aria-label="Amostras por tipo">
          {(preview.samples??[]).map(sample=><li key={sample.id}>
            {sample.canonicalType??sample.officialType??'Tipo não informado'}: {sample.title}
          </li>)}
        </ul>}
        {preview.blockedCompany>0&&<p>{numberBr(preview.blockedCompany)} vinculadas a clientes</p>}
        {preview.blockedOtherSource>0&&<p>{numberBr(preview.blockedOtherSource)} com outra origem oficial</p>}
      </div>}
      {stage>0&&<p role="status" aria-live="polite">
        {numberBr(completed)} de {numberBr(total)} apagadas · etapa {stage} · lotes de até 500
      </p>}
      {error&&<p className="cf-error" role="alert">{error}</p>}
      <div className="cf-row-actions">
        <button type="button" onClick={close}>Cancelar</button>
        {running&&<button type="button" disabled={pausing}
          onClick={()=>{pausedRef.current=true;setPausing(true)}}>
          {pausing?'Pausando…':'Pausar'}
        </button>}
        <button type="button" disabled={working||running}
          onClick={()=>void (waitingContinue?confirm(true):!preview?consult():confirm())}>
          {working||running?'Processando…':waitingContinue?'Continuar':
            !preview?'Consultar quantidade':'Confirmar exclusão'}
        </button>
      </div>
    </div>
  </FilterDialog>
}

