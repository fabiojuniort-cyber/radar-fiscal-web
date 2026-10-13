import { ArrowDown, ArrowUp, ArrowUpDown, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import type { ProductApiFetch } from './product-api'
import {
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
  /** F2 source suggestions; read-only, never included in curator writes. */
  atuacao: string
  suggestedProducts: string
  suggestedNcms: string
}

type ColumnKey = 'segment' | 'group' | 'label' | 'codes' | 'aliases' | 'profileVisible' | 'classifyByLabel' | 'displayOrder' | 'code' | 'atuacao' | 'suggestedProducts' | 'suggestedNcms'


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
    atuacao: concept.f2Source?.atuacao ?? '',
    suggestedProducts: concept.f2Source?.suggestedProducts ?? '',
    suggestedNcms: concept.f2Source?.suggestedNcms ?? '',
  }
}

function sameDraft(left: RowDraft, right: RowDraft): boolean {
  return JSON.stringify({ ...left, key: '' }) === JSON.stringify({ ...right, key: '' })
}

function errorText(error: unknown): string {
  if (error instanceof TaxonomyApiError) return error.detail || `Erro: ${error.code}`
  return error instanceof Error ? error.message : 'Erro inesperado.'
}

function cellText(row: RowDraft, column: ColumnKey, segmentOf: (group: string) => string): string {
  switch (column) {
    case 'segment':
      return segmentOf(row.group)
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

/** Existing draft groups may already carry "Segmento / Subsegmento" as one label.
 * Only strip a prefix that is demonstrably the selected parent; never rewrite
 * group identity or guess at separators inside an unrelated subsegment name.
 */
export function subsegmentName(segment: string, subsegment: string): string {
  const parent = segment.trim()
  const raw = subsegment.trim()
  if (!parent || !raw) return raw
  const split = /^(.+?)\s+(?:\/|–)\s+(.+)$/.exec(raw)
  return split && normalize(split[1]!.trim()) === normalize(parent)
    ? split[2]!.trim()
    : raw
}

/** Presentation only: Segmento and Subsegmento keep their stored identities. */
export function displaySegmentSubsegment(segment: string, subsegment: string): string {
  const parent = segment.trim()
  const child = subsegmentName(parent, subsegment)
  return parent && child ? `${parent} – ${child}` : parent || child
}

const SEGMENT_COLUMN_DIMENSIONS = new Set(['sector', 'product'])

let newRowCounter = 0

/** Segmento cell: drop-down of the Segmento table, applied to the row's group. */
function SegmentCell({
  group,
  codes,
  options,
  labelOf,
  disabled,
  groupNoun,
  onChange,
}: {
  group: string
  codes: string[]
  options: CurationConcept[]
  labelOf: (code: string) => string | undefined
  disabled: boolean
  groupNoun: string
  onChange: (codes: string[]) => void
}) {
  const unknown = codes.filter((code) => !labelOf(code))
  const value = codes.length === 1 ? codes[0]! : codes.length > 1 ? '__many__' : ''
  return (
    <select
      aria-label="Segmento"
      className={unknown.length ? 'is-invalid' : undefined}
      value={value}
      disabled={disabled}
      title={
        !group.trim()
          ? `Informe o ${groupNoun} para escolher o segmento.`
          : `Segmento do ${groupNoun} “${group.trim()}”: vale para todos os itens dele.`
      }
      onChange={(event) => onChange(event.target.value ? [event.target.value] : [])}
    >
      <option value="">— sem segmento —</option>
      {codes.length > 1 && (
        <option value="__many__" disabled>
          {codes.map((code) => labelOf(code) ?? code).join(', ')}
        </option>
      )}
      {unknown.length === 1 && codes.length === 1 && (
        <option value={unknown[0]} disabled>
          {unknown[0]} (fora da tabela Segmento)
        </option>
      )}
      {options.map((segment) => (
        <option key={segment.code} value={segment.code}>
          {segment.label}
        </option>
      ))}
    </select>
  )
}

export function CurationGrid({
  apiFetch,
  dimension,
  concepts,
  groups,
  segments = [],
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
  /** Segment concepts: a group's segments show in the first column. */
  segments?: CurationConcept[]
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
  // The segment belongs to the group: choosing it on one row sets it for
  // every item of that group. Only items of the Segmento table are offered.
  const segmentLabel = useMemo(() => new Map(segments.map((segment) => [segment.code, segment.label])), [segments])
  const segmentOptions = useMemo(
    () => [...segments].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    [segments],
  )
  const baseSegmentCodes = useMemo(
    () => new Map(groups.map((group) => [normalize(group.label.trim()), group.segmentCodes])),
    [groups],
  )
  const [segmentEdits, setSegmentEdits] = useState<Record<string, { group: string; codes: string[] }>>({})
  const segmentCodesOf = useCallback(
    (group: string): string[] => {
      const key = normalize(group.trim())
      return segmentEdits[key]?.codes ?? baseSegmentCodes.get(key) ?? []
    },
    [baseSegmentCodes, segmentEdits],
  )
  const segmentOf = useCallback(
    (group: string) =>
      segmentCodesOf(group)
        .map((code) => segmentLabel.get(code) ?? code)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
        .join(', '),
    [segmentCodesOf, segmentLabel],
  )
  const changedSegments = Object.entries(segmentEdits).filter(
    ([key, edit]) => JSON.stringify(edit.codes) !== JSON.stringify(baseSegmentCodes.get(key) ?? []),
  )
  // Only the Segmento and Produtos tables carry the Segmento column.
  const showSegment =
    SEGMENT_COLUMN_DIMENSIONS.has(dimension.code) && dimension.usesGroups && segments.length > 0
  const isCnae = dimension.code === 'sector' && dimension.officialCodeType === 'CNAE'
  const [rowKind, setRowKind] = useState<'cnae' | 'general' | 'all'>(() =>
    isCnae && concepts.some(c => c.officialCodes.some(code => /^\d{7}$/.test(code))) ? 'cnae' : 'all',
  )
  const [page, setPage] = useState(0)

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
  const pending = editedKeys.length + newRows.length + retire.size + changedSegments.length
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
    ...(showSegment ? [{ key: 'segment' as const, label: 'Segmento', className: 'is-segment' }] : []),
    ...(dimension.usesGroups ? [{ key: 'group' as const, label: isCnae ? 'Subsegmento' : 'Grupo', className: 'is-group' }] : []),
    ...(isCnae ? [
      { key: 'atuacao' as const, label: 'Atuação', className: 'is-f2-source' },
      { key: 'suggestedProducts' as const, label: 'Produtos sugeridos', className: 'is-f2-source' },
      { key: 'suggestedNcms' as const, label: 'NCMs sugeridos', className: 'is-f2-source' },
    ] : []),
    ...(!isCnae ? [{ key: 'label' as const, label: 'Item', className: 'is-label' }] : []),
    {
      key: 'codes',
      label: dimension.officialCodeType ? OFFICIAL_CODE_TYPE_LABELS[dimension.officialCodeType] : 'Código oficial',
      className: 'is-codes',
    },
    ...(isCnae ? [{ key: 'label' as const, label: 'Descrição do CNAE', className: 'is-label' }] : []),
    { key: 'aliases', label: 'Sinônimos', className: 'is-synonyms' },
    { key: 'profileVisible', label: 'No perfil', className: 'is-narrow' },
    { key: 'classifyByLabel', label: 'Classificar pelo nome', className: 'is-narrow' },
    { key: 'displayOrder', label: 'Ordem', className: 'is-narrow' },
    { key: 'code', label: 'Código TriFaros' },
  ]

  const normalizedQuery = normalize(query.trim())
  const visibleRows = useMemo(() => {
    const current = baseRows.map((row) => edits[row.key] ?? row)
    const filtered = current.filter((row) => {
      const exact = splitList(row.codes).some(code => /^\d{7}$/.test(code.replace(/[.\-/\s]/g, '')))
      if (isCnae && (rowKind === 'cnae' && !exact || rowKind === 'general' && exact)) return false
      if (
        normalizedQuery &&
        ![row.label, row.codes, row.group, segmentOf(row.group), row.code ?? '', ...row.aliases.map((alias) => alias.text)].some((value) =>
          normalize(value).includes(normalizedQuery),
        )
      ) {
        return false
      }
      return Object.entries(filters).every(([column, value]) => {
        const needle = normalize((value ?? '').trim())
        return !needle || normalize(cellText(row, column as ColumnKey, segmentOf)).includes(needle)
      })
    })
    const sorted = [...filtered].sort((left, right) => {
      if (sort) {
        const a = cellText(left, sort.column, segmentOf)
        const b = cellText(right, sort.column, segmentOf)
        const numeric = sort.column === 'displayOrder'
        const result = numeric
          ? (Number(a || 99999) - Number(b || 99999))
          : a.localeCompare(b, 'pt-BR', { numeric: true })
        if (result !== 0) return result * sort.direction
      }
      if (isCnae && rowKind === 'cnae') return left.codes.localeCompare(right.codes, 'pt-BR', { numeric: true })
      return (
        (groupOrder.get(left.group) ?? 99999) - (groupOrder.get(right.group) ?? 99999) ||
        (left.group || '~').localeCompare(right.group || '~', 'pt-BR') ||
        Number(left.displayOrder || 99999) - Number(right.displayOrder || 99999) ||
        left.label.localeCompare(right.label, 'pt-BR')
      )
    })
    return [...newRows, ...sorted]
  }, [baseRows, edits, filters, groupOrder, isCnae, newRows, normalizedQuery, rowKind, segmentOf, sort])
  useEffect(() => { setPage(0) }, [query, filters, sort, rowKind])
  const paginated = isCnae && visibleRows.length > 50
  const lastPage = paginated ? Math.ceil(visibleRows.length / 50) - 1 : 0
  const currentPage = Math.min(page, lastPage)
  const pageRows = paginated ? visibleRows.slice(currentPage * 50, (currentPage + 1) * 50) : visibleRows

  const updateRow = (row: RowDraft, patch: Partial<RowDraft>) => {
    setMessage(null)
    if (row.code === null) {
      setNewRows((rows) => rows.map((item) => (item.key === row.key ? { ...item, ...patch } : item)))
    } else {
      setEdits((current) => ({ ...current, [row.key]: { ...(current[row.key] ?? row), ...patch } }))
    }
  }

  const insertRow = () => {
    setPage(0)
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
      atuacao: '',
      suggestedProducts: '',
      suggestedNcms: '',
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
    setSegmentEdits({})
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
        groupSegments: changedSegments.map(([, edit]) => ({ group: edit.group.trim(), segmentCodes: edit.codes })),
      })
      setSegmentEdits({})
      setEdits({})
      setNewRows([])
      setRetire(new Set())
      setSelected(new Set())
      await onChanged()
      setMessage({
        kind: 'ok',
        text:
          `Salvo no rascunho: ${result.created.length} novos · ${result.updated} alterados · ${result.retired} excluídos` +
          (result.groupsCreated ? ` · ${result.groupsCreated} grupos novos` : '') +
          (result.groupsUpdated ? ` · segmento de ${result.groupsUpdated} grupo(s)` : ''),
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
    const target = pageRows[rowIndex + step]
    if (!target) return
    event.preventDefault()
    document.querySelector<HTMLInputElement>(`[data-cell="${target.key}:${column}"]`)?.focus()
  }

  const allVisibleSelected = pageRows.length > 0 && pageRows.every((row) => selected.has(row.key))
  const groupOptions = [...new Set(groups.map((group) =>
    isCnae ? subsegmentName(segmentOf(group.label), group.label) : group.label,
  ))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const resolveGroupInput = (value: string): string => {
    if (!isCnae) return value
    const matched = groups.filter((group) =>
      subsegmentName(segmentOf(group.label), group.label) === value,
    )
    // If ambiguous, do not silently assign a CNAE to a different group.
    return matched.length === 1 ? matched[0]!.label : value
  }
  const datalistId = `tc-groups-${dimension.code}`

  return (
    <div className="tc-grid-block">
      {isCnae && <label className="tc-grid-view">Exibir
        <select aria-label="Exibir atividades ou segmentos gerais" value={rowKind} onChange={event => setRowKind(event.target.value as typeof rowKind)}>
          <option value="cnae">Atividades por CNAE</option>
          <option value="general">Segmentos gerais e itens legados</option>
          <option value="all">Todos os itens</option>
        </select>
      </label>}
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
                      setSelected(event.target.checked ? new Set([...selected, ...pageRows.map(row => row.key)]) : new Set([...selected].filter(key => !pageRows.some(row => row.key === key))))
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
            {pageRows.map((row, rowIndex) => {
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
                  {showSegment && (
                    <td className="is-segment">
                      <SegmentCell
                        group={row.group}
                        codes={segmentCodesOf(row.group)}
                        options={segmentOptions}
                        labelOf={(code) => segmentLabel.get(code)}
                        disabled={!rowEditable || !row.group.trim()}
                        groupNoun={isCnae ? 'subsegmento' : 'grupo'}
                        onChange={(codes) => {
                          setMessage(null)
                          setSegmentEdits((current) => ({
                            ...current,
                            [normalize(row.group.trim())]: { group: row.group, codes },
                          }))
                        }}
                      />
                    </td>
                  )}
                  {dimension.usesGroups && (
                    <td className="is-group">
                      <input
                        {...cellProps('group')}
                        aria-label={isCnae ? 'Subsegmento' : 'Grupo'}
                        list={datalistId}
                        value={isCnae ? subsegmentName(segmentOf(row.group), row.group) : row.group}
                        placeholder={isCnae ? 'sem subsegmento' : 'sem grupo'}
                        title={isCnae ? displaySegmentSubsegment(segmentOf(row.group), row.group) : row.group}
                        onChange={(event) => updateRow(row, { group: resolveGroupInput(event.target.value) })}
                      />
                      {isCnae && row.group.trim() && (
                        <small className="tc-subsegment-context" aria-label="Segmento e subsegmento">
                          {displaySegmentSubsegment(segmentOf(row.group), row.group)}
                        </small>
                      )}
                    </td>
                  )}
                  {isCnae && (['atuacao', 'suggestedProducts', 'suggestedNcms'] as const).map((key) => (
                    <td className="is-f2-source" key={key} title={row[key] || 'Sem vínculo auditado com a fonte F2 nesta versão'}>
                      {row[key] || <span className="tc-source-pending">—</span>}
                    </td>
                  ))}
                  {(isCnae ? ['codes', 'label'] as const : ['label', 'codes'] as const).map(column => column === 'label' ? <td key="label" className="is-label">
                    <input
                      {...cellProps('label')}
                      aria-label={isCnae ? 'Descrição do CNAE' : 'Item'}
                      title={row.label}
                      value={row.label}
                      placeholder={isNew ? 'nome do item' : ''}
                      onChange={(event) => updateRow(row, { label: event.target.value })}
                    />
                    {concept?.releaseNotes && <small className="tc-note">{concept.releaseNotes}</small>}
                  </td> : <td key="codes" className="is-codes">
                    <input
                      {...cellProps('codes')}
                      aria-label={isCnae ? 'CNAE' : 'Código oficial'}
                      value={row.codes}
                      placeholder="—"
                      onChange={(event) => updateRow(row, { codes: event.target.value })}
                    />
                  </td>)}
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
      {paginated && <nav className="tc-grid-pagination" aria-label="Páginas da tabela">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Página anterior</button>
        <span>Página {currentPage + 1} de {lastPage + 1} · {visibleRows.length} linhas</span>
        <button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Próxima página</button>
      </nav>}
      {isCnae && (
        <p className="tc-hint">
          Atuação, Produtos sugeridos e NCMs sugeridos são campos de origem F2 (somente leitura).
          Traço indica ausência de vínculo auditado por CNAE na versão exibida;
          a carga isolada T03 não publica esses dados automaticamente.
        </p>
      )}
      <p className="tc-hint">
        {visibleRows.length} linhas · Enter, ↑ e ↓ mudam de linha · clique no título da coluna para ordenar · digite um
        {isCnae ? 'subsegmento novo na coluna Subsegmento' : 'grupo novo na coluna Grupo'} para criá-lo ao salvar · todo sinônimo marca
        automaticamente as legislações em que aparece.
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
        <span key={`${alias.aliasType}:${alias.text}`} className="tc-chip">
          {alias.text}
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
