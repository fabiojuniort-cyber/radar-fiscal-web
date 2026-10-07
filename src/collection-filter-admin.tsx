import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import type { ProductApiFetch } from './product-api'
import { fetchAdminMe } from './taxonomy-api'
import {
  approveCollectionFilterDraft,
  CollectionFilterApiError,
  fetchCollectionFilterNewTypes,
  fetchCollectionFilterSimulationItems,
  fetchCollectionFilterState,
  requestCollectionFilterSimulation,
  resolveCollectionFilterNewType,
  saveCollectionFilterDraft,
  saveCollectionFilterSimulationFeedback,
  type CollectionFilterDocument,
  type CollectionFilterSimulation,
} from './collection-filter-api'
import './collection-filter-admin.css'
import { fetchCatalogFacets } from './catalog-api'
import { TypesEditor, TermsEditor, NewTypeActions, type FilterOrigins } from './collection-filter-editors'
import { normalizeFilterText, filterTermKey } from './collection-filter-csv'
import { CollectionFilterDiscards, CollectionFilterDiscardAlerts } from './collection-filter-discards'

type Tab = 'types' | 'terms' | 'new-types' | 'simulations' | 'discarded' | 'discard-alerts'
type EditableDocument = Omit<
  CollectionFilterDocument,
  'id' | 'version' | 'revision' | 'status'
>

const EMPTY_DRAFT: EditableDocument = {
  contextWindowWords: 12,
  weakScoreThreshold: 3,
  locationWeights: {
    title: 3,
    summary: 2,
    body: 1,
  },
  changeNotes: null,
  rules: [],
  aliases: [],
  terms: [],
}

const ERROR_TEXT: Record<string, string> = {
  platform_admin_required:
    'Seu usuário não possui acesso administrativo global.',
  invalid_collection_filter_draft:
    'O rascunho contém uma configuração inválida.',
  collection_filter_fresh_simulation_required:
    'É necessário concluir uma nova simulação desta revisão antes de aprovar.',
  collection_filter_full_archive_simulation_required:
    'A primeira aprovação exige uma simulação completa do acervo.',
  collection_filter_simulation_has_errors:
    'A simulação possui itens marcados como erro. Ajuste o filtro e simule novamente.',
  collection_filter_draft_not_found:
    'Não existe rascunho disponível para esta operação.',
}

function errorText(error: unknown) {
  if (error instanceof CollectionFilterApiError) {
    return (
      ERROR_TEXT[error.code] ??
      error.detail ??
      `Falha no filtro: ${error.code}`
    )
  }
  return 'Não foi possível concluir a operação.'
}

function cloneDraft(source?: CollectionFilterDocument): EditableDocument {
  if (!source) return structuredClone(EMPTY_DRAFT)
  return {
    contextWindowWords: source.contextWindowWords,
    weakScoreThreshold: source.weakScoreThreshold,
    locationWeights: { ...source.locationWeights },
    changeNotes: source.changeNotes,
    rules: source.rules.map((rule) => ({ ...rule })),
    aliases: source.aliases.map((alias) => ({ ...alias })),
    terms: source.terms.map((term) => ({ ...term })),
  }
}

export function CollectionFilterAdminPage({
  apiFetch,
  sessionKey = 'standalone',
}: {
  apiFetch: ProductApiFetch
  sessionKey?: string
}) {
  const parentClient = useQueryClient()
  // All authorization, policy, simulation and operational data belong to this
  // authenticated session. Even a late response cannot populate another client.
  const client = useMemo(() => new QueryClient({
    defaultOptions: parentClient.getDefaultOptions(),
  }), [parentClient, sessionKey])
  useEffect(() => () => client.clear(), [client])
  return <QueryClientProvider client={client}>
    <CollectionFilterAdminContent key={sessionKey} apiFetch={apiFetch} />
  </QueryClientProvider>
}

function CollectionFilterAdminContent({ apiFetch }: {
  apiFetch: ProductApiFetch
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('types')
  const [draft, setDraft] = useState<EditableDocument>(
    structuredClone(EMPTY_DRAFT),
  )
  const [loadedPolicyId, setLoadedPolicyId] = useState<string | null>(null)

  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
  })

  const stateQuery = useQuery({
    queryKey: ['collection-filter', 'state'],
    queryFn: () => fetchCollectionFilterState(apiFetch),
    refetchInterval: 60000,
    enabled: meQuery.data?.platformAdmin === true,
    retry: false,
  })

  const newTypesQuery = useQuery({
    queryKey: ['collection-filter', 'new-types'],
    queryFn: () => fetchCollectionFilterNewTypes(apiFetch, 'OPEN'),
    refetchInterval: 30000,
    enabled: meQuery.data?.platformAdmin === true,
    retry: false,
  })

  const facetsQuery = useQuery({
    queryKey: ['collection-filter', 'origin-facets'],
    queryFn: () => fetchCatalogFacets(apiFetch),
    enabled: meQuery.data?.platformAdmin === true,
    retry: false,
    refetchInterval: 60000,
  })
  const origins: FilterOrigins = useMemo(() => {
    const rules = [...Object.values(stateQuery.data?.documents ?? {}).flatMap(d => d.rules), ...draft.rules,
      ...(newTypesQuery.data?.items ?? []).map(item => ({ sourceCode: item.source_code, section: item.section,
        canonicalType: item.normalized_type, mode: 'KEEP_ALWAYS' as const, helpText: null }))]
    const sources = new Map((facetsQuery.data?.sources ?? []).map(s => [s.code, s]))
    rules.forEach(r => { if (!sources.has(r.sourceCode)) sources.set(r.sourceCode, { code: r.sourceCode, name: r.sourceCode }) })
    draft.terms.forEach(t => { if(t.sourceCode && !sources.has(t.sourceCode)) sources.set(t.sourceCode, {code:t.sourceCode,name:t.sourceCode}) })
    return { rules, sources: [...sources.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')),
      allTypes: (facetsQuery.data?.actTypes ?? []).map(normalizeFilterText) }
  }, [stateQuery.data, draft.rules, draft.terms, newTypesQuery.data, facetsQuery.data])

  const draftPolicy = useMemo(() => {
    const item = stateQuery.data?.policies.find(
      (policy) => policy.status === 'DRAFT',
    )
    return item
      ? stateQuery.data?.documents[item.id]
      : undefined
  }, [stateQuery.data])

  const approvedPolicy = useMemo(() => {
    const item = stateQuery.data?.policies.find(
      (policy) => policy.status === 'APPROVED',
    )
    return item
      ? stateQuery.data?.documents[item.id]
      : undefined
  }, [stateQuery.data])

  useEffect(() => {
    const source = draftPolicy ?? approvedPolicy
    const id = source?.id ?? 'empty'
    if (loadedPolicyId === id) return
    setDraft(cloneDraft(source))
    setLoadedPolicyId(id)
  }, [draftPolicy, approvedPolicy, loadedPolicyId])

  const save = useMutation({
    mutationFn: () => saveCollectionFilterDraft(apiFetch, draft),
    onSuccess: async () => {
      setLoadedPolicyId(null)
      await queryClient.invalidateQueries({
        queryKey: ['collection-filter', 'state'],
      })
    },
  })

  const simulate = useMutation({
    mutationFn: async () => {
      if (!draftPolicy?.id) throw new Error('draft_not_saved')
      return requestCollectionFilterSimulation(apiFetch, {
        policyId: draftPolicy.id,
        scope: 'FULL_ARCHIVE',
        reviewMode: 'SAMPLE',
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['collection-filter', 'state'],
      })
      setTab('simulations')
    },
  })

  const approve = useMutation({
    mutationFn: async () => {
      if (!draftPolicy?.id) throw new Error('draft_not_saved')
      return approveCollectionFilterDraft(apiFetch, draftPolicy.id)
    },
    onSuccess: async () => {
      setLoadedPolicyId(null)
      await queryClient.invalidateQueries({
        queryKey: ['collection-filter', 'state'],
      })
    },
  })

  const resolveType = useMutation({
    mutationFn: ({
      id,
      status,
      canonicalType,
    }: {
      id: string
      status: 'RESOLVED' | 'MERGED'
      canonicalType: string
    }) =>
      resolveCollectionFilterNewType(
        apiFetch,
        id,
        status,
        canonicalType,
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['collection-filter', 'new-types'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['collection-filter', 'state'],
        }),
      ])
    },
  })

  if (meQuery.isPending) {
    return (
      <main className="cf-loading">
        Verificando acesso administrativo…
      </main>
    )
  }

  if (meQuery.isError || !meQuery.data?.platformAdmin) {
    return (
      <div className="cf-app">
        <main className="cf-denied">
          <ShieldCheck size={30} />
          <h1>Acesso restrito</h1>
          <p>
            O Filtro de Coleta é exclusivo de administradores globais.
          </p>
          <Link to="/painel">Voltar ao painel</Link>
        </main>
      </div>
    )
  }

  const editablePolicyId = (draftPolicy ?? approvedPolicy)?.id ?? 'empty'
  if (stateQuery.isError || !stateQuery.isSuccess || loadedPolicyId !== editablePolicyId) {
    return <div className="cf-app"><main className="cf-denied"><h1>Filtro de Coleta</h1>
      {stateQuery.isError ? <><p role="alert">Não foi possível carregar a política. Tente novamente antes de editar.</p><button type="button" onClick={() => void stateQuery.refetch()}>Tentar novamente</button></> : <p role="status">Carregando a política…</p>}
      <button type="button" disabled>Salvar rascunho</button><Link to="/painel">Voltar ao painel</Link>
    </main></div>
  }

  const dirty = true
  const policyVersion =
    draftPolicy?.version ?? approvedPolicy?.version ?? 0

  return (
    <div className="cf-app">
      <header className="cf-header">
        <Link to="/painel" className="cf-back">
          <ArrowLeft size={16} /> Painel
        </Link>
        <div className="cf-heading">
          <span>Administração da plataforma</span>
          <h1>Filtro de Coleta</h1>
          <p>
            Configure o que o Trifaros mantém antes de persistir novas
            publicações. Tipo desconhecido sempre fica e vai para Novos tipos.
          </p>
        </div>
        <nav aria-label="Áreas administrativas">
          <Link to="/admin/taxonomia">Taxonomia</Link>
          <Link to="/admin/administradores">Administradores</Link>
        </nav>
      </header>

      <main className="cf-main">
        <section className="cf-status-grid">
          <article>
            <span>Política publicada</span>
            <strong>
              {approvedPolicy
                ? `v${approvedPolicy.version} · revisão ${approvedPolicy.revision}`
                : 'Nenhuma'}
            </strong>
          </article>
          <article>
            <span>Rascunho</span>
            <strong>
              {draftPolicy
                ? `v${draftPolicy.version} · revisão ${draftPolicy.revision}`
                : 'Novo'}
            </strong>
          </article>
          <article>
            <span>Novos tipos</span>
            <strong>{stateQuery.data?.newTypesOpen ?? 0}</strong>
          </article>
          <article>
            <span>Regra de segurança</span>
            <strong>Desconhecido = manter</strong>
          </article>
        </section>

        <section className="cf-workflow">
          <div>
            <strong>Fluxo obrigatório</strong>
            <span>Rascunho → Simulação → Aprovação</span>
          </div>
          <div className="cf-actions">
            <button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              <Save size={16} />
              {save.isPending ? 'Salvando…' : 'Salvar rascunho'}
            </button>
            <button
              type="button"
              className="is-secondary"
              onClick={() => simulate.mutate()}
              disabled={!draftPolicy || simulate.isPending}
            >
              <FlaskConical size={16} />
              {simulate.isPending ? 'Solicitando…' : 'Simular acervo'}
            </button>
            <button
              type="button"
              className="is-approve"
              onClick={() => approve.mutate()}
              disabled={!draftPolicy || approve.isPending}
            >
              <CheckCircle2 size={16} />
              {approve.isPending ? 'Aprovando…' : 'Aprovar política'}
            </button>
          </div>
        </section>

        {(save.isError || simulate.isError || approve.isError) && (
          <p className="cf-error" role="alert">
            {errorText(
              save.error ?? simulate.error ?? approve.error,
            )}
          </p>
        )}

        <section className="cf-settings">
          <label>Notas da revisão
            <input placeholder="O que mudou nesta revisão?" value={draft.changeNotes ?? ''}
              onChange={event => setDraft(current => ({ ...current, changeNotes: event.target.value }))} />
          </label>
        </section>

        <nav className="cf-tabs" aria-label="Configuração do filtro">
          {([
            ['types', 'Tipos'],
            ['terms', 'Termos'],
            ['new-types', `Novos tipos (${newTypesQuery.data?.items.length ?? 0})`],
            ['simulations', 'Simulações'],
            ['discarded', 'Desconsiderados'],
            ['discard-alerts', 'Alertas de descarte'],
          ] as Array<[Tab, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={tab === value ? 'is-active' : ''}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'types' && (
          <TypesEditor draft={draft} setDraft={setDraft} origins={origins} apiFetch={apiFetch} />
        )}
        {tab === 'terms' && (
          <TermsEditor draft={draft} setDraft={setDraft} origins={origins} apiFetch={apiFetch} />
        )}
        {tab === 'new-types' && (
          <section className="cf-card">
            <div className="cf-card-title">
              <div>
                <h2>Novos tipos</h2>
                <p>
                  Tipos ainda não configurados são mantidos
                  automaticamente até sua classificação.
                </p>
              </div>
            </div>
            {newTypesQuery.isPending ? (
              <p>Carregando…</p>
            ) : newTypesQuery.isError ? (
              <p className="cf-error">{errorText(newTypesQuery.error)}</p>
            ) : newTypesQuery.data?.items.length ? (
              <div className="cf-list">
                {newTypesQuery.data.items.map((item) => (
                  <article key={item.id} className="cf-new-type">
                    <div>
                      <strong>{item.sample_raw_type}</strong>
                      <span>
                        {item.source_code}
                        {item.section ? ` · ${item.section}` : ''}
                        {' · '}
                        {Number(item.occurrence_count)} ocorrência(s)
                      </span>
                      <small>
                        Primeira: {new Date(item.first_seen_at).toLocaleString('pt-BR')}
                        {' · '}Última: {new Date(item.last_seen_at).toLocaleString('pt-BR')}
                      </small>
                      {item.examples?.length ? (
                        <ul className="cf-example-list">
                          {item.examples.slice(0, 3).map((example) => (
                            <li key={example.id}>
                              {example.officialUrl ? (
                                <a
                                  href={example.officialUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {example.title}
                                </a>
                              ) : (
                                <span>{example.title}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="cf-new-type-resolution">
                      <NewTypeActions item={item} origins={origins} mergeRules={draft.rules} apiFetch={apiFetch}
                        pending={resolveType.isPending}
                        error={resolveType.isError ? errorText(resolveType.error) : null}
                        onResolve={async (status, canonicalType) => { resolveType.reset(); await resolveType.mutateAsync({id:item.id,status,canonicalType}) }}
                        onTerm={term => setDraft(current => ({ ...current,
                          terms: current.terms.some(t => filterTermKey(t) === filterTermKey(term))
                            ? current.terms.map(t => filterTermKey(t) === filterTermKey(term) ? term : t)
                            : [...current.terms, term] }))} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="cf-empty">Nenhum tipo novo pendente.</p>
            )}
          </section>
        )}
        {tab === 'simulations' && (
          <SimulationReviewPanel
            apiFetch={apiFetch}
            simulations={stateQuery.data?.simulations ?? []}
          />
        )}

        {tab === 'discarded' && <CollectionFilterDiscards apiFetch={apiFetch} />}
        {tab === 'discard-alerts' && <CollectionFilterDiscardAlerts apiFetch={apiFetch} />}

        <footer className="cf-footer">
          <span>
            {dirty ? 'Rascunho editável' : 'Sem alterações'}
          </span>
          <span>
            Referência atual: versão {policyVersion || '—'}
          </span>
        </footer>
      </main>
    </div>
  )
}

function SimulationReviewPanel({
  apiFetch,
  simulations,
}: {
  apiFetch: ProductApiFetch
  simulations: CollectionFilterSimulation[]
}) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(
    simulations[0]?.id ?? null,
  )
  const [decision, setDecision] =
    useState<'ALL' | 'KEEP' | 'DISCARD'>('ALL')
  const [sampleOnly, setSampleOnly] = useState(true)
  const [page, setPage] = useState(0)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [expected, setExpected] = useState<
    Record<string, 'KEEP' | 'DISCARD'>
  >({})

  useEffect(() => {
    if (
      selectedId &&
      simulations.some((simulation) => simulation.id === selectedId)
    ) {
      return
    }
    setSelectedId(simulations[0]?.id ?? null)
  }, [selectedId, simulations])

  const selected = simulations.find(
    (simulation) => simulation.id === selectedId,
  )

  useEffect(() => {
    if (!selected) return
    setSampleOnly(selected.review_mode === 'SAMPLE')
    setPage(0)
  }, [selected?.id, selected?.review_mode])

  const itemsQuery = useQuery({
    queryKey: [
      'collection-filter',
      'simulation-items',
      selectedId,
      decision,
      sampleOnly,
      page,
    ],
    queryFn: () =>
      fetchCollectionFilterSimulationItems(
        apiFetch,
        selectedId!,
        {
          ...(decision === 'ALL' ? {} : { decision }),
          sampleOnly,
          limit: 50,
          offset: page * 50,
        },
      ),
    enabled: Boolean(selectedId),
    retry: false,
  })

  const feedback = useMutation({
    mutationFn: (input: {
      publicationId: string
      markedError: boolean
      expectedDecision?: 'KEEP' | 'DISCARD' | null
      note?: string | null
    }) =>
      saveCollectionFilterSimulationFeedback(apiFetch, {
        simulationId: selectedId!,
        ...input,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: [
          'collection-filter',
          'simulation-items',
          selectedId,
        ],
      })
    },
  })

  if (!simulations.length) {
    return (
      <section className="cf-card">
        <div className="cf-card-title">
          <div>
            <h2>Simulações</h2>
            <p>
              Nenhuma simulação solicitada para esta política.
            </p>
          </div>
        </div>
      </section>
    )
  }

  const metrics =
    selected?.metrics &&
    typeof selected.metrics === 'object'
      ? selected.metrics
      : {}

  return (
    <section className="cf-card cf-simulation-review">
      <div className="cf-card-title">
        <div>
          <h2>Simulações</h2>
          <p>
            Revise todos, uma amostra ou nenhum item. Marcar erro
            bloqueia a aprovação da política.
          </p>
        </div>
      </div>

      <div className="cf-simulation-selector">
        <label>
          Execução
          <select
            value={selectedId ?? ''}
            onChange={(event) => {
              setSelectedId(event.target.value)
              setPage(0)
            }}
          >
            {simulations.map((simulation) => (
              <option key={simulation.id} value={simulation.id}>
                {simulation.status} · revisão {simulation.policy_revision} ·{' '}
                {simulation.scope === 'FULL_ARCHIVE'
                  ? 'acervo completo'
                  : 'recentes'}
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <div className="cf-simulation-metrics">
            <span>
              Status <strong>{selected.status}</strong>
            </span>
            <span>
              Inspecionados{' '}
              <strong>{String(metrics.inspected ?? 0)}</strong>
            </span>
            <span>
              KEEP <strong>{String(metrics.keep ?? 0)}</strong>
            </span>
            <span>
              DISCARD <strong>{String(metrics.discard ?? 0)}</strong>
            </span>
            <span>
              Tipo novo{' '}
              <strong>{String(metrics.unknownType ?? 0)}</strong>
            </span>
          </div>
        ) : null}
      </div>

      <div className="cf-review-filters">
        <label>
          Decisão
          <select
            value={decision}
            onChange={(event) => {
              setDecision(
                event.target.value as 'ALL' | 'KEEP' | 'DISCARD',
              )
              setPage(0)
            }}
          >
            <option value="ALL">Todas</option>
            <option value="KEEP">KEEP</option>
            <option value="DISCARD">DISCARD</option>
          </select>
        </label>
        <label className="cf-checkbox">
          <input
            type="checkbox"
            checked={sampleOnly}
            onChange={(event) => {
              setSampleOnly(event.target.checked)
              setPage(0)
            }}
          />
          Somente amostra
        </label>
      </div>

      {selected?.status !== 'COMPLETED' ? (
        <p className="cf-empty">
          A simulação ainda não terminou. Os resultados aparecerão
          quando o Worker concluir o processamento.
        </p>
      ) : itemsQuery.isPending ? (
        <p className="cf-empty">Carregando itens da revisão…</p>
      ) : itemsQuery.isError ? (
        <p className="cf-error">{errorText(itemsQuery.error)}</p>
      ) : (
        <>
          <div className="cf-review-list">
            {(itemsQuery.data?.items ?? []).map((item) => {
              const defaultExpected =
                item.decision === 'KEEP' ? 'DISCARD' : 'KEEP'
              const expectedDecision =
                expected[item.publication_id] ?? defaultExpected
              return (
                <article
                  key={item.publication_id}
                  className={
                    item.marked_error
                      ? 'cf-review-item is-error'
                      : 'cf-review-item'
                  }
                >
                  <div className="cf-review-item-head">
                    <div>
                      <span
                        className={
                          item.decision === 'KEEP'
                            ? 'cf-decision is-keep'
                            : 'cf-decision is-discard'
                        }
                      >
                        {item.decision}
                      </span>
                      <strong>
                        {item.official_url ? (
                          <a
                            href={item.official_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </strong>
                    </div>
                    <code>{item.reason_code}</code>
                  </div>
                  <p className="cf-review-meta">
                    {item.source_code}
                    {item.section ? ` · ${item.section}` : ''}
                    {item.canonical_type
                      ? ` · ${item.canonical_type}`
                      : item.raw_type
                        ? ` · ${item.raw_type}`
                        : ''}
                    {item.decisive_term
                      ? ` · termo: ${item.decisive_term}`
                      : ''}
                  </p>
                  {item.excerpt ? (
                    <blockquote>{item.excerpt}</blockquote>
                  ) : null}

                  <div className="cf-feedback-row">
                    <label>
                      Decisão esperada
                      <select
                        value={expectedDecision}
                        onChange={(event) =>
                          setExpected((current) => ({
                            ...current,
                            [item.publication_id]:
                              event.target.value as
                                | 'KEEP'
                                | 'DISCARD',
                          }))
                        }
                      >
                        <option value="KEEP">KEEP</option>
                        <option value="DISCARD">DISCARD</option>
                      </select>
                    </label>
                    <label>
                      Nota
                      <input
                        value={
                          notes[item.publication_id] ??
                          item.note ??
                          ''
                        }
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [item.publication_id]:
                              event.target.value,
                          }))
                        }
                        placeholder="Motivo da correção"
                      />
                    </label>
                    {item.marked_error ? (
                      <button
                        type="button"
                        onClick={() =>
                          feedback.mutate({
                            publicationId: item.publication_id,
                            markedError: false,
                            expectedDecision: null,
                            note:
                              notes[item.publication_id] ??
                              item.note ??
                              null,
                          })
                        }
                      >
                        Marcar como correto
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="is-danger-quiet"
                        onClick={() =>
                          feedback.mutate({
                            publicationId: item.publication_id,
                            markedError: true,
                            expectedDecision,
                            note:
                              notes[item.publication_id] ??
                              null,
                          })
                        }
                      >
                        Marcar erro
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </div>

          <div className="cf-pagination">
            <button
              type="button"
              disabled={page === 0}
              onClick={() =>
                setPage((current) => Math.max(0, current - 1))
              }
            >
              Anterior
            </button>
            <span>Página {page + 1}</span>
            <button
              type="button"
              disabled={(itemsQuery.data?.items.length ?? 0) < 50}
              onClick={() => setPage((current) => current + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </section>
  )
}
