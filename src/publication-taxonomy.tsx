import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RotateCcw, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { ProductApiFetch } from './product-api'
import {
  curatePublicationTag,
  fetchAdminMe,
  fetchCurationState,
  fetchCuratorPublicationTags,
  fetchPublicationTaxonomy,
  fetchReleaseView,
  setArchiveTagState,
  TaxonomyApiError,
  type PublicationTag,
  type PublicationTaxonomy,
} from './taxonomy-api'
import './publication-taxonomy.css'

const STATUS_COPY: Record<string, string> = {
  PENDING: 'Tags em processamento. Esta legislação será classificada em breve.',
  DISABLED: 'A classificação automática ainda não foi ativada.',
  EXCLUDED: 'Legislações desta fonte ainda não são classificadas.',
  FAILED: 'A classificação desta legislação falhou e será tentada novamente.',
  NO_RELEASE: 'Taxonomia indisponível.',
}

export function reasonText(tag: PublicationTag): string {
  const { reason } = tag
  switch (reason.type) {
    case 'TEXT':
      return `Encontrado no texto: “${reason.term ?? tag.label}”` + (reason.excerpt ? ` — ${reason.excerpt}` : '')
    case 'SYNONYM':
      return `Sinônimo encontrado: “${reason.term ?? ''}”` + (reason.excerpt ? ` — ${reason.excerpt}` : '')
    case 'PRODUCTS':
      return reason.excerpt ?? `Pelos produtos citados: ${reason.term ?? ''}`
    case 'NCM':
      return reason.excerpt ?? `NCM ${reason.term ?? ''} citado`
    case 'CCLASSTRIB':
      return `cClassTrib ${reason.term ?? ''} citado` + (reason.excerpt ? ` — ${reason.excerpt}` : '')
    case 'CURATOR':
      return `Marcada pela curadoria` + (reason.excerpt ? `: ${reason.excerpt}` : '')
    default:
      return tag.label
  }
}

export function PublicationTaxonomySection({
  apiFetch,
  publicationId,
}: {
  apiFetch: ProductApiFetch
  publicationId: string
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [justification, setJustification] = useState('')
  const [adding, setAdding] = useState('')

  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
    staleTime: 5 * 60_000,
  })
  const curator = Boolean(meQuery.data?.taxonomyCurator)

  const tagsQuery = useQuery({
    queryKey: ['publication-taxonomy', publicationId, curator],
    queryFn: () =>
      curator
        ? fetchCuratorPublicationTags(apiFetch, publicationId)
        : fetchPublicationTaxonomy(apiFetch, publicationId),
    enabled: !meQuery.isPending,
    retry: false,
  })

  const stateQuery = useQuery({
    queryKey: ['admin', 'taxonomy', 'state'],
    queryFn: () => fetchCurationState(apiFetch),
    enabled: curator,
    retry: false,
  })
  const publishedId = stateQuery.data?.published?.id
  const releaseQuery = useQuery({
    queryKey: ['admin', 'taxonomy', 'release', publishedId],
    queryFn: () => fetchReleaseView(apiFetch, publishedId!),
    enabled: curator && Boolean(publishedId),
    retry: false,
  })

  const curate = useMutation({
    mutationFn: (input: { conceptCode: string; action: 'ADD' | 'REMOVE' | 'RESTORE' }) =>
      curatePublicationTag(apiFetch, publicationId, {
        ...input,
        justification: justification.trim().length >= 3 ? justification.trim() : 'Correção de tag pela curadoria',
      }),
    onSuccess: (data: PublicationTaxonomy) => {
      queryClient.setQueryData(['publication-taxonomy', publicationId, curator], data)
      void queryClient.invalidateQueries({ queryKey: ['publication-taxonomy', publicationId, false] })
      setAdding('')
    },
  })

  const view = tagsQuery.data
  const tagged = useMemo(
    () => new Set(view?.sections.flatMap((s) => s.tags).filter((t) => !t.removed).map((t) => t.conceptCode)),
    [view],
  )
  const addOptions = useMemo(() => {
    const query = adding.trim().toLocaleLowerCase('pt-BR')
    if (query.length < 2 || !releaseQuery.data) return []
    const data = releaseQuery.data
    // Only concepts that have a section on the legislation page can be shown.
    const hasSection = (concept: (typeof data.concepts)[number]) =>
      Boolean(
        data.groups.find((group) => group.id === concept.groupId)?.detailSection ??
          data.dimensions.find((dimension) => dimension.code === concept.dimensionCode)?.detailSection,
      )
    return data.concepts
      .filter(
        (concept) =>
          concept.membershipStatus === 'INCLUDED' &&
          !tagged.has(concept.code) &&
          hasSection(concept) &&
          concept.label.toLocaleLowerCase('pt-BR').includes(query),
      )
      .slice(0, 8)
  }, [adding, releaseQuery.data, tagged])

  const openInArchive = (tag: PublicationTag) => {
    if (!tag.conceptCode) return
    setArchiveTagState({ code: tag.conceptCode, label: tag.label })
    navigate('/painel')
  }

  if (tagsQuery.isPending || meQuery.isPending) {
    return (
      <section className="publication-origins-card publication-tags-card">
        <h2>Tags identificadas nesta legislação</h2>
        <p className="publication-tags-state">Carregando tags…</p>
      </section>
    )
  }

  if (tagsQuery.isError) {
    const notFound = tagsQuery.error instanceof TaxonomyApiError && tagsQuery.error.status === 404
    if (notFound) return null
    return (
      <section className="publication-origins-card publication-tags-card">
        <h2>Tags identificadas nesta legislação</h2>
        <p className="publication-tags-state is-error">Não foi possível carregar as tags desta legislação.</p>
      </section>
    )
  }

  const sections = view?.sections ?? []
  const hasTags = sections.some((section) => section.tags.length > 0)

  return (
    <section className="publication-origins-card publication-tags-card">
      <h2>Tags identificadas nesta legislação</h2>
      {view?.release && (
        <p className="publication-tags-meta">
          Taxonomia {view.release.version}
          {view.classifiedAt && ` · classificada em ${new Date(view.classifiedAt).toLocaleDateString('pt-BR')}`}
          {' · clique numa tag para ver todas as legislações com ela'}
        </p>
      )}

      {!hasTags && (
        <p className="publication-tags-state">
          {view && view.status !== 'CLASSIFIED'
            ? STATUS_COPY[view.status] ?? 'Tags indisponíveis.'
            : 'Nenhuma tag da taxonomia foi identificada nesta legislação.'}
        </p>
      )}

      {sections.map((section) => (
        <div className="publication-tag-section" key={section.name}>
          <strong>{section.name}</strong>
          <div className="publication-tag-list">
            {section.tags.map((tag) => {
              const key = `${tag.kind}-${tag.conceptCode ?? tag.groupCode}`
              const text = reasonText(tag)
              return (
                <span
                  key={key}
                  className={`publication-tag${tag.removed ? ' is-removed' : ''}${tag.origin === 'CURATOR' ? ' is-curator' : ''}`}
                >
                  <button
                    type="button"
                    className="publication-tag-chip"
                    title={text}
                    aria-describedby={`${key}-reason`}
                    disabled={!tag.conceptCode}
                    onClick={() => openInArchive(tag)}
                  >
                    <Tag size={12} aria-hidden="true" />
                    {tag.label}
                    {tag.groupLabel && <small>{tag.groupLabel}</small>}
                  </button>
                  <span role="tooltip" id={`${key}-reason`} className="publication-tag-reason">
                    {text}
                  </span>
                  {curator && tag.conceptCode && (
                    <button
                      type="button"
                      className="publication-tag-action"
                      aria-label={tag.removed ? `Restaurar ${tag.label}` : `Remover ${tag.label}`}
                      disabled={curate.isPending}
                      onClick={() =>
                        curate.mutate({
                          conceptCode: tag.conceptCode!,
                          action: tag.removed ? 'RESTORE' : 'REMOVE',
                        })
                      }
                    >
                      {tag.removed ? <RotateCcw size={12} /> : <X size={12} />}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      ))}

      {curator && view?.status !== 'EXCLUDED' && (
        <div className="publication-tags-curator">
          <strong>Curadoria</strong>
          <input
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="Motivo da correção (opcional)"
            aria-label="Motivo da correção"
          />
          <div className="publication-tags-add">
            <input
              value={adding}
              onChange={(event) => setAdding(event.target.value)}
              placeholder="Acrescentar tag: digite o nome do item"
              aria-label="Acrescentar tag"
            />
            {addOptions.length > 0 && (
              <ul>
                {addOptions.map((concept) => (
                  <li key={concept.code}>
                    <button
                      type="button"
                      disabled={curate.isPending}
                      onClick={() => curate.mutate({ conceptCode: concept.code, action: 'ADD' })}
                    >
                      <Plus size={12} /> {concept.label}
                      <small>{releaseQuery.data?.dimensions.find((d) => d.code === concept.dimensionCode)?.name}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {curate.isError && <p className="publication-tags-state is-error">Não foi possível salvar a correção.</p>}
        </div>
      )}
    </section>
  )
}
