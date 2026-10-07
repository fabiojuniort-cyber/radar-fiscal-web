import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
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
  type CollectionFilterAlias,
  type CollectionFilterDocument,
  type CollectionFilterMode,
  type CollectionFilterRule,
  type CollectionFilterSimulation,
  type CollectionFilterStrength,
  type CollectionFilterTerm,
} from './collection-filter-api'
import './collection-filter-admin.css'
import { CollectionFilterDiscards, CollectionFilterDiscardAlerts } from './collection-filter-discards'

type Tab = 'types' | 'terms' | 'new-types' | 'simulations' | 'discarded' | 'discard-alerts'
type EditableDocument = Omit<
  CollectionFilterDocument,
  'id' | 'version' | 'revision' | 'status'
>

const MODE_LABELS: Record<CollectionFilterMode, string> = {
  KEEP_ALWAYS: 'Manter sempre',
  KEEP_IF_TAX_TERM: 'Manter só se tiver termo tributário',
  EXCLUDE_UNLESS_STRONG: 'Excluir, salvo termo forte',
  EXCLUDE_ALWAYS: 'Excluir sempre',
}

const STRENGTH_LABELS: Record<CollectionFilterStrength, string> = {
  STRONG: 'Forte',
  WEAK: 'Fraco',
  NEGATIVE: 'Negativo',
}

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
  const [newTypeCanonical, setNewTypeCanonical] = useState<Record<string, string>>({})

  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
  })

  const stateQuery = useQuery({
    queryKey: ['collection-filter', 'state'],
    queryFn: () => fetchCollectionFilterState(apiFetch),
    enabled: meQuery.data?.platformAdmin === true,
    retry: false,
  })

  const newTypesQuery = useQuery({
    queryKey: ['collection-filter', 'new-types'],
    queryFn: () => fetchCollectionFilterNewTypes(apiFetch, 'OPEN'),
    enabled: meQuery.data?.platformAdmin === true,
    retry: false,
  })

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
    const id = draftPolicy?.id ?? 'empty'
    if (loadedPolicyId === id) return
    setDraft(cloneDraft(draftPolicy))
    setLoadedPolicyId(id)
  }, [draftPolicy, loadedPolicyId])

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
          <details>
            <summary>
              <CircleHelp size={16} />
              Como a decisão funciona?
            </summary>
            <p>
              O primeiro nível usa fonte + seção + tipo normalizado. O
              segundo nível usa termos fortes, fracos e negativos. Termos
              no título pesam mais que no corpo. CNPJ, número de processo e
              valor, isoladamente, não preservam um ato.
            </p>
          </details>
          <div className="cf-setting-fields">
            <label>
              Janela de contexto
              <input
                type="number"
                min={0}
                max={100}
                value={draft.contextWindowWords}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    contextWindowWords: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Limiar de termo fraco
              <input
                type="number"
                min={1}
                max={100}
                value={draft.weakScoreThreshold}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    weakScoreThreshold: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              Peso título
              <input
                aria-label="Peso título"
                type="number"
                min={1}
                max={20}
                value={draft.locationWeights.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    locationWeights: {
                      ...current.locationWeights,
                      title: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              Peso ementa
              <input
                aria-label="Peso ementa"
                type="number"
                min={1}
                max={20}
                value={draft.locationWeights.summary}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    locationWeights: {
                      ...current.locationWeights,
                      summary: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              Peso corpo
              <input
                aria-label="Peso corpo"
                type="number"
                min={1}
                max={20}
                value={draft.locationWeights.body}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    locationWeights: {
                      ...current.locationWeights,
                      body: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              Notas da revisão
              <input
                value={draft.changeNotes ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    changeNotes: event.target.value,
                  }))
                }
                placeholder="O que mudou nesta revisão?"
              />
            </label>
          </div>
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
          <TypesEditor draft={draft} setDraft={setDraft} />
        )}
        {tab === 'terms' && (
          <TermsEditor draft={draft} setDraft={setDraft} />
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
                      <input
                        aria-label={`Tipo canônico para ${item.sample_raw_type}`}
                        value={
                          newTypeCanonical[item.id] ??
                          item.normalized_type
                        }
                        onChange={(event) =>
                          setNewTypeCanonical((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                      <div className="cf-row-actions">
                        <button
                          type="button"
                          onClick={() =>
                            resolveType.mutate({
                              id: item.id,
                              status: 'RESOLVED',
                              canonicalType:
                                newTypeCanonical[item.id] ??
                                item.normalized_type,
                            })
                          }
                        >
                          Classificar
                        </button>
                        <button
                          type="button"
                          className="is-secondary-quiet"
                          onClick={() =>
                            resolveType.mutate({
                              id: item.id,
                              status: 'MERGED',
                              canonicalType:
                                newTypeCanonical[item.id] ??
                                item.normalized_type,
                            })
                          }
                        >
                          Mesclar
                        </button>
                        <button
                          type="button"
                          className="is-secondary-quiet"
                          onClick={() => setTab('terms')}
                        >
                          Criar termo
                        </button>
                      </div>
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

function TypesEditor({
  draft,
  setDraft,
}: {
  draft: EditableDocument
  setDraft: React.Dispatch<React.SetStateAction<EditableDocument>>
}) {
  const [sourceCode, setSourceCode] = useState('dou')
  const [section, setSection] = useState('DO1')
  const [canonicalType, setCanonicalType] = useState('')
  const [mode, setMode] =
    useState<CollectionFilterMode>('KEEP_ALWAYS')
  const [alias, setAlias] = useState('')

  const addRule = (event: FormEvent) => {
    event.preventDefault()
    const type = canonicalType.trim()
    if (!type) return
    const rule: CollectionFilterRule = {
      sourceCode: sourceCode.trim(),
      section: section.trim(),
      canonicalType: type,
      mode,
      helpText: null,
    }
    setDraft((current) => ({
      ...current,
      rules: [...current.rules, rule],
    }))
    setCanonicalType('')
  }

  const addAlias = (event: FormEvent) => {
    event.preventDefault()
    if (!alias.trim() || !canonicalType.trim()) return
    const value: CollectionFilterAlias = {
      sourceCode: sourceCode.trim(),
      section: section.trim(),
      alias: alias.trim(),
      canonicalType: canonicalType.trim(),
    }
    setDraft((current) => ({
      ...current,
      aliases: [...current.aliases, value],
    }))
    setAlias('')
  }

  return (
    <section className="cf-card">
      <div className="cf-card-title">
        <div>
          <h2>Tipos de ato</h2>
          <p>
            A chave é fonte + seção + tipo canônico. A grafia original
            continua preservada na publicação.
          </p>
        </div>
      </div>

      <form className="cf-inline-form" onSubmit={addRule}>
        <input
          aria-label="Fonte do tipo"
          value={sourceCode}
          onChange={(event) => setSourceCode(event.target.value)}
          placeholder="fonte"
        />
        <input
          aria-label="Seção do tipo"
          value={section}
          onChange={(event) => setSection(event.target.value)}
          placeholder="seção"
        />
        <input
          aria-label="Tipo canônico"
          value={canonicalType}
          onChange={(event) => setCanonicalType(event.target.value)}
          placeholder="Tipo canônico"
        />
        <select
          aria-label="Modo do tipo"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as CollectionFilterMode)
          }
        >
          {Object.entries(MODE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit">
          <Plus size={15} /> Adicionar
        </button>
      </form>

      <div className="cf-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fonte</th>
              <th>Seção</th>
              <th>Tipo</th>
              <th>Modo</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {draft.rules.map((rule, index) => (
              <tr key={`${rule.sourceCode}-${rule.section}-${rule.canonicalType}-${index}`}>
                <td>{rule.sourceCode}</td>
                <td>{rule.section || '—'}</td>
                <td>{rule.canonicalType}</td>
                <td>
                  <select
                    aria-label={`Modo ${rule.canonicalType}`}
                    value={rule.mode}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        rules: current.rules.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                mode: event.target
                                  .value as CollectionFilterMode,
                              }
                            : item,
                        ),
                      }))
                    }
                  >
                    {Object.entries(MODE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </td>
                <td>
                  <button
                    type="button"
                    className="cf-icon-button"
                    aria-label={`Remover ${rule.canonicalType}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        rules: current.rules.filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="cf-aliases">
        <summary>Variações de grafia ({draft.aliases.length})</summary>
        <form className="cf-inline-form" onSubmit={addAlias}>
          <input
            value={sourceCode}
            onChange={(event) => setSourceCode(event.target.value)}
            aria-label="Fonte do alias"
          />
          <input
            value={section}
            onChange={(event) => setSection(event.target.value)}
            aria-label="Seção do alias"
          />
          <input
            value={alias}
            onChange={(event) => setAlias(event.target.value)}
            placeholder="Grafia encontrada"
            aria-label="Grafia encontrada"
          />
          <input
            value={canonicalType}
            onChange={(event) => setCanonicalType(event.target.value)}
            placeholder="Tipo canônico"
            aria-label="Tipo canônico do alias"
          />
          <button type="submit">Adicionar alias</button>
        </form>
        <div className="cf-chip-list">
          {draft.aliases.map((item, index) => (
            <span key={`${item.alias}-${index}`} className="cf-chip">
              {item.alias} → {item.canonicalType}
              <button
                type="button"
                aria-label={`Remover alias ${item.alias}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    aliases: current.aliases.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  }))
                }
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </details>
    </section>
  )
}

function TermsEditor({
  draft,
  setDraft,
}: {
  draft: EditableDocument
  setDraft: React.Dispatch<React.SetStateAction<EditableDocument>>
}) {
  const [text, setText] = useState('')
  const [strength, setStrength] =
    useState<CollectionFilterStrength>('WEAK')
  const [sourceCode, setSourceCode] = useState('')
  const [canonicalType, setCanonicalType] = useState('')

  const addTerm = (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    const term: CollectionFilterTerm = {
      text: text.trim(),
      strength,
      sourceCode: sourceCode.trim() || undefined,
      canonicalType: canonicalType.trim() || undefined,
      locationScope: 'ANY',
    }
    setDraft((current) => ({
      ...current,
      terms: [...current.terms, term],
    }))
    setText('')
  }

  return (
    <section className="cf-card">
      <div className="cf-card-title">
        <div>
          <h2>Termos tributários</h2>
          <p>
            Termos do filtro são independentes da Taxonomia. Forte
            preserva, fraco soma evidência e negativo neutraliza falso
            positivo próximo.
          </p>
        </div>
      </div>

      <form className="cf-inline-form cf-term-form" onSubmit={addTerm}>
        <input
          aria-label="Texto do termo"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Termo"
        />
        <select
          aria-label="Força do termo"
          value={strength}
          onChange={(event) =>
            setStrength(event.target.value as CollectionFilterStrength)
          }
        >
          {Object.entries(STRENGTH_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          aria-label="Fonte do termo"
          value={sourceCode}
          onChange={(event) => setSourceCode(event.target.value)}
          placeholder="Fonte (opcional)"
        />
        <input
          aria-label="Tipo do termo"
          value={canonicalType}
          onChange={(event) => setCanonicalType(event.target.value)}
          placeholder="Tipo (opcional)"
        />
        <button type="submit">
          <Plus size={15} /> Adicionar
        </button>
      </form>

      <div className="cf-chip-list cf-term-list">
        {draft.terms.map((term, index) => (
          <span
            key={`${term.text}-${term.strength}-${index}`}
            className={`cf-chip is-${term.strength.toLowerCase()}`}
          >
            <strong>{STRENGTH_LABELS[term.strength]}</strong>
            {term.text}
            {term.sourceCode ? ` · ${term.sourceCode}` : ''}
            {term.canonicalType ? ` · ${term.canonicalType}` : ''}
            <button
              type="button"
              aria-label={`Remover termo ${term.text}`}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  terms: current.terms.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                }))
              }
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="cf-warning">
        <AlertTriangle size={18} />
        <p>
          CNPJ, número de processo e valor não podem ser configurados como
          termos positivos autônomos. O backend bloqueia essa combinação.
        </p>
      </div>
    </section>
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
