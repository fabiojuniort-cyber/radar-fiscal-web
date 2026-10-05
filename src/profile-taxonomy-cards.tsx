import { useQuery } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import { useState } from 'react'

import type { ProductApiFetch, TaxonomyProfileDimension } from './product-api'
import { searchNcmCatalog, type NcmCatalogItem } from './product-ncm-api'
import './profile-taxonomy-cards.css'

/**
 * Cards of the Tax Profile markers: what is selected stays on top as tags
 * with an x; the options to browse and pick come below, separately.
 */

type Concept = TaxonomyProfileDimension['concepts'][number]

/** A tag that comes from somewhere else (e.g. the segment of a CNAE). */
export type DerivedTag = { code: string; label: string; source: string }

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

function SelectedTags({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <div className="tp-profile-selected" aria-label={title}>
      <small>{title}</small>
      {children.length === 0 ? (
        <span className="tp-profile-selected-empty">{empty}</span>
      ) : (
        <div className="tp-profile-selected-tags">{children}</div>
      )}
    </div>
  )
}

function Tag({
  label,
  source,
  removeLabel,
  onRemove,
  title,
}: {
  label: string
  source?: string
  removeLabel: string
  onRemove?: () => void
  title?: string
}) {
  return (
    <span className={source ? 'tp-profile-tag is-derived' : 'tp-profile-tag'} title={title}>
      <span>
        <b>{label}</b>
        {source && <small>{source}</small>}
      </span>
      {onRemove && (
        <button type="button" aria-label={removeLabel} onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </span>
  )
}

export function TaxonomyDimensionPicker({
  dimension,
  selected,
  onToggle,
  onSetMany,
  suggestions,
  derived = [],
  onRemoveDerived,
}: {
  dimension: TaxonomyProfileDimension
  selected: Set<string>
  onToggle: (code: string) => void
  onSetMany: (codes: string[], checked: boolean) => void
  suggestions?: Map<string, 'PRIMARY' | 'SECONDARY'>
  /** Tags that come from elsewhere and are shown as selected. */
  derived?: DerivedTag[]
  onRemoveDerived?: (tag: DerivedTag) => void
}) {
  const [query, setQuery] = useState('')
  const needle = normalize(query)
  const derivedCodes = new Set(derived.map((tag) => tag.code))
  const isTaken = (code: string) => selected.has(code) || derivedCodes.has(code)
  const chosen = dimension.concepts.filter((concept) => selected.has(concept.code) && !derivedCodes.has(concept.code))
  const available = dimension.concepts.filter(
    (concept) => !isTaken(concept.code) && (!needle || normalize(concept.label).includes(needle)),
  )
  const selectedCount = derived.length + chosen.length
  const groups = dimension.usesGroups ? dimension.groups ?? [] : []

  const option = (concept: Concept) => (
    <button
      type="button"
      className="tp-profile-option"
      key={concept.code}
      title={concept.helpText || concept.definition}
      onClick={() => onToggle(concept.code)}
    >
      <span>
        <b>{concept.label}</b>
        {suggestions?.has(concept.code) && <small className="tp-taxonomy-suggested">sugerido pelo CNAE</small>}
      </span>
      <Plus size={14} aria-hidden="true" />
    </button>
  )

  const flatShown = needle ? available.slice(0, 80) : available.slice(0, 40)

  return (
    <section className="tp-taxonomy-dimension" aria-label={dimension.name}>
      <div>
        <strong>{dimension.name}</strong>
        <span>
          {dimension.concepts.length} opções · {selectedCount} selecionadas
        </span>
      </div>
      {dimension.helpText && <p className="tp-taxonomy-help">{dimension.helpText}</p>}

      <SelectedTags title="Selecionados" empty="Nenhum selecionado.">
        {[
          ...derived.map((tag) => (
            <Tag
              key={'derived:' + tag.code}
              label={tag.label}
              source={tag.source}
              removeLabel={'Remover ' + tag.label}
              {...(onRemoveDerived ? { onRemove: () => onRemoveDerived(tag) } : {})}
            />
          )),
          ...chosen.map((concept) => (
            <Tag
              key={concept.code}
              label={concept.label}
              removeLabel={'Remover ' + concept.label}
              onRemove={() => onToggle(concept.code)}
            />
          )),
        ]}
      </SelectedTags>

      <div className="tp-profile-browse">
        <small>Adicionar</small>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          placeholder={'Buscar em ' + dimension.name.toLowerCase()}
          aria-label={'Buscar ' + dimension.name}
        />
        {available.length === 0 ? (
          <span className="tp-profile-selected-empty">
            {needle ? 'Nada encontrado.' : 'Todas as opções já foram selecionadas.'}
          </span>
        ) : groups.length > 0 ? (
          <div className="tp-taxonomy-groups">
            {[...groups, null].map((group) => {
              const items = available.filter((concept) =>
                group
                  ? concept.groupCode === group.code
                  : !concept.groupCode || !groups.some((g) => g.code === concept.groupCode),
              )
              if (items.length === 0) return null
              return (
                <details
                  key={group?.code ?? 'outros'}
                  className="tp-taxonomy-group"
                  open={Boolean(needle) || items.some((concept) => suggestions?.has(concept.code))}
                >
                  <summary title={group?.helpText ?? undefined}>
                    <b>{group ? group.label : 'Outros'}</b>
                    <small>{items.length}</small>
                  </summary>
                  {group && (
                    <button
                      type="button"
                      className="tp-taxonomy-group-all"
                      onClick={() => onSetMany(items.map((concept) => concept.code), true)}
                    >
                      Marcar o grupo inteiro
                    </button>
                  )}
                  <div className="tp-taxonomy-options">{items.map(option)}</div>
                </details>
              )
            })}
          </div>
        ) : (
          <div className="tp-taxonomy-options">{flatShown.map(option)}</div>
        )}
        {!needle && groups.length === 0 && available.length > flatShown.length && (
          <span className="tp-profile-selected-empty">
            Mais {available.length - flatShown.length} opções: use a busca.
          </span>
        )}
      </div>
    </section>
  )
}

/** Card NCM: NCMs of the company, compared with the NCMs acts mention. */
export function NcmProfileCard({
  apiFetch,
  codes,
  onChange,
  derived,
}: {
  apiFetch: ProductApiFetch
  codes: string[]
  onChange: (codes: string[]) => void
  /** NCMs set on the CNAE table (CNAE or product NCMs). */
  derived: Array<{ code: string; officialCode: string; description: string; source: string }>
}) {
  const [query, setQuery] = useState('')
  const term = query.trim()
  const derivedCodes = new Set(derived.map((item) => item.code))
  const own = codes.filter((code) => !derivedCodes.has(code))

  // Descriptions of the saved NCMs.
  const labelsQuery = useQuery({
    queryKey: ['ncm-labels', [...own].sort().join(',')],
    queryFn: () => searchNcmCatalog(apiFetch, '', 200, own),
    enabled: own.length > 0,
    retry: false,
  })
  const searchQuery = useQuery({
    queryKey: ['ncm-catalog-search', term],
    queryFn: () => searchNcmCatalog(apiFetch, term, 20),
    enabled: term.length >= 2,
    retry: false,
  })
  const known = new Map<string, NcmCatalogItem>()
  for (const item of [...(labelsQuery.data?.items ?? []), ...(searchQuery.data?.items ?? [])]) known.set(item.code, item)
  const format = (code: string) => known.get(code)?.officialCode || `${code.slice(0, 4)}.${code.slice(4, 6)}.${code.slice(6)}`
  const results = (searchQuery.data?.items ?? []).filter((item) => !codes.includes(item.code) && !derivedCodes.has(item.code))

  return (
    <section className="tp-taxonomy-dimension" aria-label="NCM">
      <div>
        <strong>NCM</strong>
        <span>{derived.length + own.length} selecionadas</span>
      </div>
      <p className="tp-taxonomy-help">
        NCMs com que a empresa trabalha. São comparadas com as NCMs mencionadas nas legislações.
      </p>

      <SelectedTags title="Selecionados" empty="Nenhuma NCM selecionada.">
        {[
          ...derived.map((item) => (
            <Tag
              key={'derived:' + item.code + item.source}
              label={item.officialCode || item.code}
              source={item.source}
              title={`${item.description} · altere na tabela de CNAEs`}
              removeLabel=""
            />
          )),
          ...own.map((code) => (
            <Tag
              key={code}
              label={format(code)}
              title={known.get(code)?.description}
              removeLabel={'Remover NCM ' + format(code)}
              onRemove={() => onChange(codes.filter((item) => item !== code))}
            />
          )),
        ]}
      </SelectedTags>

      <div className="tp-profile-browse">
        <small>Adicionar</small>
        <div className="tp-profile-search">
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
            placeholder="Código ou descrição do NCM"
            aria-label="Buscar NCM"
          />
        </div>
        {term.length > 0 && term.length < 2 && <span className="tp-profile-selected-empty">Digite pelo menos 2 caracteres.</span>}
        {searchQuery.isFetching && <span className="tp-profile-selected-empty">Pesquisando no catálogo oficial…</span>}
        {results.length > 0 && (
          <div className="tp-taxonomy-options" role="group" aria-label="NCMs encontradas">
            {results.map((item) => (
              <button
                type="button"
                className="tp-profile-option"
                key={item.entryId}
                title={item.description}
                onClick={() => onChange([...codes, item.code])}
              >
                <span>
                  <b>{item.officialCode || item.code}</b>
                  <small>{item.description}</small>
                </span>
                <Plus size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
