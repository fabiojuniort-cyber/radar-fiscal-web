import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Building2,
  Check,
  ChevronDown,
  FileText,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  Trash2,
} from 'lucide-react'
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Link } from 'react-router-dom'

import type { PanelIdentity } from './panel-experience'
import {
  formatLastSuccessAt,
  formatPublicDate,
  type PublicSource,
} from './public-api'
import {
  fetchPublicSourcesV2,
  fetchPublicStatsV2,
} from './public-api-v2'
import {
  fetchCatalogArchive,
  fetchCatalogFacets,
} from './catalog-api'
import { paginationTokens } from './pagination'
import {
  createCompanyFromCnpj,
  createEstablishmentFromCnpj,
  deleteCompany,
  deleteEstablishment,
  fetchAccountSummary,
  fetchMonitoringRuns,
  fetchEstablishmentTypes,
  fetchEstablishments,
  fetchTaxProfile,
  fetchTaxonomyProfileOptions,
  refreshEstablishmentCnpj,
  saveTaxProfile,
  updateCompany,
  updateEstablishment,
  type AccountCompany,
  type Establishment,
  type EstablishmentCnae,
  type MonitoringRun,
  type ProductApiFetch,
  type ProductArchiveItem,
  type TaxonomyProfileDimension,
  type TaxonomyProfileOptions,
} from './product-api'
import './panel-experience.css'
import './authenticated-product-panel.css'

type Screen =
  | 'inicio'
  | 'publicacoes'
  | 'acervo'
  | 'central'
  | 'noticias'
  | 'empresas'
  | 'config'

type OrgTab =
  | 'empresa'
  | 'estabelecimentos'
  | 'perfil'

type Props = {
  identity: PanelIdentity
  apiFetch: ProductApiFetch
  onExit: () => void | Promise<void>
  exitError?: string | null
}

const tabs: Array<{
  key: Screen
  label: string
}> = [
  { key: 'inicio', label: 'Início' },
  { key: 'publicacoes', label: 'Publicações' },
  { key: 'acervo', label: 'Acervo' },
  { key: 'noticias', label: 'Notícias' },
  {
    key: 'central',
    label: 'Central de Monitoramento',
  },
  { key: 'empresas', label: 'Empresas' },
]

const ALL_UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES',
  'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]

const PROFILE_DIMENSION_CODES = new Set([
  'tax',
  'regime',
  'operation',
  'operation_purpose',
  'document',
  'obligation',
  'sector',
  'product',
])

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

function firstName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'você'
  if (normalized.includes('@')) {
    return normalized.split('@')[0] || 'você'
  }
  return normalized.split(/\s+/)[0] || 'você'
}

function initials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) return 'TB'
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return (
    parts[0][0] +
    parts[parts.length - 1][0]
  ).toUpperCase()
}

function readPanelState() {
  try {
    const raw = sessionStorage.getItem('tribusca.panel.state')
    if (!raw) return null
    return JSON.parse(raw) as {
      screen?: Screen
      query?: string
      appliedQuery?: string
      archivePage?: number
      jurisdiction?: string
      uf?: string
      source?: string
      orgTab?: OrgTab
      selectedCompanyId?: string
    }
  } catch {
    return null
  }
}

function LoadingState({
  text = 'Carregando…',
}: {
  text?: string
}) {
  return (
    <div className="tp-empty-state">
      <span className="tp-empty-mark">
        <RefreshCw size={17} />
      </span>
      <div>
        <strong>{text}</strong>
      </div>
    </div>
  )
}

function ErrorState({
  title = 'Não foi possível carregar os dados',
}: {
  title?: string
}) {
  return (
    <div className="tp-empty-state is-error">
      <span className="tp-empty-mark">!</span>
      <div>
        <strong>{title}</strong>
        <p>Tente novamente em instantes.</p>
      </div>
    </div>
  )
}

function EmptyState({
  title,
  children,
}: {
  title: string
  children: string
}) {
  return (
    <div className="tp-empty-state">
      <span className="tp-empty-mark">—</span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: string
  description: string
}) {
  return (
    <div className="tp-section-heading">
      {eyebrow && (
        <span className="tp-eyebrow">
          {eyebrow}
        </span>
      )}
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

function publicationReference(
  item: ProductArchiveItem,
) {
  const reference = [
    item.actType,
    item.actNumber,
  ]
    .filter(Boolean)
    .join(' ')

  return reference || item.title
}

function PublicationList({
  items,
  compact = false,
}: {
  items: ProductArchiveItem[]
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nenhuma publicação encontrada"
      >
        Não há publicação para este recorte.
      </EmptyState>
    )
  }

  return (
    <div className="tp-list-card">
      {items.map((item) => {
        const reference = publicationReference(item)
        return (
          <Link
            className="tp-publication-row tp-publication-link"
            to={'/painel/publicacoes/' + item.id}
            key={item.id}
            aria-label={'Abrir legislação: ' + reference}
          >
            <FileText size={17} aria-hidden="true" />
            <span className="tp-publication-copy">
              <span className="tp-publication-meta">
                {item.sourceName && <b>{item.sourceName}</b>}
                <span>
                  {item.agency ?? 'Órgão não informado'} ·{' '}
                  {formatPublicDate(item.publishedOn)}
                </span>
              </span>
              <strong>{reference}</strong>
              {!compact && reference !== item.title && (
                <span className="tp-publication-title">
                  {item.title}
                </span>
              )}
              <span className="tp-publication-tags">
                {item.uf ?? 'Federal'}
                {item.effectiveOn
                  ? ' · Vigência ' + formatPublicDate(item.effectiveOn)
                  : ''}
              </span>
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function sourceState(source: PublicSource) {
  if (source.status === 'ONLINE') {
    return source.importedToday > 0 ? 'ok' : 'none'
  }
  if (source.status === 'UNSTABLE') return 'partial'
  if (source.status === 'UNAVAILABLE') return 'down'
  return 'none'
}

function sourceLabel(source: PublicSource) {
  switch (source.status) {
    case 'ONLINE':
      return source.importedToday > 0
        ? source.importedToday +
            ' importada' +
            (source.importedToday === 1 ? '' : 's') +
            ' hoje'
        : 'Consultada, sem nova publicação hoje'
    case 'UNSTABLE':
      return 'Sucesso parcial / instável'
    case 'UNAVAILABLE':
      return 'Fonte indisponível ou com falha'
    case 'NOT_CONSULTED':
      return 'Ainda não consultada'
  }
}

function SourceHealth({
  items,
  compact = false,
}: {
  items: PublicSource[]
  compact?: boolean
}) {
  if (items.length === 0) {
    return (
      <EmptyState title="Nenhuma fonte retornada">
        Nenhuma fonte cadastrada.
      </EmptyState>
    )
  }

  return (
    <div className={compact ? 'tp-source-health is-compact' : 'tp-source-health'}>
      {items.map((source) => (
        <div
          className={'tp-source-health-row is-' + sourceState(source)}
          key={source.code}
        >
          <span className="tp-source-dot" />
          <strong>{source.name}</strong>
          <span>
            <b>{sourceLabel(source)}</b>
            <small>
              {source.lastSuccessAt
                ? 'Último sucesso ' + formatLastSuccessAt(source.lastSuccessAt)
                : source.lastAttemptAt
                  ? 'Última tentativa ' + formatLastSuccessAt(source.lastAttemptAt)
                  : 'Sem execução registrada'}
            </small>
          </span>
          {!compact && (
            <em>{source.totalPublications} no Acervo</em>
          )}
        </div>
      ))}
    </div>
  )
}

// Global catalog aggregates refresh at collection cadence (backend caches them
// for 60 s too); refetching them on every panel mount only adds load.
const CATALOG_AGGREGATE_STALE_MS = 5 * 60_000

export function AuthenticatedProductPanel({
  identity,
  apiFetch,
  onExit,
  exitError,
}: Props) {
  const queryClient = useQueryClient()
  const persisted = readPanelState()
  const [selectedTenantId, setSelectedTenantId] =
    useState(identity.memberships?.[0]?.tenantId ?? '')
  const membership =
    identity.memberships?.find(
      (item) => item.tenantId === selectedTenantId,
    ) ?? identity.memberships?.[0]
  const tenantId = membership?.tenantId
  const displayName =
    identity.name || identity.email || 'Usuário TriBusca'
  const tenantName = membership?.tenantName ?? 'Conta TriBusca'

  const [screen, setScreen] = useState<Screen>(persisted?.screen ?? 'inicio')
  const [query, setQuery] = useState(persisted?.query ?? '')
  const [appliedQuery, setAppliedQuery] = useState(persisted?.appliedQuery ?? '')
  const [archivePage, setArchivePage] = useState(persisted?.archivePage ?? 1)
  const [jurisdiction, setJurisdiction] = useState(persisted?.jurisdiction ?? '')
  const [uf, setUf] = useState(persisted?.uf ?? '')
  const [source, setSource] = useState(persisted?.source ?? '')
  const [orgTab, setOrgTab] = useState<OrgTab>(persisted?.orgTab ?? 'empresa')
  const [userMenu, setUserMenu] = useState(false)
  const [tenantMenu, setTenantMenu] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] =
    useState(persisted?.selectedCompanyId ?? '')
  const [runHistorySource, setRunHistorySource] = useState<string | null>(null)

  useEffect(() => {
    sessionStorage.setItem(
      'tribusca.panel.state',
      JSON.stringify({
        screen,
        query,
        appliedQuery,
        archivePage,
        jurisdiction,
        uf,
        source,
        orgTab,
        selectedCompanyId,
      }),
    )
  }, [
    screen,
    query,
    appliedQuery,
    archivePage,
    jurisdiction,
    uf,
    source,
    orgTab,
    selectedCompanyId,
  ])

  useEffect(() => {
    setSelectedCompanyId('')
    setOrgTab('empresa')
  }, [tenantId])

  const sourcesQuery = useQuery({
    queryKey: ['launch', 'sources-v2'],
    queryFn: ({ signal }) => fetchPublicSourcesV2(signal),
    retry: false,
    staleTime: CATALOG_AGGREGATE_STALE_MS,
  })

  const statsQuery = useQuery({
    queryKey: ['launch', 'stats-v2'],
    queryFn: ({ signal }) => fetchPublicStatsV2(signal),
    retry: false,
    staleTime: CATALOG_AGGREGATE_STALE_MS,
  })

  const monitoringRunsQuery = useQuery({
    queryKey: ['launch', 'monitoring-runs', tenantId],
    queryFn: () => fetchMonitoringRuns(apiFetch, tenantId!),
    enabled: Boolean(tenantId),
    retry: false,
    refetchInterval: 60_000,
  })

  const facetsQuery = useQuery({
    queryKey: ['launch', 'archive-facets'],
    queryFn: () => fetchCatalogFacets(apiFetch),
    retry: false,
    staleTime: CATALOG_AGGREGATE_STALE_MS,
  })

  const latestArchiveQuery = useQuery({
    queryKey: ['launch', 'archive-v2', 'latest'],
    queryFn: () => fetchCatalogArchive(apiFetch, { page: 1, limit: 5 }),
    retry: false,
  })

  const archiveQuery = useQuery({
    queryKey: [
      'launch',
      'archive-v2',
      appliedQuery,
      jurisdiction,
      uf,
      source,
      archivePage,
    ],
    queryFn: () =>
      fetchCatalogArchive(apiFetch, {
        q: appliedQuery.trim().length >= 2
          ? appliedQuery.trim()
          : undefined,
        jurisdiction:
          jurisdiction === 'FEDERAL' || jurisdiction === 'STATE'
            ? jurisdiction
            : undefined,
        uf: uf || undefined,
        source: source || undefined,
        page: archivePage,
        limit: 25,
      }),
    retry: false,
  })

  const accountQuery = useQuery({
    queryKey: ['launch', 'account', tenantId],
    queryFn: () => fetchAccountSummary(apiFetch, tenantId!),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const archiveItems = archiveQuery.data?.items ?? []
  const latestPublications = latestArchiveQuery.data?.items ?? []
  const sources = sourcesQuery.data?.items ?? []
  const stats = statsQuery.data
  const account = accountQuery.data
  const selectedCompany =
    account?.companies.find(
      (company) => company.id === selectedCompanyId,
    ) ?? account?.companies[0]

  const establishmentsQuery = useQuery({
    queryKey: ['launch', 'establishments', tenantId, selectedCompany?.id],
    queryFn: () =>
      fetchEstablishments(apiFetch, tenantId!, selectedCompany!.id),
    enabled: Boolean(tenantId && selectedCompany?.id),
    retry: false,
  })

  const typesQuery = useQuery({
    queryKey: ['launch', 'establishment-types'],
    queryFn: () => fetchEstablishmentTypes(apiFetch),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const profileQuery = useQuery({
    queryKey: ['launch', 'tax-profile', tenantId, selectedCompany?.id],
    queryFn: () => fetchTaxProfile(apiFetch, tenantId!, selectedCompany!.id),
    enabled: Boolean(tenantId && selectedCompany?.id),
    retry: false,
  })

  const taxonomyOptionsQuery = useQuery({
    queryKey: ['launch', 'taxonomy-profile-options', tenantId],
    queryFn: () => fetchTaxonomyProfileOptions(apiFetch, tenantId!),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setAppliedQuery(query.trim())
    setArchivePage(1)
    setScreen('acervo')
  }

  const resetArchiveFilters = () => {
    setQuery('')
    setAppliedQuery('')
    setJurisdiction('')
    setUf('')
    setSource('')
    setArchivePage(1)
  }

  const unavailable = sources.filter((item) => item.status === 'UNAVAILABLE').length
  const unstable = sources.filter((item) => item.status === 'UNSTABLE').length
  const consulted = sources.filter((item) => item.status !== 'NOT_CONSULTED').length

  return (
    <div className="tp-app" data-panel-mode="authenticated">
      <header className="tp-header">
        <div className="tp-header-primary">
          <img
            src="/brand/tribusca-logo-horizontal-light.png"
            alt="TriBusca"
            className="tp-logo"
          />

          <div className="tp-pop-wrap">
            <button
              className="tp-company-button"
              type="button"
              aria-label="Selecionar empresa ativa"
              aria-expanded={tenantMenu}
              onClick={() => {
                setTenantMenu((value) => !value)
                setUserMenu(false)
              }}
            >
              <span className="tp-company-copy">
                <small>Empresa ativa</small>
                <strong>
                  {selectedCompany?.tradeName ||
                    selectedCompany?.legalName ||
                    'Nenhuma empresa cadastrada'}
                </strong>
                <span>
                  {selectedCompany
                    ? selectedCompany.establishmentCount +
                      ' estabelecimento' +
                      (selectedCompany.establishmentCount === 1 ? '' : 's')
                    : 'Cadastre um CNPJ'}
                </span>
              </span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>

            {tenantMenu && (
              <div className="tp-popover tp-company-popover">
                <span className="tp-pop-label">Empresa ativa</span>
                {(account?.companies ?? []).length > 0 ? (
                  (account?.companies ?? []).map((company) => (
                    <button
                      type="button"
                      className={company.id === selectedCompany?.id ? 'is-selected' : undefined}
                      key={company.id}
                      onClick={() => {
                        setSelectedCompanyId(company.id)
                        setTenantMenu(false)
                      }}
                    >
                      <b>{company.tradeName || company.legalName}</b>
                      <span>
                        {formatCnpj(company.cnpj)} · {company.establishmentCount} estabelecimento
                        {company.establishmentCount === 1 ? '' : 's'}
                      </span>
                    </button>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('empresas')
                      setOrgTab('empresa')
                      setTenantMenu(false)
                    }}
                  >
                    <b>Cadastrar empresa</b>
                    <span>Informe o CNPJ da matriz</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <form className="tp-global-search" onSubmit={submitSearch}>
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar no Acervo"
              aria-label="Buscar no Acervo"
            />
          </form>

          <div className="tp-pop-wrap tp-user-wrap">
            <button
              className="tp-user-button"
              type="button"
              aria-label="Menu do usuário"
              aria-expanded={userMenu}
              onClick={() => {
                setUserMenu((value) => !value)
                setTenantMenu(false)
              }}
            >
              <span>{initials(displayName)}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>

            {userMenu && (
              <div className="tp-popover tp-user-popover">
                <div className="tp-user-summary">
                  <strong>{displayName}</strong>
                  <span>{identity.email ?? '—'}</span>
                  <small>
                    Conta: {tenantName} · {membership?.role ?? 'Usuário'}
                  </small>
                </div>
                {(identity.memberships ?? []).length > 1 && (
                  <div className="tp-tenant-switch">
                    <span className="tp-pop-label">Trocar conta</span>
                    {(identity.memberships ?? []).map((item) => (
                      <button
                        type="button"
                        className={item.tenantId === tenantId ? 'is-selected' : undefined}
                        key={item.tenantId}
                        onClick={() => {
                          setSelectedTenantId(item.tenantId)
                          setUserMenu(false)
                        }}
                      >
                        <b>{item.tenantName}</b>
                        <span>{item.role}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="tp-user-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setScreen('config')
                      setUserMenu(false)
                    }}
                  >
                    <Settings size={16} />
                    Abrir configurações
                  </button>
                  <button type="button" onClick={() => void onExit()}>
                    <LogOut size={16} />
                    Sair da conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="tp-tabs" aria-label="Navegação do painel">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={screen === tab.key ? 'page' : undefined}
              onClick={() => setScreen(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {exitError && (
        <div className="tp-error-banner" role="alert">
          {exitError}
        </div>
      )}

      <main className={'tp-main tp-main-' + screen}>
        {screen === 'inicio' && (
          <>
            <div className="tp-welcome-row">
              <div>
                <span>
                  {new Intl.DateTimeFormat('pt-BR', {
                    dateStyle: 'full',
                  }).format(new Date())}
                </span>
                <h1>Olá, {firstName(displayName)}.</h1>
              </div>
            </div>

            <form className="tp-search-hero" onSubmit={submitSearch}>
              <span className="tp-hero-label">Buscar no Acervo</span>
              <div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Ex.: ICMS, NF-e, CONFAZ"
                  aria-label="Consulta rápida no Acervo"
                />
                <button type="submit">Buscar no Acervo</button>
              </div>
            </form>

            {statsQuery.isPending ? (
              <LoadingState />
            ) : statsQuery.isError ? (
              <ErrorState />
            ) : (
              <section className="tp-metrics" aria-label="Indicadores">
                <article>
                  <span>Fontes previstas</span>
                  <strong>{stats?.totalSources ?? 0}</strong>
                </article>
                <article>
                  <span>Fontes ativas</span>
                  <strong>{stats?.activeSources ?? 0}</strong>
                </article>
                <article>
                  <span>Publicações no Acervo</span>
                  <strong>{stats?.totalPublications ?? 0}</strong>
                </article>
                <article>
                  <span>Importadas hoje</span>
                  <strong>{stats?.importedToday ?? 0}</strong>
                </article>
              </section>
            )}

            <div className="tp-home-grid">
              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span>
                    <b>Últimas publicações</b>
                    <small>Mais recentes primeiro</small>
                  </span>
                  <button type="button" onClick={() => setScreen('publicacoes')}>
                    Ver publicações
                  </button>
                </div>
                {latestArchiveQuery.isPending ? (
                  <LoadingState />
                ) : latestArchiveQuery.isError ? (
                  <ErrorState />
                ) : (
                  <PublicationList items={latestPublications} compact />
                )}
              </section>

              <aside className="tp-home-rail">
                <section className="tp-panel-card tp-rail-card">
                  <div className="tp-card-head">
                    <span>
                      <b>Saúde das fontes</b>
                      <small>Últimas consultas</small>
                    </span>
                    <button type="button" onClick={() => setScreen('central')}>
                      Abrir Central
                    </button>
                  </div>
                  {sourcesQuery.isPending ? (
                    <LoadingState />
                  ) : sourcesQuery.isError ? (
                    <ErrorState />
                  ) : (
                    <SourceHealth items={sources.slice(0, 6)} compact />
                  )}
                </section>

                <section className="tp-panel-card tp-rail-card">
                  <div className="tp-card-head">
                    <span>
                      <b>Empresas</b>
                      <small>Cadastro e perfil tributário</small>
                    </span>
                    <button type="button" onClick={() => setScreen('empresas')}>
                      Abrir empresas
                    </button>
                  </div>
                  {accountQuery.isPending ? (
                    <LoadingState />
                  ) : accountQuery.isError ? (
                    <ErrorState />
                  ) : (
                    <div className="launch-account-summary">
                      <strong>{account?.companies.length ?? 0} empresa(s)</strong>
                      <span>
                        {selectedCompany
                          ? selectedCompany.establishmentCount + ' estabelecimento(s)'
                          : 'Cadastre uma empresa para configurar o perfil tributário.'}
                      </span>
                    </div>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}

        {screen === 'publicacoes' && (
          <>
            <SectionHeading
              title="Publicações"
              description="Publicações mais recentes do Acervo, ordenadas pela data oficial de publicação."
            />
            {archiveQuery.isPending ? (
              <LoadingState />
            ) : archiveQuery.isError ? (
              <ErrorState />
            ) : (
              <PublicationList items={archiveItems} />
            )}
          </>
        )}

        {screen === 'acervo' && (
          <>
            <SectionHeading
              eyebrow="Pesquisa"
              title="Acervo"
              description="Pesquise por esfera, UF, fonte e conteúdo."
            />

            <form className="tp-acervo-search" onSubmit={submitSearch}>
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Título, número, órgão, NCM ou termo"
                aria-label="Pesquisar no Acervo"
              />
              <button type="submit">Buscar no Acervo</button>
            </form>

            <div className="tp-acervo-layout">
              <aside className="tp-filter-panel">
                <b>Filtros</b>
                <label>
                  Esfera
                  <select
                    value={jurisdiction}
                    onChange={(event) => {
                      setJurisdiction(event.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="">Todas</option>
                    <option value="FEDERAL">Federal</option>
                    <option value="STATE">Estadual</option>
                  </select>
                </label>
                <label>
                  UF
                  <select
                    value={uf}
                    onChange={(event) => {
                      setUf(event.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="">Todas</option>
                    {(facetsQuery.data?.ufs ?? []).map((item) => (
                      <option value={item} key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Fonte
                  <select
                    value={source}
                    onChange={(event) => {
                      setSource(event.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="">Todas</option>
                    {(facetsQuery.data?.sources ?? []).map((item) => (
                      <option value={item.code} key={item.code}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="launch-secondary-button"
                  type="button"
                  onClick={resetArchiveFilters}
                >
                  Limpar filtros
                </button>
              </aside>

              <section>
                {archiveQuery.isPending ? (
                  <LoadingState />
                ) : archiveQuery.isError ? (
                  <ErrorState />
                ) : (
                  <>
                    <PublicationList items={archiveItems} />
                    <div className="launch-pagination" aria-label="Paginação do Acervo">
                      <button
                        type="button"
                        disabled={archivePage <= 1}
                        onClick={() => setArchivePage((page) => Math.max(1, page - 1))}
                      >
                        Voltar página
                      </button>
                      <div className="tp-page-numbers">
                        {paginationTokens(
                          archivePage,
                          archiveQuery.data?.totalPages ?? 1,
                        ).map((token, index) =>
                          token === 'ellipsis' ? (
                            <span key={'ellipsis-' + index}>…</span>
                          ) : (
                            <button
                              key={token}
                              type="button"
                              className={token === archivePage ? 'is-current' : ''}
                              aria-current={token === archivePage ? 'page' : undefined}
                              onClick={() => setArchivePage(token)}
                            >
                              {token}
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!archiveQuery.data?.hasMore}
                        onClick={() => setArchivePage((page) => page + 1)}
                      >
                        Avançar página
                      </button>
                    </div>
                    <p className="tp-pagination-summary">
                      Página {archivePage} de {archiveQuery.data?.totalPages ?? 1} ·{' '}
                      {archiveQuery.data?.totalItems ?? 0} publicações
                    </p>
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {screen === 'noticias' && (
          <NewsSection />
        )}

        {screen === 'central' && (
          <>
            <SectionHeading
              eyebrow="Saúde operacional"
              title="Central de Monitoramento"
              description="Acompanhe a situação das fontes, as execuções e os documentos importados nas últimas 24 horas."
            />
            {sourcesQuery.isPending || monitoringRunsQuery.isPending ? (
              <LoadingState />
            ) : sourcesQuery.isError || monitoringRunsQuery.isError ? (
              <ErrorState />
            ) : (
              <MonitoringCenter
                sources={sources}
                runs={monitoringRunsQuery.data?.items ?? []}
                consulted={consulted}
                unavailable={unavailable}
                unstable={unstable}
                expandedSource={runHistorySource}
                onToggleSource={(code) =>
                  setRunHistorySource((current) => current === code ? null : code)
                }
              />
            )}
          </>
        )}

        {screen === 'empresas' && (
          <>
            <div className="tp-company-context-head">
              <span>
                Empresa ativa
                {selectedCompany
                  ? ' · ' + selectedCompany.establishmentCount + ' estabelecimento' +
                    (selectedCompany.establishmentCount === 1 ? '' : 's')
                  : ''}
              </span>
              <h1>{selectedCompany?.legalName ?? 'Empresas da conta'}</h1>
            </div>

            <div className="tp-org-tabs" role="tablist" aria-label="Organização">
              <button
                type="button"
                role="tab"
                aria-selected={orgTab === 'empresa'}
                onClick={() => setOrgTab('empresa')}
              >
                <b>1</b> Empresas
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={orgTab === 'estabelecimentos'}
                onClick={() => setOrgTab('estabelecimentos')}
              >
                <b>2</b> Estabelecimentos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={orgTab === 'perfil'}
                onClick={() => setOrgTab('perfil')}
              >
                <b>3</b> Perfil tributário
              </button>
            </div>

            {!tenantId ? (
              <ErrorState title="Conta sem tenant ativo" />
            ) : accountQuery.isPending ? (
              <LoadingState />
            ) : accountQuery.isError ? (
              <ErrorState />
            ) : orgTab === 'empresa' ? (
              <CompanySection
                apiFetch={apiFetch}
                tenantId={tenantId}
                account={account!}
                selectedCompanyId={selectedCompany?.id ?? ''}
                onSelect={setSelectedCompanyId}
                onOpenEstablishments={() => setOrgTab('estabelecimentos')}
                onOpenProfile={() => setOrgTab('perfil')}
                onChanged={() => {
                  void queryClient.invalidateQueries({ queryKey: ['launch', 'account', tenantId] })
                  void queryClient.invalidateQueries({ queryKey: ['launch', 'establishments'] })
                }}
              />
            ) : !selectedCompany ? (
              <EmptyState title="Cadastre a empresa primeiro">
                O Perfil Tributário e os estabelecimentos dependem da empresa.
              </EmptyState>
            ) : orgTab === 'estabelecimentos' ? (
              <EstablishmentSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                companyId={selectedCompany.id}
                companyCnpj={selectedCompany.cnpj}
                items={establishmentsQuery.data ?? []}
                types={typesQuery.data ?? []}
                loading={establishmentsQuery.isPending || typesQuery.isPending}
                error={establishmentsQuery.isError || typesQuery.isError}
                onChanged={() => {
                  void queryClient.invalidateQueries({ queryKey: ['launch', 'establishments'] })
                  void queryClient.invalidateQueries({ queryKey: ['launch', 'account'] })
                }}
              />
            ) : (
              <TaxProfileSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                company={selectedCompany}
                establishments={establishmentsQuery.data ?? []}
                profile={profileQuery.data ?? null}
                taxonomyOptions={taxonomyOptionsQuery.data ?? { release: null, dimensions: [] }}
                loading={
                  profileQuery.isPending ||
                  establishmentsQuery.isPending ||
                  taxonomyOptionsQuery.isPending
                }
                error={
                  profileQuery.isError ||
                  establishmentsQuery.isError ||
                  taxonomyOptionsQuery.isError
                }
                onChanged={() =>
                  void queryClient.invalidateQueries({ queryKey: ['launch', 'tax-profile'] })
                }
              />
            )}
          </>
        )}

        {screen === 'config' && (
          <>
            <SectionHeading
              eyebrow="Conta"
              title="Configurações"
              description="Dados da conta e do acesso atual."
            />
            <div className="tp-settings-grid">
              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span><b>Usuário</b><small>Conta e acesso</small></span>
                </div>
                <div className="tp-settings-body">
                  <label>Nome<strong>{displayName}</strong></label>
                  <label>E-mail<strong>{identity.email ?? '—'}</strong></label>
                  <label>Conta<strong>{tenantName}</strong></label>
                  <label>Papel<strong>{membership?.role ?? '—'}</strong></label>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function NewsSection() {
  return (
    <>
      <SectionHeading
        eyebrow="Inteligência tributária"
        title="Notícias"
        description="Notícias oficiais selecionadas por relevância tributária, documentos fiscais e Reforma Tributária."
      />
      <div className="tp-panel-card tp-news-placeholder">
        <div className="tp-card-head">
          <span>
            <b>Receita Federal</b>
            <small>Coleta oficial em configuração</small>
          </span>
        </div>
        <EmptyState title="Fonte preparada">
          A página já está disponível. O conector de notícias será alimentado pela Receita Federal e demais fontes oficiais selecionadas.
        </EmptyState>
      </div>
    </>
  )
}

function monitoringStatusLabel(status: string) {
  switch (status) {
    case 'SUCCESS': return 'Concluída'
    case 'SUCCESS_NO_RESULTS': return 'Concluída sem novidades'
    case 'PARTIAL_SUCCESS': return 'Concluída com atenção'
    case 'SOURCE_UNAVAILABLE': return 'Fonte indisponível'
    case 'FETCH_FAILED': return 'Falha de consulta'
    case 'PROCESSING_FAILED': return 'Falha de processamento'
    case 'RUNNING': return 'Em execução'
    case 'PENDING': return 'Agendada'
    case 'CANCELLED': return 'Cancelada'
    default: return status.toLowerCase().replaceAll('_', ' ')
  }
}

function monitoringStatusClass(status: string) {
  if (status === 'SUCCESS' || status === 'SUCCESS_NO_RESULTS') return 'is-success'
  if (status === 'RUNNING' || status === 'PENDING' || status === 'PARTIAL_SUCCESS') {
    return 'is-attention'
  }
  return 'is-error'
}

function formatRunTimestamp(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(durationMs: number | null) {
  if (durationMs === null || !Number.isFinite(durationMs)) return '—'
  if (durationMs < 1000) return durationMs + ' ms'
  const seconds = durationMs / 1000
  return seconds < 60
    ? seconds.toFixed(seconds < 10 ? 1 : 0) + ' s'
    : Math.floor(seconds / 60) + ' min ' + Math.round(seconds % 60) + ' s'
}

function MonitoringCenter({
  sources,
  runs,
  consulted,
  unavailable,
  unstable,
  expandedSource,
  onToggleSource,
}: {
  sources: PublicSource[]
  runs: MonitoringRun[]
  consulted: number
  unavailable: number
  unstable: number
  expandedSource: string | null
  onToggleSource: (code: string) => void
}) {
  const imported24h = runs.reduce(
    (total, run) => total + run.importedDocuments,
    0,
  )
  const federal = sources.filter((source) => source.jurisdictionLevel === 'FEDERAL')
  const states = sources.filter((source) => source.jurisdictionLevel === 'STATE')

  const renderGroup = (title: string, items: PublicSource[]) => (
    <section className="tp-monitor-group">
      <div className="tp-monitor-group-title">
        <h2>{title}</h2>
        <span>{items.length} fonte{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="tp-monitor-sources">
        {items.map((source) => {
          const sourceRuns = runs.filter((run) => run.sourceCode === source.code)
          const lastRun = sourceRuns[0] ?? null

          return (
            <article className="tp-monitor-source-card" key={source.code}>
              <div className="tp-monitor-source-main">
                <span className={'tp-source-dot is-' + sourceState(source)} />
                <div className="tp-monitor-source-name">
                  <strong>{source.name}</strong>
                  <small>{source.uf ?? 'Federal'}</small>
                </div>
                <div><span>Estado</span><b>{sourceLabel(source)}</b></div>
                <div>
                  <span>Última execução</span>
                  <b>{formatRunTimestamp(lastRun?.startedAt ?? source.lastAttemptAt)}</b>
                </div>
                <div>
                  <span>Importados 24h</span>
                  <b>{sourceRuns.reduce((total, run) => total + run.importedDocuments, 0)}</b>
                </div>
                <button type="button" onClick={() => onToggleSource(source.code)}>
                  {expandedSource === source.code
                    ? 'Ocultar execuções'
                    : 'Ver execuções'}
                </button>
              </div>

              {expandedSource === source.code && (
                <div className="tp-run-history">
                  <div className="tp-run-history-head">
                    <span>Data/hora</span><span>Status</span><span>Tentativas</span>
                    <span>Encontrados</span><span>Importados</span><span>Duração</span>
                  </div>
                  {sourceRuns.length === 0 ? (
                    <p>Nenhuma execução registrada nas últimas 24 horas.</p>
                  ) : (
                    sourceRuns.map((run) => (
                      <div className="tp-run-history-row" key={run.id}>
                        <span>{formatRunTimestamp(run.startedAt ?? run.scheduledFor)}</span>
                        <span>
                          <em className={'tp-run-status ' + monitoringStatusClass(run.status)}>
                            {monitoringStatusLabel(run.status)}
                          </em>
                        </span>
                        <span>{run.attemptCount}</span>
                        <span>{run.foundItems}</span>
                        <span><b>{run.importedDocuments}</b></span>
                        <span>{formatDuration(run.durationMs)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="tp-monitor-grid">
      <div className="tp-monitor-summary">
        <article><span>Fontes monitoradas</span><strong>{sources.length}</strong></article>
        <article><span>Consultadas</span><strong>{consulted}</strong></article>
        <article><span>Com atenção</span><strong>{unavailable + unstable}</strong></article>
        <article><span>Importados 24h</span><strong>{imported24h}</strong></article>
      </div>
      {renderGroup('Cobertura Federal', federal)}
      {renderGroup('Diários Oficiais Estaduais', states)}
    </div>
  )
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function registrationErrorMessage(
  error: Error,
  subject: 'empresa' | 'estabelecimento',
) {
  const prefix =
    subject === 'empresa'
      ? 'Não foi possível cadastrar a empresa.'
      : 'Não foi possível adicionar o estabelecimento.'

  switch (error.message) {
    case 'cnpj_not_found':
      return prefix + ' CNPJ não encontrado na base cadastral.'
    case 'cnpj_provider_unavailable':
      return prefix + ' A consulta cadastral está temporariamente indisponível.'
    case 'cnpj_provider_invalid_response':
      return prefix + ' A fonte cadastral respondeu com dados inválidos.'
    case 'establishment_conflict':
      return prefix + ' Este CNPJ já está cadastrado nesta empresa.'
    case 'business_location_code_exists':
      return prefix + ' Este Local Negócio já está sendo usado por outro estabelecimento.'
    case 'invalid_cnpj':
      return prefix + ' Informe um CNPJ válido.'
    default:
      return prefix
  }
}

function registrationAddress(item: Establishment) {
  const first = [item.street, item.streetNumber, item.complement].filter(Boolean).join(', ')
  const second = [
    item.district,
    item.municipalityName && item.uf
      ? item.municipalityName + '/' + item.uf
      : item.municipalityName ?? item.uf,
    item.postalCode ? 'CEP ' + item.postalCode : null,
  ].filter(Boolean).join(' · ')
  return [first, second].filter(Boolean).join(' — ') || 'Endereço não informado'
}

function DangerConfirmDialog({
  title,
  description,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  error?: Error | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="tp-confirm-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <section className="tp-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-confirm-title">
        <div>
          <span className="tp-confirm-eyebrow">Confirmação</span>
          <h3 id="tp-confirm-title">{title}</h3>
          <p>{description}</p>
        </div>
        {error && <p className="auth-error" role="alert">Não foi possível concluir a exclusão.</p>}
        <div className="tp-confirm-actions">
          <button className="launch-secondary-button" type="button" disabled={pending} onClick={onCancel}>
            Cancelar
          </button>
          <button className="tp-danger-button" type="button" disabled={pending} onClick={onConfirm}>
            {pending ? 'Excluindo…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

function CompanySection({
  apiFetch,
  tenantId,
  account,
  selectedCompanyId,
  onSelect,
  onOpenEstablishments,
  onOpenProfile,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  account: Awaited<ReturnType<typeof fetchAccountSummary>>
  selectedCompanyId: string
  onSelect: (companyId: string) => void
  onOpenEstablishments: () => void
  onOpenProfile: () => void
  onChanged: () => void
}) {
  const [cnpj, setCnpj] = useState(account.onboarding?.cnpj ?? '')
  const [businessLocationCode, setBusinessLocationCode] = useState('')
  const [creating, setCreating] = useState(account.companies.length === 0)
  const [editing, setEditing] = useState<AccountCompany | null>(null)
  const [editLegalName, setEditLegalName] = useState('')
  const [editBusinessLocationCode, setEditBusinessLocationCode] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<AccountCompany | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createCompanyFromCnpj(apiFetch, tenantId, cnpj, businessLocationCode),
    onSuccess: (result) => {
      onSelect(result.company.id)
      setCreating(false)
      setCnpj('')
      setBusinessLocationCode('')
      onChanged()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('company_required')
      return updateCompany(apiFetch, tenantId, editing.id, {
        legalName: editLegalName,
        businessLocationCode: editBusinessLocationCode.trim() || null,
      })
    },
    onSuccess: () => {
      setEditing(null)
      onChanged()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (companyId: string) => deleteCompany(apiFetch, tenantId, companyId),
    onSuccess: (_result, deletedCompanyId) => {
      const hasRemainingCompany = account.companies.some(
        (company) => company.id !== deletedCompanyId,
      )
      setEditing(null)
      setDeleteCandidate(null)
      setCreating(!hasRemainingCompany)
      onSelect('')
      onChanged()
    },
  })

  const beginEdit = (company: AccountCompany) => {
    setEditing(company)
    setEditLegalName(company.legalName)
    setEditBusinessLocationCode(company.businessLocationCode ?? '')
  }

  return (
    <div className="tp-company-management">
      <div className="tp-company-section-head">
        <div>
          <h2>Empresas da conta</h2>
          <p>
            Informe o CNPJ da matriz e, se desejar, o Local Negócio. O TriBusca consulta
            o cadastro CNPJ, cria a matriz, registra os CNAEs e consulta a Inscrição Estadual
            quando a fonte estadual estiver disponível.
          </p>
        </div>
        {!creating && (
          <button className="btn" type="button" onClick={() => setCreating(true)}>
            Adicionar empresa
          </button>
        )}
      </div>

      {creating && (
        <form
          className="tp-cnpj-create"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <label>
            CNPJ da matriz
            <input
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              autoFocus
              required
            />
          </label>
          <label>
            Local Negócio
            <input
              value={businessLocationCode}
              onChange={(event) => setBusinessLocationCode(event.target.value)}
              placeholder="Código interno da matriz"
              maxLength={80}
            />
          </label>
          <button className="btn" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Consultando CNPJ…' : 'Consultar CNPJ e cadastrar'}
          </button>
          {account.companies.length > 0 && (
            <button className="launch-secondary-button" type="button" onClick={() => setCreating(false)}>
              Cancelar cadastro
            </button>
          )}
          {createMutation.isError && (
            <p className="auth-error" role="alert">
              {registrationErrorMessage(createMutation.error, 'empresa')}
            </p>
          )}
        </form>
      )}

      <div className="tp-company-list">
        {account.companies.map((company) => (
          <article
            className={company.id === selectedCompanyId ? 'tp-company-row is-active' : 'tp-company-row'}
            key={company.id}
          >
            <div className="tp-company-identity">
              <strong>{company.legalName}</strong>
              <small>{formatCnpj(company.cnpj)}</small>
              {company.businessLocationCode && (
                <span>Local Negócio · {company.businessLocationCode}</span>
              )}
            </div>
            <span className="tp-company-active">
              {company.id === selectedCompanyId ? 'Ativa' : 'Disponível'}
            </span>
            <dl>
              <div><dt>Estabelecimentos</dt><dd>{company.establishmentCount}</dd></div>
              <div><dt>Local Negócio</dt><dd>{company.businessLocationCode || '—'}</dd></div>
            </dl>
            <div className="tp-company-actions">
              {company.id !== selectedCompanyId && (
                <button type="button" onClick={() => onSelect(company.id)}>Selecionar empresa</button>
              )}
              <button type="button" onClick={() => { onSelect(company.id); onOpenEstablishments() }}>
                Abrir estabelecimentos
              </button>
              <button type="button" onClick={() => { onSelect(company.id); onOpenProfile() }}>
                Abrir perfil tributário
              </button>
              <button type="button" onClick={() => beginEdit(company)}>
                <Pencil size={14} /> Editar empresa
              </button>
              <button
                className="is-danger"
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  deleteMutation.reset()
                  setDeleteCandidate(company)
                }}
              >
                <Trash2 size={14} /> Excluir empresa
              </button>
            </div>
          </article>
        ))}
      </div>

      {deleteCandidate && (
        <DangerConfirmDialog
          title="Excluir empresa?"
          description={
            'A empresa ' + deleteCandidate.legalName +
            ' será desativada junto com seus estabelecimentos. O histórico será preservado.'
          }
          confirmLabel="Excluir empresa"
          pending={deleteMutation.isPending}
          error={deleteMutation.error}
          onCancel={() => {
            if (!deleteMutation.isPending) {
              deleteMutation.reset()
              setDeleteCandidate(null)
            }
          }}
          onConfirm={() => deleteMutation.mutate(deleteCandidate.id)}
        />
      )}

      {editing && (
        <form
          className="tp-inline-editor"
          onSubmit={(event) => {
            event.preventDefault()
            updateMutation.mutate()
          }}
        >
          <div>
            <strong>Editar empresa</strong>
            <span>CNPJ {formatCnpj(editing.cnpj)}</span>
          </div>
          <label>
            Razão social
            <input
              value={editLegalName}
              onChange={(event) => setEditLegalName(event.target.value)}
              required
            />
          </label>
          <label>
            Local Negócio
            <input
              value={editBusinessLocationCode}
              onChange={(event) => setEditBusinessLocationCode(event.target.value)}
              placeholder="Código interno da matriz"
              maxLength={80}
            />
          </label>
          <div className="launch-form-actions">
            <button className="btn" type="submit" disabled={updateMutation.isPending}>
              Salvar alterações
            </button>
            <button className="launch-secondary-button" type="button" onClick={() => setEditing(null)}>
              Cancelar edição
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function EstablishmentSection({
  apiFetch,
  tenantId,
  companyId,
  companyCnpj,
  items,
  types,
  loading,
  error,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  companyId: string
  companyCnpj: string
  items: Establishment[]
  types: Awaited<ReturnType<typeof fetchEstablishmentTypes>>
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [cnpj, setCnpj] = useState('')
  const [businessLocationCode, setBusinessLocationCode] = useState('')
  const [typeCode, setTypeCode] = useState('OTHER')
  const [editing, setEditing] = useState<Establishment | null>(null)
  const [draft, setDraft] = useState<Establishment | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<Establishment | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createEstablishmentFromCnpj(apiFetch, tenantId, companyId, {
        cnpj,
        typeCode,
        businessLocationCode: businessLocationCode.trim() || undefined,
      }),
    onSuccess: () => {
      setCreating(false)
      setCnpj('')
      setBusinessLocationCode('')
      onChanged()
    },
  })

  const refreshMutation = useMutation({
    mutationFn: (establishmentId: string) =>
      refreshEstablishmentCnpj(apiFetch, tenantId, establishmentId),
    onSuccess: onChanged,
  })

  const deleteMutation = useMutation({
    mutationFn: (establishmentId: string) =>
      deleteEstablishment(apiFetch, tenantId, establishmentId),
    onSuccess: () => {
      setDeleteCandidate(null)
      onChanged()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!draft) throw new Error('establishment_required')
      return updateEstablishment(apiFetch, tenantId, draft.id, {
        name: draft.name,
        typeCode: draft.typeCode,
        uf: draft.uf,
        municipalityName: draft.municipalityName,
        municipalityIbgeCode: draft.municipalityIbgeCode,
        postalCode: draft.postalCode,
        street: draft.street,
        streetNumber: draft.streetNumber,
        complement: draft.complement,
        district: draft.district,
        stateRegistration: draft.stateRegistration,
        businessLocationCode: draft.businessLocationCode,
        cnaes: draft.cnaes,
      })
    },
    onSuccess: () => {
      setEditing(null)
      setDraft(null)
      onChanged()
    },
  })

  if (loading) return <LoadingState />
  if (error) return <ErrorState />

  const beginEdit = (item: Establishment) => {
    setEditing(item)
    setDraft({
      ...item,
      cnaes: item.cnaes.map((cnae) => ({ ...cnae })),
    })
  }

  const updateDraft = (patch: Partial<Establishment>) => {
    setDraft((current) => current ? { ...current, ...patch } : current)
  }

  const updateCnae = (
    index: number,
    patch: Partial<EstablishmentCnae>,
  ) => {
    setDraft((current) => {
      if (!current) return current
      const next = current.cnaes.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...patch }
          : patch.isPrimary
            ? { ...item, isPrimary: false }
            : item,
      )
      return { ...current, cnaes: next }
    })
  }

  return (
    <div className="tp-establishment-management">
      <div className="tp-company-section-head">
        <div>
          <h2>Estabelecimentos</h2>
          <p>
            Matriz e filiais da empresa ativa. A consulta pelo CNPJ atualiza endereço e CNAEs
            e tenta recuperar a Inscrição Estadual quando houver fonte estadual suportada.
          </p>
        </div>
        {!creating && (
          <button
            className="btn"
            type="button"
            onClick={() => {
              setCnpj('')
              setBusinessLocationCode('')
              setTypeCode('OTHER')
              setCreating(true)
            }}
          >
            Adicionar estabelecimento
          </button>
        )}
      </div>

      {creating && (
        <form
          className="tp-cnpj-create"
          onSubmit={(event) => {
            event.preventDefault()
            createMutation.mutate()
          }}
        >
          <label>
            CNPJ do estabelecimento
            <input
              value={cnpj}
              onChange={(event) => setCnpj(event.target.value)}
              placeholder="00.000.000/0000-00"
              required
              autoFocus
            />
          </label>
          <label>
            Local Negócio
            <input
              value={businessLocationCode}
              onChange={(event) => setBusinessLocationCode(event.target.value)}
              placeholder="Código interno da filial"
              maxLength={80}
            />
          </label>
          <label>
            Tipo
            <select value={typeCode} onChange={(event) => setTypeCode(event.target.value)}>
              {types
                .filter((type) => type.code !== 'HEAD_OFFICE')
                .map((type) => (
                  <option value={type.code} key={type.code}>{type.name}</option>
                ))}
            </select>
          </label>
          <button className="btn" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Consultando CNPJ…' : 'Consultar CNPJ e adicionar'}
          </button>
          <button className="launch-secondary-button" type="button" onClick={() => setCreating(false)}>
            Cancelar cadastro
          </button>
        </form>
      )}

      {createMutation.isError && (
        <p className="auth-error" role="alert">
          {registrationErrorMessage(createMutation.error, 'estabelecimento')}
        </p>
      )}

      <div className="tp-establishment-table-v2">
        <div className="tp-establishment-head">
          <span>Nome da unidade</span><span>CNPJ</span><span>Local Negócio</span>
          <span>Tipo</span><span>Município/UF</span><span>Endereço</span>
          <span>Inscrição estadual</span><span>CNAE principal</span><span>Ações</span>
        </div>

        {items.map((item) => {
          const primary = item.cnaes.find((cnae) => cnae.isPrimary)
          return (
            <div className="tp-establishment-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                {item.isHeadOffice && <small>Matriz</small>}
              </div>
              <span>{formatCnpj(item.cnpj)}</span>
              <span>{item.businessLocationCode || '—'}</span>
              <span>{types.find((type) => type.code === item.typeCode)?.name ?? item.typeCode}</span>
              <span>{item.municipalityName ? item.municipalityName + '/' + item.uf : item.uf}</span>
              <span className="tp-address-cell">{registrationAddress(item)}</span>
              <span className="tp-state-registration-cell">
                <b>{item.stateRegistration || '—'}</b>
                {item.stateRegistrationLookupStatus === 'SUCCESS' && (
                  <small>
                    {item.stateRegistrationSource === 'SEFAZ_GO_SINTEGRA'
                      ? 'SEFAZ Goiás · SINTEGRA'
                      : 'Consulta estadual confirmada'}
                  </small>
                )}
                {item.stateRegistrationLookupStatus === 'NOT_FOUND' && <small>IE não localizada</small>}
                {item.stateRegistrationLookupStatus === 'UNAVAILABLE' && <small>Consulta estadual indisponível</small>}
                {item.stateRegistrationLookupStatus === 'NOT_SUPPORTED' && <small>Consulta automática não disponível para esta UF</small>}
                {item.stateRegistrationSource === 'MANUAL' && <small>Informada manualmente</small>}
              </span>
              <span className="tp-cnae-cell">
                {primary ? (
                  <><b>{primary.code}</b><small>{primary.description}</small></>
                ) : '—'}
              </span>
              <div className="tp-row-actions">
                <button
                  type="button"
                  disabled={refreshMutation.isPending}
                  onClick={() => refreshMutation.mutate(item.id)}
                >
                  Atualizar cadastro CNPJ e IE
                </button>
                <button type="button" onClick={() => beginEdit(item)}>Editar estabelecimento</button>
                {!item.isHeadOffice && (
                  <button
                    className="is-danger"
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      deleteMutation.reset()
                      setDeleteCandidate(item)
                    }}
                  >
                    Excluir estabelecimento
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {deleteCandidate && (
        <DangerConfirmDialog
          title="Excluir estabelecimento?"
          description={'O estabelecimento ' + deleteCandidate.name + ' será desativado. O histórico será preservado.'}
          confirmLabel="Excluir estabelecimento"
          pending={deleteMutation.isPending}
          error={deleteMutation.error}
          onCancel={() => {
            if (!deleteMutation.isPending) {
              deleteMutation.reset()
              setDeleteCandidate(null)
            }
          }}
          onConfirm={() => deleteMutation.mutate(deleteCandidate.id)}
        />
      )}

      {editing && draft && (
        <form
          className="tp-establishment-editor"
          onSubmit={(event) => {
            event.preventDefault()
            updateMutation.mutate()
          }}
        >
          <div className="tp-editor-title">
            <div><strong>Editar estabelecimento</strong><span>{formatCnpj(draft.cnpj)}</span></div>
            <button type="button" onClick={() => { setEditing(null); setDraft(null) }}>Fechar edição</button>
          </div>

          <div className="launch-form-grid">
            <label>
              Nome da unidade
              <input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
            </label>
            <label>
              Tipo
              <select
                value={draft.typeCode}
                onChange={(event) => updateDraft({ typeCode: event.target.value })}
                disabled={draft.isHeadOffice}
              >
                {types.map((type) => <option value={type.code} key={type.code}>{type.name}</option>)}
              </select>
            </label>
            <label>
              UF
              <select value={draft.uf} onChange={(event) => updateDraft({ uf: event.target.value })}>
                {ALL_UFS.map((item) => <option value={item} key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              Município
              <input
                value={draft.municipalityName ?? ''}
                onChange={(event) => updateDraft({ municipalityName: event.target.value || null })}
              />
            </label>
            <label>
              Código IBGE
              <input
                value={draft.municipalityIbgeCode ?? ''}
                onChange={(event) => updateDraft({ municipalityIbgeCode: event.target.value || null })}
              />
            </label>
            <label>
              CEP
              <input
                value={draft.postalCode ?? ''}
                onChange={(event) => updateDraft({ postalCode: event.target.value || null })}
              />
            </label>
            <label>
              Logradouro
              <input value={draft.street ?? ''} onChange={(event) => updateDraft({ street: event.target.value || null })} />
            </label>
            <label>
              Número
              <input value={draft.streetNumber ?? ''} onChange={(event) => updateDraft({ streetNumber: event.target.value || null })} />
            </label>
            <label>
              Complemento
              <input value={draft.complement ?? ''} onChange={(event) => updateDraft({ complement: event.target.value || null })} />
            </label>
            <label>
              Bairro
              <input value={draft.district ?? ''} onChange={(event) => updateDraft({ district: event.target.value || null })} />
            </label>
            <label>
              Local Negócio
              <input
                value={draft.businessLocationCode ?? ''}
                onChange={(event) => updateDraft({ businessLocationCode: event.target.value || null })}
                maxLength={80}
              />
            </label>
            <label>
              Inscrição Estadual
              <input
                value={draft.stateRegistration ?? ''}
                onChange={(event) => updateDraft({ stateRegistration: event.target.value || null })}
              />
            </label>
          </div>

          <div className="tp-cnae-editor">
            <div className="tp-cnae-editor-head">
              <div><strong>CNAEs</strong><span>Defina o principal e mantenha os secundários.</span></div>
              <button
                className="launch-secondary-button"
                type="button"
                onClick={() =>
                  updateDraft({
                    cnaes: [
                      ...draft.cnaes,
                      { code: '', description: '', isPrimary: draft.cnaes.length === 0 },
                    ],
                  })
                }
              >
                Adicionar CNAE
              </button>
            </div>

            {draft.cnaes.map((cnae, index) => (
              <div className="tp-cnae-edit-row" key={index}>
                <label>
                  <input
                    type="radio"
                    name="primary-cnae"
                    checked={cnae.isPrimary}
                    onChange={() => updateCnae(index, { isPrimary: true })}
                  />
                  Principal
                </label>
                <input
                  value={cnae.code}
                  placeholder="0000000"
                  onChange={(event) => updateCnae(index, { code: event.target.value.replace(/\D/g, '') })}
                />
                <input
                  value={cnae.description}
                  placeholder="Descrição do CNAE"
                  onChange={(event) => updateCnae(index, { description: event.target.value })}
                />
                <button
                  className="is-danger"
                  type="button"
                  onClick={() => updateDraft({ cnaes: draft.cnaes.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  Remover CNAE
                </button>
              </div>
            ))}
          </div>

          {updateMutation.isError && (
            <p className="auth-error" role="alert">Não foi possível salvar: {updateMutation.error.message}</p>
          )}

          <div className="launch-form-actions">
            <button className="btn" type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              onClick={() => { setEditing(null); setDraft(null) }}
            >
              Cancelar edição
            </button>
          </div>
        </form>
      )}

      <span className="sr-only">Matriz cadastrada: {formatCnpj(companyCnpj)}</span>
    </div>
  )
}

function TaxonomyDimensionPicker({
  dimension,
  selected,
  onToggle,
}: {
  dimension: TaxonomyProfileDimension
  selected: Set<string>
  onToggle: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('pt-BR')
  const concepts = dimension.concepts.filter(
    (concept) =>
      !normalized ||
      concept.label.toLocaleLowerCase('pt-BR').includes(normalized) ||
      concept.code.toLocaleLowerCase('pt-BR').includes(normalized),
  )
  const shown = normalized
    ? concepts.slice(0, 80)
    : concepts
        .filter((concept) => selected.has(concept.code))
        .concat(concepts.filter((concept) => !selected.has(concept.code)).slice(0, 14))

  return (
    <section className="tp-taxonomy-dimension">
      <div>
        <strong>{dimension.name}</strong>
        <span>
          {dimension.concepts.length} opções ·{' '}
          {dimension.concepts.filter((concept) => selected.has(concept.code)).length} selecionadas
        </span>
      </div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={'Buscar em ' + dimension.name.toLowerCase()}
        aria-label={'Buscar ' + dimension.name}
      />
      <div className="tp-taxonomy-options">
        {shown.map((concept) => (
          <label
            className={selected.has(concept.code) ? 'is-selected' : ''}
            key={concept.code}
            title={concept.definition}
          >
            <input
              type="checkbox"
              checked={selected.has(concept.code)}
              onChange={() => onToggle(concept.code)}
            />
            <span><b>{concept.label}</b><small>{concept.code}</small></span>
            {selected.has(concept.code) && <Check size={15} />}
          </label>
        ))}
      </div>
    </section>
  )
}

function cnaeSector(code: string): string {
  const division = Number(code.slice(0, 2))
  if (division >= 1 && division <= 3) return 'Agronegócio'
  if (division >= 5 && division <= 9) return 'Indústria extrativa'
  if (division >= 10 && division <= 33) return 'Indústria'
  if (division >= 35 && division <= 39) return 'Energia e saneamento'
  if (division >= 41 && division <= 43) return 'Construção'
  if (division >= 45 && division <= 47) return 'Comércio'
  if (division >= 49 && division <= 53) return 'Transporte e logística'
  if (division >= 55 && division <= 56) return 'Alimentação e hospedagem'
  if (division >= 58 && division <= 63) return 'Informação e comunicação'
  if (division >= 64 && division <= 66) return 'Serviços financeiros'
  return 'Serviços / Outros'
}

function TaxProfileSection({
  apiFetch,
  tenantId,
  company,
  establishments,
  profile,
  taxonomyOptions,
  loading,
  error,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  company: AccountCompany
  establishments: Establishment[]
  profile: Awaited<ReturnType<typeof fetchTaxProfile>>
  taxonomyOptions: TaxonomyProfileOptions
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [taxRegime, setTaxRegime] = useState(profile?.taxRegime ?? 'NAO_INFORMADO')
  const [keywords, setKeywords] = useState(profile?.personalization.keywords?.join(', ') ?? '')
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(profile?.personalization.taxonomy?.conceptCodes ?? []),
  )

  useEffect(() => {
    setTaxRegime(profile?.taxRegime ?? 'NAO_INFORMADO')
    setKeywords(profile?.personalization.keywords?.join(', ') ?? '')
    setSelectedCodes(new Set(profile?.personalization.taxonomy?.conceptCodes ?? []))
  }, [profile])

  const profileDimensions = useMemo(
    () => taxonomyOptions.dimensions.filter((dimension) => PROFILE_DIMENSION_CODES.has(dimension.code)),
    [taxonomyOptions.dimensions],
  )

  const selectedLabels = (dimensionCode: string) =>
    profileDimensions
      .find((dimension) => dimension.code === dimensionCode)
      ?.concepts.filter((concept) => selectedCodes.has(concept.code))
      .map((concept) => concept.label) ?? []

  const mutation = useMutation({
    mutationFn: () =>
      saveTaxProfile(apiFetch, tenantId, company.id, {
        taxRegime,
        segments: selectedLabels('sector'),
        activities: selectedLabels('operation'),
        personalization: {
          taxes: selectedLabels('tax'),
          products: selectedLabels('product'),
          operations: selectedLabels('operation'),
          documents: selectedLabels('document'),
          obligations: selectedLabels('obligation'),
          keywords: splitCsv(keywords),
          taxonomy: taxonomyOptions.release
            ? {
                releaseId: taxonomyOptions.release.id,
                releaseVersion: taxonomyOptions.release.version,
                conceptCodes: [...selectedCodes]
                  .filter((code) =>
                    profileDimensions.some((dimension) =>
                      dimension.concepts.some((concept) => concept.code === code),
                    ),
                  )
                  .sort(),
              }
            : null,
        },
      }),
    onSuccess: onChanged,
  })

  if (loading) return <LoadingState />
  if (error) return <ErrorState />

  const ufs = [...new Set(establishments.map((item) => item.uf))].sort()
  const municipalities = [...new Set(
    establishments
      .map((item) => item.municipalityName)
      .filter((value): value is string => Boolean(value)),
  )].sort()
  const stateRegistrations = [...new Set(
    establishments
      .map((item) => item.stateRegistration)
      .filter((value): value is string => Boolean(value)),
  )].sort()
  const cnaes = [...new Map(
    establishments
      .flatMap((item) => item.cnaes)
      .map((cnae) => [cnae.code, cnae]),
  ).values()].sort((left, right) => left.code.localeCompare(right.code))

  const toggleCode = (code: string) => {
    setSelectedCodes((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <form
      className="tp-tax-profile-editor"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <div className="tp-company-section-head">
        <div>
          <h2>Perfil Tributário</h2>
          <p>
            Contexto cadastral e fiscal usado para aproximar publicações do negócio da empresa.
          </p>
        </div>
        {profile && <span className="tp-profile-version">Perfil v{profile.versionNo}</span>}
      </div>

      <section className="tp-profile-context">
        <div className="tp-profile-section-title">
          <h3>Contexto cadastral</h3>
        </div>
        <div className="tp-context-grid">
          <article><span>CNPJ da matriz</span><strong>{formatCnpj(company.cnpj)}</strong></article>
          <article><span>Estabelecimentos</span><strong>{establishments.length}</strong></article>
          <article><span>UFs</span><strong>{ufs.join(', ') || '—'}</strong></article>
          <article><span>Municípios</span><strong>{municipalities.join(', ') || '—'}</strong></article>
          <article><span>Inscrições estaduais</span><strong>{stateRegistrations.join(', ') || '—'}</strong></article>
        </div>

        <div className="tp-profile-cnaes tp-profile-cnaes-table">
          <strong>CNAEs capturados</strong>
          {cnaes.length ? (
            <div className="tp-cnae-profile-table">
              <div className="tp-cnae-profile-head">
                <span>CNAE</span><span>Atividade</span><span>Setor</span><span>Produto</span><span>NCM</span>
              </div>
              {cnaes.map((cnae) => (
                <div className="tp-cnae-profile-row" key={cnae.code}>
                  <b>{cnae.code}</b>
                  <span>{cnae.description}</span>
                  <span>{cnaeSector(cnae.code)}</span>
                  <span className="tp-parameter-empty">Adicionar produto</span>
                  <span className="tp-parameter-empty">Adicionar NCM</span>
                </div>
              ))}
            </div>
          ) : (
            <p>Nenhum CNAE cadastrado.</p>
          )}
        </div>
      </section>

      <section className="tp-profile-declared">
        <div className="tp-profile-section-title">
          <h3>Contexto fiscal</h3>
        </div>
        <div className="launch-form-grid">
          <label>
            Regime tributário
            <select value={taxRegime} onChange={(event) => setTaxRegime(event.target.value)}>
              <option value="NAO_INFORMADO">Não informado</option>
              <option value="LUCRO_REAL">Lucro Real</option>
              <option value="LUCRO_PRESUMIDO">Lucro Presumido</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="IMUNE_ISENTA">Imune/Isenta</option>
              <option value="OUTRO">Outro</option>
            </select>
          </label>
          <label>
            Palavras-chave adicionais
            <input
              value={keywords}
              onChange={(event) => setKeywords(event.target.value)}
              placeholder="ex.: crédito presumido, barter"
            />
          </label>
        </div>
      </section>

      <section className="tp-profile-taxonomy">
        <div className="tp-profile-section-title">
          <h3>Marcadores do perfil</h3>
          <p>Selecione apenas conceitos que descrevem a empresa e suas operações.</p>
        </div>

        {taxonomyOptions.release ? (
          <div className="tp-taxonomy-grid">
            {profileDimensions.map((dimension) => (
              <TaxonomyDimensionPicker
                dimension={dimension}
                selected={selectedCodes}
                onToggle={toggleCode}
                key={dimension.code}
              />
            ))}
          </div>
        ) : (
          <div className="tp-taxonomy-unavailable">
            <strong>Taxonomia indisponível</strong>
          </div>
        )}
      </section>

      {mutation.isError && (
        <p className="auth-error" role="alert">Não foi possível salvar o perfil: {mutation.error.message}</p>
      )}

      <div className="tp-profile-save">
        <div><strong>{selectedCodes.size} marcador(es)</strong></div>
        <button className="btn" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar Perfil Tributário'}
        </button>
      </div>
    </form>
  )
}
