import { useEffect, useState } from 'react'
import type { ProductApiFetch } from './product-api'
import { FilterDialog } from './collection-filter-dialog'
import {
  applyDirectCollectionFilterRule,
  previewDirectCollectionFilterRule,
  type CollectionFilterDirectRuleInput,
  type CollectionFilterDirectPreview,
  type CollectionFilterMode,
} from './collection-filter-api'

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
  const [rule, setRule] = useState<CollectionFilterDirectRuleInput>(initial)
  const [preview, setPreview] = useState<CollectionFilterDirectPreview | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Any change invalidates the previously approved count and identity.
  useEffect(() => { setPreview(null); setError(null) }, [rule])

  const showPreview = async () => {
    setWorking(true)
    setError(null)
    try {
      setPreview(await previewDirectCollectionFilterRule(apiFetch, rule))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o acervo.')
    } finally {
      setWorking(false)
    }
  }

  const confirm = async () => {
    if (!preview) return
    setWorking(true)
    setError(null)
    try {
      const result = await applyDirectCollectionFilterRule(apiFetch, {
        ...rule, expectedCount: preview.count, previewToken: preview.token,
      })
      if (result.changed) {
        // Never apply a stale confirmation; the next click requires a new count.
        setPreview(result.count !== undefined && result.token ? {count:result.count,blockedCompany:result.blockedCompany ?? 0,token:result.token} : null)
        setError('A quantidade mudou para ' + (result.count ?? '—') + '. Confirme novamente.')
        return
      }
      await onApplied()
      onClose()
    } catch (cause) {
      setPreview(null)
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar. Confira a contagem novamente.')
    } finally {
      setWorking(false)
    }
  }

  return (
    <FilterDialog
      title="Classificar tipo de publicação"
      description="A regra será aplicada imediatamente às próximas coletas do DOU. Publicações descartadas serão excluídas somente após confirmação."
      onClose={onClose}
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
            onChange={e => setRule(r => ({ ...r, mode: e.target.value as CollectionFilterMode }))}>
            {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {preview && (
          <p role="status"><strong>{preview.count} publicações serão apagadas.</strong>
            {preview.blockedCompany > 0 && (
              <span> {preview.blockedCompany} possuem vínculo de cliente e não serão excluídas.</span>
            )}
          </p>
        )}
        {error && <p className="cf-error" role="alert">{error}</p>}
        <div className="cf-row-actions">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="button" disabled={working || !rule.section.trim() || !rule.canonicalType.trim()}
            onClick={preview ? confirm : showPreview}>
            {working ? 'Processando…' : preview ? 'Confirmar classificação e exclusão' : 'Consultar quantidade'}
          </button>
        </div>
      </div>
    </FilterDialog>
  )
}
