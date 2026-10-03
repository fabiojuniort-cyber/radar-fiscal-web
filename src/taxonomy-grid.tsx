import { ArrowDown, ArrowUp, ArrowUpDown, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import type { ProductApiFetch } from './product-api'
import {
  ALIAS_TYPE_LABELS,
  OFFICIAL_CODE_TYPE_LABELS,
  TaxonomyApiError,
  formatOfficialCode,
  saveDimensionRows,
  type AliasType,
  type CurationConcept,
  type CurationDimension,
  type CurationGroup,
  type GridRowInput,
} from './taxonomy-api'

/**
 * Spreadsheet-like editor (SAP ALV style): edit cells in place, insert and
 * delete rows, sort and filter by column, save every change at once.
 */

type Alias = { text: string; aliasType: AliasType }

type RowDraft = {
  key: string
  code: string | null
  group: string
  label: string
  codes: string
  aliases: Alias[]
  profileVisible: boolean
  classifyByLabel: boolean
  displayOrder: string
}

type ColumnKey = 'group' | 'label' | 'codes' | 'aliases' | 'profileVisible' | 'classifyByLabel' | 'displayOrder' | 'code'

// Types that mark legislações automatically; the others only help search.
const CLASSIFYING_ALIAS_TYPES: AliasType[] = ['EXACT_LEXICAL', 'ABBREVIATION']

const ALIAS_TAGS: Partial<Record<AliasType, string>> = {
  ABBREVIATION: 'sigla',
  HISTORICAL_LABEL: 'nome antigo',
  SEARCH_RELATED: 'só busca',
  AMBIGUOUS: 'ambíguo',
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function draftFrom(concept: CurationConcept, dimension: CurationDimension, groupLabel: string): RowDraft {
  return {
    key: concept.code,
    code: concept.code,
    group: groupLabel,
    label: concept.label,
    codes: concept.officialCodes.map((code) => formatOfficialCode(dimension.officialCodeType, code)).join(', '),
    aliases: concept.aliases,
    profileVisible: concept.profileVisible,
    classifyByLabel: concept.classifyByLabel,
    displayOrder: concept.displayOrder === null ? '' : String(concept.displayOrder),
  }
}

function sameDraft(left: RowDraft, right: RowDraft): boolean {
  return JSON.stringify({ ...left, key: '' }) === JSON.stringify({ ...right, key: '' })
}

function errorText(error: unknown): string {
  if (error instanceof TaxonomyApiError) return error.detail || `Erro: ${error.code}`
  return error instanceof Error ? error.message : 'Erro inesperado.'
}

function cellText(row: RowDraft, column: ColumnKey): string {
  switch (column) {
    case 'aliases':
      return row.aliases.map((alias) => alias.text).join(' ')
    case 'profileVisible':
      return row.profileVisible ? 'x' : ''
    case 'classifyByLabel':
      return row.classifyByLabel ? 'x' : ''
    case 'code':
      return row.code ?? ''
    default:
      return row[column]
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
}

let newRowCounter = 0

export function CurationGrid({
  apiFetch,
  dimension,
  concepts,
  groups,
  editable,
  justification,
  showRetired,
  query,
  onChanged,
  onOpenDetail,
  onDirtyChange,
}: {
  apiFetch: ProductApiFetch
  dimension: CurationDimension
  concepts: CurationConcept[]
  groups: CurationGroup[]
  editable: boolean
  justification: string
  showRetired: boolean
  query: string
  onChanged: () => Promise<void>
  onOpenDetail: (concept: CurationConcept) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const groupLabel = useMemo(() => new Map(groups.map((group) => [group.id, group.label])), [groups])
  const groupOrder = useMemo(() => new Map(groups.map((group) => [group.label, group.displayOrder])), [groups])
  const conceptByCode = useMemo(() => new Map(concepts.map((concept) => [concept.code, concept])), [concepts])

  const [edits, setEdits] = useState<Record<string, RowDraft>>({})
  const [newRows, setNewRows] = useState<RowDraft[]>([])
  const [retire, setRetire] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ column: ColumnKey; direction: 1 | -1 } | null>(null)
  const [filters, setFilters] = useState<Partial<Record<ColumnKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  const baseRows = useMemo(
    () =>
      concepts
        .filter((concept) => showRetired || concept.membershipStatus === 'INCLUDED')
        .map((concept) => draftFrom(concept, dimension, groupLabel.get(concept.groupId ?? '') ?? '')),
    [concepts, dimension, groupLabel, showRetired],
  )
  const baseByKey = useMemo(() => new Map(baseRows.map((row) => [row.key, row])), [baseRows])

  const editedKeys = Object.keys(edits).filter((key) => {
    const base = baseByKey.get(key)
    return base && !sameDraft(base, edits[key]!)
  })
  const pending = editedKeys.length + newRows.length + retire.size
  const dirty = pending > 0

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const columns: Array<{ key: ColumnKey; label: string; className?: string }> = [
    ...(dimension.usesGroups ? [{ key: 'group' as const, label: 'Grupo', className: 'is-group' }] : []),
    { key: 'label', label: 'Item', className: 'is-label' },
    {
      key: 'codes',
      label: dimension.officialCodeType ? OFFICIAL_CODE_TYPE_LABELS[dimension.officialCodeType] : 'Código oficial',
      className: 'is-codes',
    },
    { key: 'aliases', label: 'Sinônimos', className: 'is-synonyms' },
    { key: 'profileVisible', label: 'No perfil', className: 'is-narrow' },
    { key: 'classifyByLabel', label: 'Classificar pelo nome', className: 'is-narrow' },
    { key: 'displayOrder', label: 'Ordem', className: 'is-narrow' },
    { key: 'code', label: 'Código TriBusca' },
  ]

  const normalizedQuery = normalize(query.trim())
  const visibleRows = useMemo(() => {
    const current = baseRows.map((row) => edits[row.key] ?? row)
    const filtered = current.filter((row) => {
      if (
        normalizedQuery &&
        ![row.label, row.codes, row.group, row.code ?? '', ...row.aliases.map((alias) => alias.text)].some((value) =>
          normalize(value).includes(normalizedQuery),
        )
      ) {
        return false
      }
      return Object.entries(filters).every(([column, value]) => {
        const needle = normalize((value ?? '').trim())
        return !needle || normalize(cellText(row, column as ColumnKey)).includes(needle)
      })
    })
    const sorted = [...filtered].sort((left, right) => {
      if (sort) {
        const a = cellText(left, sort.column)
        const b = cellText(right, sort.column)
        const numeric = sort.column === 'displayOrder'
        const result = numeric
          ? (Number(a || 99999) - Number(b || 99999))
          : a.localeCompare(b, 'pt-BR', { numeric: true })
        if (result !== 0) return result * sort.direction
      }
      return (
        (groupOrder.get(left.group) ?? 99999) - (groupOrder.get(right.group) ?? 99999) ||
        (left.group || '~').localeCompare(right.group || '~', 'pt-BR') ||
        Number(left.displayOrder || 99999) - Number(right.displayOrder || 99999) ||
        left.label.localeCompare(right.label, 'pt-BR')
      )
    })
    return [...newRows, ...sorted]
  }, [baseRows, edits, filters, groupOrder, newRows, normalizedQuery, sort])

  const updateRow = (row: RowDraft, patch: Partial<RowDraft>) => {
    setMessage(null)
    if (row.code === null) {
      setNewRows((rows) => rows.map((item) => (item.key === row.key ? { ...item, ...patch } : item)))
    } else {
      setEdits((current) => ({ ...current, [row.key]: { ...(current[row.key] ?? row), ...patch } }))
    }
  }

  const insertRow = () => {
    newRowCounter += 1
    const row: RowDraft = {
      key: `new-${newRowCounter}`,
      code: null,
      group: '',
      label: '',
      codes: '',
      aliases: [],
      profileVisible: true,
      classifyByLabel: true,
      displayOrder: '',
    }
    setNewRows((rows) => [row, ...rows])
    setMessage(null)
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-cell="${row.key}:label"]`)?.focus()
    }, 0)
  }

  const deleteSelected = () => {
    setNewRows((rows) => rows.filter((row) => !selected.has(row.key)))
    setRetire((current) => {
      const next = new Set(current)
      for (const key of selected) {
        const concept = conceptByCode.get(key)
        if (concept && concept.membershipStatus === 'INCLUDED') next.add(key)
      }
      return next
    })
    setSelected(new Set())
    setMessage(null)
  }

  const undoAll = () => {
    setEdits({})
    setNewRows([])
    setRetire(new Set())
    setSelected(new Set())
    setMessage(null)
  }

  const save = async () => {
    const toInput = (row: RowDraft): GridRowInput => {
      return {
        code: row.code,
        ...(dimension.usesGroups ? { group: row.group.trim() || null } : {}),
        label: row.label.trim(),
        officialCodes: splitList(row.codes),
        aliases: row.aliases,
        profileVisible: row.profileVisible,
        classifyByLabel: row.classifyByLabel,
        displayOrder: row.displayOrder === '' ? null : Number(row.displayOrder),
      }
    }
    const rows = [
      ...newRows.filter((row) => row.label.trim() || row.codes.trim() || row.aliases.length).map(toInput),
      ...editedKeys.filter((key) => !retire.has(key)).map((key) => toInput(edits[key]!)),
    ]
    setSaving(true)
    setMessage(null)
    try {
      const result = await saveDimensionRows(apiFetch, dimension.code, justification, {
        rows,
        retire: [...retire],
      })
      setEdits({})
      setNewRows([])
      setRetire(new Set())
      setSelected(new Set())
      await onChanged()
      setMessage({
        kind: 'ok',
        text:
          `Salvo no rascunho: ${result.created.length} novos · ${result.updated} alterados · ${result.retired} excluídos` +
          (result.groupsCreated ? ` · ${result.groupsCreated} grupos novos` : ''),
      })
    } catch (error) {
      setMessage({ kind: 'error', text: `Nada foi salvo. ${errorText(error)}` })
    } finally {
      setSaving(false)
    }
  }

  const toggleSort = (column: ColumnKey) => {
    setSort((current) =>
      !current || current.column !== column
        ? { column, direction: 1 }
        : current.direction === 1
          ? { column, direction: -1 }
          : null,
    )
  }

  // Enter / ↑ / ↓ move to the same column in the next or previous row.
  const moveFocus = (event: KeyboardEvent<HTMLInputElement>, rowIndex: number, column: ColumnKey) => {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' || event.key === 'Enter' ? 1 : 0
    if (!step) return
    const target = visibleRows[rowIndex + step]
    if (!target) return
    event.preventDefault()
    document.querySelector<HTMLInputElement>(`[data-cell="${target.key}:${column}"]`)?.focus()
  }

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.key))
  const groupOptions = groups.map((group) => group.label).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const datalistId = `tc-groups-${dimension.code}`

  return (
    <div className="tc-grid-block">
      {editable && (
        <div className="tc-grid-toolbar" role="toolbar" aria-label="Edição da tabela">
          <button type="button" onClick={insertRow}>
            <Plus size={14} /> Inserir linha
          </button>
          <button type="button" disabled={selected.size === 0} onClick={deleteSelected}>
            <Trash2 size={14} /> Excluir selecionadas{selected.size ? ` (${selected.size})` : ''}
          </button>
          <button type="button" disabled={!dirty || saving} onClick={undoAll}>
            <RotateCcw size={14} /> Desfazer alterações
          </button>
          <span className="tc-spacer" />
          {dirty && (
            <span className="tc-grid-pending">
              {newRows.length} novas · {editedKeys.length} alteradas · {retire.size} a excluir
            </span>
          )}
          <button type="button" className="is-primary" disabled={!dirty || saving} onClick={() => void save()}>
            <Save size={14} /> {saving ? 'Salvando…' : `Salvar alterações${dirty ? ` (${pending})` : ''}`}
          </button>
        </div>
      )}
      {message && (
        <p className={message.kind === 'ok' ? 'tc-ok tc-grid-message' : 'tc-error tc-grid-message'} role="status">
          {message.text}
        </p>
      )}

      <div className="tc-grid-wrap">
        <table className="tc-grid" aria-label={`Itens de ${dimension.name}`}>
          <thead>
            <tr>
              <th className="is-select">
                {editable && (
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as linhas visíveis"
                    checked={allVisibleSelected}
                    onChange={(event) =>
                      setSelected(event.target.checked ? new Set(visibleRows.map((row) => row.key)) : new Set())
                    }
                  />
                )}
              </th>
              {columns.map((column) => (
                <th key={column.key} className={column.className} scope="col">
                  <button type="button" className="tc-grid-sort" onClick={() => toggleSort(column.key)}>
                    {column.label}
                    {sort?.column === column.key ? (
                      sort.direction === 1 ? (
                        <ArrowUp size={12} aria-label="crescente" />
                      ) : (
                        <ArrowDown size={12} aria-label="decrescente" />
                      )
                    ) : (
                      <ArrowUpDown size={12} aria-hidden="true" className="tc-grid-sort-idle" />
                    )}
                  </button>
                </th>
              ))}
              <th className="is-actions" />
            </tr>
            <tr className="tc-grid-filters">
              <th className="is-select" />
              {columns.map((column) => (
                <th key={column.key} className={column.className}>
                  <input
                    aria-label={`Filtrar ${column.label}`}
                    placeholder="filtrar"
                    value={filters[column.key] ?? ''}
                    onChange={(event) => setFilters({ ...filters, [column.key]: event.target.value })}
                  />
                </th>
              ))}
              <th className="is-actions" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, rowIndex) => {
              const concept = row.code ? conceptByCode.get(row.code) : undefined
              const retired = concept ? concept.membershipStatus !== 'INCLUDED' : false
              const toRetire = row.code !== null && retire.has(row.code)
              const isNew = row.code === null
              const changed = !isNew && editedKeys.includes(row.key)
              const rowEditable = editable && !toRetire && !retired
              const status = isNew ? 'Nova' : toRetire ? 'Excluir' : changed ? 'Alterada' : retired ? 'Retirada' : ''
              const cellProps = (column: ColumnKey) => ({
                'data-cell': `${row.key}:${column}`,
                disabled: !rowEditable,
                onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => moveFocus(event, rowIndex, column),
              })
              return (
                <tr
                  key={row.key}
                  className={[
                    isNew ? 'is-new' : '',
                    changed ? 'is-changed' : '',
                    toRetire ? 'is-deleting' : '',
                    retired ? 'is-retired' : '',
                    selected.has(row.key) ? 'is-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className="is-select">
                    {editable && (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${row.label || 'nova linha'}`}
                        checked={selected.has(row.key)}
                        onChange={(event) => {
                          const next = new Set(selected)
                          if (event.target.checked) next.add(row.key)
                          else next.delete(row.key)
                          setSelected(next)
                        }}
                      />
                    )}
                    {status && <span className={`tc-grid-status is-${status.toLowerCase()}`}>{status}</span>}
                  </td>
                  {dimension.usesGroups && (
                    <td className="is-group">
                      <input
                        {...cellProps('group')}
                        aria-label="Grupo"
                        list={datalistId}
                        value={row.group}
                        placeholder="sem grupo"
                        onChange={(event) => updateRow(row, { group: event.target.value })}
                      />
                    </td>
                  )}
                  <td className="is-label">
                    <input
                      {...cellProps('label')}
                      aria-label="Item"
                      value={row.label}
                      placeholder={isNew ? 'nome do item' : ''}
                      onChange={(event) => updateRow(row, { label: event.target.value })}
                    />
                    {concept?.releaseNotes && <small className="tc-note">{concept.releaseNotes}</small>}
                  </td>
                  <td className="is-codes">
                    <input
                      {...cellProps('codes')}
                      aria-label="Código oficial"
                      value={row.codes}
                      placeholder="—"
                      onChange={(event) => updateRow(row, { codes: event.target.value })}
                    />
                  </td>
                  <td className="is-synonyms">
                    <SynonymCell
                      aliases={row.aliases}
                      editable={rowEditable}
                      cellId={`${row.key}:aliases`}
                      onChange={(aliases) => updateRow(row, { aliases })}
                    />
                  </td>
                  <td className="is-narrow">
                    <input
                      type="checkbox"
                      aria-label="No perfil"
                      disabled={!rowEditable}
                      checked={row.profileVisible}
                      onChange={(event) => updateRow(row, { profileVisible: event.target.checked })}
                    />
                  </td>
                  <td className="is-narrow">
                    <input
                      type="checkbox"
                      aria-label="Classificar pelo nome"
                      disabled={!rowEditable}
                      checked={row.classifyByLabel}
                      onChange={(event) => updateRow(row, { classifyByLabel: event.target.checked })}
                    />
                  </td>
                  <td className="is-narrow">
                    <input
                      {...cellProps('displayOrder')}
                      aria-label="Ordem"
                      className="tc-order"
                      inputMode="numeric"
                      value={row.displayOrder}
                      onChange={(event) => updateRow(row, { displayOrder: event.target.value.replace(/\D/g, '') })}
                    />
                  </td>
                  <td className="tc-grid-code">{row.code ?? <em>gerado ao salvar</em>}</td>
                  <td className="is-actions">
                    {toRetire ? (
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(retire)
                          next.delete(row.key)
                          setRetire(next)
                        }}
                      >
                        Manter
                      </button>
                    ) : concept ? (
                      <button type="button" onClick={() => onOpenDetail(concept)}>
                        Detalhes
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="tc-grid-empty">
                  Nenhuma linha com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <datalist id={datalistId}>
          {groupOptions.map((label) => (
            <option key={label} value={label} />
          ))}
        </datalist>
      </div>
      <p className="tc-hint">
        {visibleRows.length} linhas · Enter, ↑ e ↓ mudam de linha · clique no título da coluna para ordenar · digite um
        grupo novo na coluna Grupo para criá-lo ao salvar · sinônimos tracejados (só busca, nome antigo, ambíguo) não
        marcam legislações; o tipo muda em Detalhes.
      </p>
    </div>
  )
}

function SynonymCell({
  aliases,
  editable,
  cellId,
  onChange,
}: {
  aliases: Alias[]
  editable: boolean
  cellId: string
  onChange: (aliases: Alias[]) => void
}) {
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const parts = raw
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter(Boolean)
    if (parts.length === 0) return
    const known = new Set(aliases.map((alias) => normalize(alias.text)))
    const added = parts
      .filter((part) => !known.has(normalize(part)))
      .map((part) => ({ text: part, aliasType: 'EXACT_LEXICAL' as AliasType }))
    if (added.length) onChange([...aliases, ...added])
    setText('')
  }

  return (
    <div className="tc-synonyms">
      {aliases.map((alias) => (
        <span
          key={`${alias.aliasType}:${alias.text}`}
          className={`tc-chip${CLASSIFYING_ALIAS_TYPES.includes(alias.aliasType) ? '' : ' is-search-only'}`}
          title={
            CLASSIFYING_ALIAS_TYPES.includes(alias.aliasType)
              ? `${ALIAS_TYPE_LABELS[alias.aliasType]}: marca legislações automaticamente`
              : `${ALIAS_TYPE_LABELS[alias.aliasType]}: ajuda a busca, não marca legislações (troque o tipo em Detalhes)`
          }
        >
          {alias.text}
          {ALIAS_TAGS[alias.aliasType] && <em>{ALIAS_TAGS[alias.aliasType]}</em>}
          {editable && (
            <button
              type="button"
              aria-label={`Remover sinônimo ${alias.text}`}
              onClick={() => onChange(aliases.filter((item) => item !== alias))}
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {editable && (
        <input
          data-cell={cellId}
          aria-label="Adicionar sinônimo"
          value={text}
          placeholder={aliases.length ? '+' : 'adicionar sinônimo'}
          onChange={(event) => {
            const value = event.target.value
            if (/[,;]/.test(value)) add(value)
            else setText(value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              add(text)
            } else if (event.key === 'Backspace' && !text && aliases.length) {
              onChange(aliases.slice(0, -1))
            }
          }}
          onBlur={() => add(text)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text')
            if (/[,;\n]/.test(pasted)) {
              event.preventDefault()
              add(text + pasted)
            }
          }}
        />
      )}
    </div>
  )
}
