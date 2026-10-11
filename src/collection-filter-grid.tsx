import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDownUp, Filter, Download } from 'lucide-react'
import { FilterDialog, rememberDialogTrigger } from './collection-filter-dialog'

export interface FilterColumn<T> { key: string; label: string; value: (row: T) => string; render?: (row: T) => ReactNode }

export function FilterGrid<T>({ title, rows, columns, actions, onExport }: {
  title: string; rows: T[]; columns: FilterColumn<T>[]; actions: (row: T) => ReactNode;
  onExport: (rows: T[]) => void
}) {
  const [filters, setFilters] = useState<Record<string, string[]>>({})
  const [filterKey, setFilterKey] = useState<string | null>(null)
  const [selection, setSelection] = useState<string[] | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(null)
  const [page, setPage] = useState(0)
  const filtered = useMemo(() => {
    const result = rows.filter(row => columns.every(c => !filters[c.key] || filters[c.key].includes(c.value(row))))
    const column = columns.find(c => c.key === sort?.key)
    if (column) result.sort((a, b) => column.value(a).localeCompare(column.value(b), 'pt-BR', { numeric: true }) * (sort?.desc ? -1 : 1))
    return result
  }, [rows, columns, filters, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / 50))
  const safePage = Math.min(page, pages - 1)
  useEffect(() => setPage(0), [filters, sort])
  const column = columns.find(c => c.key === filterKey)
  const values = column ? [...new Set(rows.map(column.value))].sort((a,b) => a.localeCompare(b, 'pt-BR')) : []
  const shownValues = values.filter(v => v.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  return <div className="cf-grid">
    <div className="cf-grid-toolbar">
      <span role="status">{filtered.length} de {rows.length} registros</span>
      <button type="button" onClick={() => setFilters({})} disabled={!Object.keys(filters).length}>Limpar filtros</button>
      <button type="button" onClick={() => onExport(filtered)}><Download size={15} /> Exportar CSV</button>
    </div>
    <div className="cf-table-wrap cf-grid-scroll">
      <table aria-label={title}>
        <thead><tr>{columns.map(c => <th key={c.key} aria-sort={sort?.key === c.key ? sort.desc ? 'descending' : 'ascending' : 'none'}>
          <div className="cf-column-head">
            <button type="button" onClick={() => setSort({ key: c.key, desc: sort?.key === c.key && !sort.desc })} aria-label={`Ordenar ${c.label}`} title={`Ordenar ${c.label}`}>{c.label}<ArrowDownUp size={13} /></button>
            <button type="button" className={filters[c.key] ? 'is-filtered' : ''} aria-label={`Filtrar ${c.label}`} onClick={() => { rememberDialogTrigger(); setSearch(''); setSelection(filters[c.key] ?? null); setFilterKey(c.key) }}><Filter size={14} /></button>
          </div>
        </th>)}<th>Ações</th></tr></thead>
        <tbody>{filtered.slice(safePage * 50, (safePage + 1) * 50).map((row, i) => <tr key={i}>{columns.map(c => <td key={c.key}>{c.render ? c.render(row) : c.value(row) || '—'}</td>)}<td>{actions(row)}</td></tr>)}</tbody>
      </table>
      {!filtered.length && <p className="cf-empty">Nenhum registro para os filtros selecionados.</p>}
    </div>
    <div className="cf-grid-pagination"><button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Anterior</button><span>Página {safePage + 1} de {pages}</span><button type="button" disabled={safePage + 1 >= pages} onClick={() => setPage(safePage + 1)}>Próxima</button></div>
    {column && <FilterDialog title={`Filtrar ${column.label}`} description="Marque os valores que deseja exibir. Os filtros das colunas são combinados." onClose={() => setFilterKey(null)}>
      <input aria-label={`Pesquisar valores de ${column.label}`} placeholder="Pesquisar valores…" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="cf-row-actions"><button type="button" onClick={() => setSelection(null)}>Selecionar todos</button><button type="button" onClick={() => setSelection([])}>Desmarcar todos</button></div>
      <div className="cf-checkbox-list">{shownValues.map(value => <label key={value}><input type="checkbox" checked={!selection || selection.includes(value)} onChange={e => setSelection(current => {
        const selected = current ?? values
        return e.target.checked ? [...selected, value] : selected.filter(v => v !== value)
      })} />{value || '(Vazio)'}</label>)}{!shownValues.length && <p>Nenhum valor encontrado.</p>}</div>
      <button type="button" onClick={() => { setFilters(current => { const next = {...current}; if(selection===null)delete next[column.key];else next[column.key]=selection;return next });setFilterKey(null) }}>Aplicar filtro</button>
    </FilterDialog>}
  </div>
}
