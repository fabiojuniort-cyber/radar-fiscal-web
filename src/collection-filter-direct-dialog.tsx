import { useEffect, useRef, useState } from 'react'
import type { ProductApiFetch } from './product-api'
import { FilterDialog } from './collection-filter-dialog'
import {
  applyDirectCollectionFilterRule,
  CollectionFilterApiError,
  previewDirectCollectionFilterRule,
  type CollectionFilterDirectRuleInput,
  type CollectionFilterDirectPreview,
  type CollectionFilterMode,
} from './collection-filter-api'

type DirectProgress = { apagadas: number; restantes: number; total: number; etapa: number }

function formatStageError(error: unknown, etapa: number): string {
  if (error instanceof CollectionFilterApiError) {
    return `Etapa ${etapa}: HTTP ${error.status} — ${error.detail ?? error.code}. Use Continuar para recalcular e retomar.`
  }
  return `Etapa ${etapa}: HTTP não disponível (erro de rede) — ${error instanceof Error ? error.message : 'falha desconhecida'}. Use Continuar para recalcular e retomar.`
}

const numberBr = (n: number) => n.toLocaleString('pt-BR')

const MODES: Array<[CollectionFilterMode, string]> = [
  ['KEEP_ALWAYS', 'Manter sempre'],
  ['KEEP_IF_TAX_TERM', 'Manter só se tiver termo tributário'],
  ['EXCLUDE_UNLESS_STRONG', 'Excluir, salvo termo forte'],
  ['EXCLUDE_ALWAYS', 'Excluir sempre'],
]

export function CollectionFilterDirectDialog({
  apiFetch, initial, onClose, onApplied,
}: {
  apiFetch: ProductApiFetch
  initial: CollectionFilterDirectRuleInput
  onClose: () => void
  onApplied: () => Promise<void>
}) {
  const [rule, setRule] = useState<Omit<CollectionFilterDirectRuleInput, 'mode'> & { mode: CollectionFilterMode | '' }>({
    ...initial, mode: initial.newTypeId ? '' : initial.mode,
  })
  const [preview, setPreview] = useState<CollectionFilterDirectPreview | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<DirectProgress | null>(null)
  const [canContinue, setCanContinue] = useState(false)
  const [running, setRunning] = useState(false)
  const [pausing, setPausing] = useState(false)
  const pausedRef = useRef(false)
  const executingRef = useRef(false)
  // Only a failed confirmation may have committed without a response.
  // A failed preview or a changed count must never be treated as deletion.
  const [unacknowledgedCount, setUnacknowledgedCount] = useState<number | null>(null)

  useEffect(() => {
    setPreview(null)
    setError(null)
    setProgress(null)
    setCanContinue(false)
    setUnacknowledgedCount(null)
  }, [rule])

  const showPreview = async () => {
    if (!rule.mode) return
    setWorking(true)
    setError(null)
    try {
      setPreview(await previewDirectCollectionFilterRule(apiFetch, { ...rule, mode: rule.mode as CollectionFilterMode }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o acervo.')
    } finally {
      setWorking(false)
    }
  }

  // A successful response starts the next step, but an error always stops:
  // no automatic HTTP retries, even on a 499 or a lost response.
  const confirm = async (manualContinue = false) => {
    if (executingRef.current || !rule.mode || (!preview && !manualContinue)) return
    executingRef.current = true
    pausedRef.current = false
    setRunning(true)
    setPausing(false)
    setWorking(true)
    setError(null)
    setCanContinue(false)
    let finished = progress?.apagadas ?? 0
    let total = finished + (progress?.restantes ?? preview?.count ?? 0)
    let step = (progress?.etapa ?? 0) + 1
    let isResume = manualContinue || finished > 0
    let stepPreview = preview

    try {
      if (manualContinue) {
        stepPreview = await previewDirectCollectionFilterRule(apiFetch, { ...rule, mode: rule.mode as CollectionFilterMode })
        setPreview(stepPreview)
        // A lost HTTP response can follow a committed batch. Recover only
        // the bounded net reduction seen by the server on the next preview.
        // Never infer deletions from a failed preview or a count-drift pause.
        if (unacknowledgedCount !== null) {
          const reconciled = Math.min(500, Math.max(0, unacknowledgedCount - stepPreview.count))
          finished += reconciled
          if (reconciled > 0) step += 1
          setUnacknowledgedCount(null)
        }
        total = finished + stepPreview.count
        setProgress({apagadas:finished,restantes:stepPreview.count,total,etapa:step-1})
        if (stepPreview.count === 0 && finished > 0) {
          await onApplied()
          onClose()
          return
        }
      }
      if (!stepPreview) return

      while (true) {
        // Pausing never aborts an in-flight confirmation. It stops before
        // any next batch, which must be resumed explicitly after re-preview.
        if (pausedRef.current) {
          setCanContinue(true)
          return
        }
        let response
        try {
          response = await applyDirectCollectionFilterRule(apiFetch, {
            ...rule,
            mode: rule.mode as CollectionFilterMode,
            expectedCount: stepPreview.count,
            previewToken: stepPreview.token,
            resume: isResume,
          })
        } catch (cause) {
          setProgress({ apagadas: finished, restantes: stepPreview.count, total: finished + stepPreview.count, etapa: step - 1 })
          setUnacknowledgedCount(stepPreview.count)
          if (cause instanceof CollectionFilterApiError && cause.code === 'confirmed_rule_not_active') {
            setUnacknowledgedCount(null)
            setCanContinue(false)
            setPreview(stepPreview)
            setError(`Etapa ${step}: HTTP ${cause.status} — a regra não está ativa. Confirme novamente a quantidade exibida.`)
          } else {
            setCanContinue(true)
            setError(formatStageError(cause, step))
          }
          return
        }

        setUnacknowledgedCount(null)
        if (response.changed) {
          const current = response.count ?? 0
          setProgress({apagadas:finished,restantes:current,total:finished+current,etapa:step-1})
          setPreview(response.count !== undefined && response.token
            ? { count: response.count, blockedCompany: response.blockedCompany ?? 0,
                blockedOtherSource: response.blockedOtherSource ?? 0, token: response.token }
            : null)
          setCanContinue(false)
          setError('A quantidade mudou para ' + (response.count ?? '—') + '. Confirme novamente.')
          return
        }

        const removed = response.apagadas ?? response.deletedCount ?? 0
        const left = response.restantes ?? 0
        finished += removed
        total = finished + left
        setProgress({ apagadas: finished, restantes: left, total, etapa: step })

        if (left === 0) {
          await onApplied()
          onClose()
          return
        }
        if (removed === 0) {
          setCanContinue(true)
          setError(`Etapa ${step}: nenhum item foi apagado. Use Continuar para atualizar a contagem.`)
          return
        }

        if (pausedRef.current) {
          setCanContinue(true)
          return
        }

        // The backend calculates every step against the current archive.
        // If the count changed unexpectedly, the user must explicitly resume.
        let nextPreview: CollectionFilterDirectPreview
        try {
          nextPreview = await previewDirectCollectionFilterRule(apiFetch, { ...rule, mode: rule.mode as CollectionFilterMode })
        } catch (cause) {
          setCanContinue(true)
          setError(formatStageError(cause, step + 1))
          return
        }
        if (nextPreview.count !== left) {
          setPreview(nextPreview)
          setProgress({apagadas:finished,restantes:nextPreview.count,
            total:finished+nextPreview.count,etapa:step})
          setCanContinue(true)
          setError(`Etapa ${step + 1}: a contagem passou de ${numberBr(left)} para ${numberBr(nextPreview.count)}. Use Continuar para recalcular e seguir do que falta.`)
          return
        }
        stepPreview = nextPreview
        isResume = true
        step += 1
      }
    } catch (cause) {
      setCanContinue(true)
      setError(formatStageError(cause, step))
    } finally {
      executingRef.current = false
      setWorking(false)
      setRunning(false)
      setPausing(false)
    }
  }

  return (
    <FilterDialog
      title="Classificar tipo de publicação"
      description="A regra será aplicada imediatamente às próximas coletas do DOU. Publicações descartadas serão excluídas somente após confirmação."
      onClose={() => { pausedRef.current = true; onClose() }}
    >
      <div className="cf-modal-form">
        <label>Fonte
          <select aria-label="Fonte" value={rule.sourceCode}
            onChange={e => setRule(r => ({ ...r, sourceCode: e.target.value }))}>
            <option value="dou">DOU</option>
          </select>
        </label>
        <label>Seção
          <input aria-label="Seção" value={rule.section} maxLength={50} required
            onChange={e => setRule(r => ({ ...r, section: e.target.value }))}/>
        </label>
        <label>Tipo
          <input aria-label="Tipo" value={rule.canonicalType} maxLength={300} required
            onChange={e => setRule(r => ({ ...r, canonicalType: e.target.value }))}/>
        </label>
        <label>Modo
          <select aria-label="Modo" value={rule.mode}
            onChange={e => setRule(r => ({ ...r, mode: e.target.value as CollectionFilterMode | '' }))}>
            <option value="">Selecione o modo</option>
            {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {preview && (
          <div role="status" className="cf-preview-summary">
            <p><strong>{preview.count} publicações serão apagadas.</strong></p>
            <p><strong>{preview.blockedCompany + (preview.blockedOtherSource ?? 0)} protegidas (não serão apagadas).</strong></p>
            {preview.blockedCompany > 0 && (
              <p>Motivo: {preview.blockedCompany} com vínculo a empresa cliente.</p>
            )}
            {preview.blockedOtherSource > 0 && (
              <p>Motivo: {preview.blockedOtherSource} também possuem origem em outra fonte oficial.</p>
            )}
          </div>
        )}
        {progress && (progress.apagadas > 0 || progress.etapa > 0) && (
          <p role="status" aria-live="polite">{numberBr(progress.apagadas)} de {numberBr(progress.total)} apagadas</p>
        )}
        {error && <p className="cf-error" role="alert">{error}</p>}
        <div className="cf-row-actions">
          <button type="button" onClick={() => { pausedRef.current = true; onClose() }}>Cancelar</button>
          {running && <button type="button" disabled={pausing}
            onClick={() => { pausedRef.current = true; setPausing(true) }}>
            {pausing ? 'Pausando…' : 'Pausar'}
          </button>}
          <button type="button" disabled={working || running || !rule.mode || !rule.section.trim() || !rule.canonicalType.trim()}
            onClick={canContinue ? () => void confirm(true) : preview ? () => void confirm() : showPreview}>
            {working || running ? 'Processando…' : canContinue ? 'Continuar'
              : preview ? 'Confirmar classificação e exclusão' : 'Consultar quantidade'}
          </button>
        </div>
      </div>
    </FilterDialog>
  )
}
