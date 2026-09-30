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
  Landmark,
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
  useState,
} from 'react'
import { Link } from 'react-router-dom'

import type { PanelIdentity } from './panel-experience'
import {
  fetchPublicSources,
  fetchPublicStats,
  formatLastSuccessAt,
  formatPublicDate,
  type PublicSource,
} from './public-api'
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
  fetchProductArchive,
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
  | 'fontes'
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
  {
    key: 'central',
    label: 'Central de Monitoramento',
  },
  { key: 'fontes', label: 'Fontes Oficiais' },
  { key: 'empresas', label: 'Empresas' },
]

const UFS = [
  '',
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

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
        <p>
          Consultando o backend do TriBusca.
        </p>
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
        <p>
          A interface não substitui uma falha de API
          por dados simulados.
        </p>
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
        Não há publicação oficial para este
        recorte.
      </EmptyState>
    )
  }

  return (
    <div className="tp-list-card">
      {items.map((item) => {
        const reference =
          publicationReference(item)
        const body = (
          <>
            <span className="tp-publication-copy">
              <span className="tp-publication-meta">
                <b className="tp-level-global">
                  Acervo global
                </b>
                <span>
                  {item.agency ??
                    'Órgão não informado'}{' '}
                  ·{' '}
                  {formatPublicDate(
                    item.publishedOn,
                  )}
                </span>
              </span>
              <strong>{reference}</strong>
              {!compact &&
                reference !== item.title && (
                  <span className="tp-publication-title">
                    {item.title}
                  </span>
                )}
              <span className="tp-publication-tags">
                {item.uf ?? 'Federal'}
                {item.effectiveOn
                  ? ' · Vigência ' +
                    formatPublicDate(
                      item.effectiveOn,
                    )
                  : ''}
              </span>
            </span>
          </>
        )

        return (
          <Link
            className="tp-publication-row tp-publication-link"
            to={
              '/painel/publicacoes/' +
              item.id
            }
            key={item.id}
            aria-label={
              'Abrir legislação no TriBusca: ' +
              reference
            }
          >
            <FileText
              size={17}
              aria-hidden="true"
            />
            {body}
          </Link>
        )
      })}
    </div>
  )
}

function sourceState(
  source: PublicSource,
) {
  if (source.status === 'ONLINE') {
    return source.importedToday > 0
      ? 'ok'
      : 'none'
  }
  if (source.status === 'UNSTABLE') {
    return 'partial'
  }
  if (source.status === 'UNAVAILABLE') {
    return 'down'
  }
  return 'none'
}

function sourceLabel(
  source: PublicSource,
) {
  switch (source.status) {
    case 'ONLINE':
      return source.importedToday > 0
        ? source.importedToday +
            ' importada' +
            (source.importedToday === 1
              ? ''
              : 's') +
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
    <div
      className={
        compact
          ? 'tp-source-health is-compact'
          : 'tp-source-health'
      }
    >
      {items.map((source) => (
        <div
          className={
            'tp-source-health-row is-' +
            sourceState(source)
          }
          key={source.code}
        >
          <span className="tp-source-dot" />
          <strong>{source.name}</strong>
          <span>
            <b>{sourceLabel(source)}</b>
            <small>
              {source.lastSuccessAt
                ? 'Último sucesso ' +
                  formatLastSuccessAt(
                    source.lastSuccessAt,
                  )
                : source.lastAttemptAt
                  ? 'Última tentativa ' +
                    formatLastSuccessAt(
                      source.lastAttemptAt,
                    )
                  : 'Sem execução registrada'}
            </small>
          </span>
          {!compact && (
            <em>
              {source.totalPublications} no
              Acervo
            </em>
          )}
        </div>
      ))}
    </div>
  )
}

export function AuthenticatedProductPanel({
  identity,
  apiFetch,
  onExit,
  exitError,
}: Props) {
  const queryClient = useQueryClient()
  const [selectedTenantId, setSelectedTenantId] =
    useState(identity.memberships?.[0]?.tenantId ?? '')
  const membership =
    identity.memberships?.find(
      (item) => item.tenantId === selectedTenantId,
    ) ?? identity.memberships?.[0]
  const tenantId = membership?.tenantId
  const displayName =
    identity.name ||
    identity.email ||
    'Usuário TriBusca'
  const tenantName =
    membership?.tenantName ??
    'Conta TriBusca'

  const [screen, setScreen] =
    useState<Screen>('inicio')
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [archivePage, setArchivePage] = useState(1)
  const [jurisdiction, setJurisdiction] =
    useState('')
  const [uf, setUf] = useState('')
  const [source, setSource] = useState('')
  const [orgTab, setOrgTab] =
    useState<OrgTab>('empresa')
  const [userMenu, setUserMenu] =
    useState(false)
  const [tenantMenu, setTenantMenu] =
    useState(false)
  const [selectedCompanyId, setSelectedCompanyId] =
    useState('')
  const [
    runHistorySource,
    setRunHistorySource,
  ] = useState<string | null>(null)

  useEffect(() => {
    setSelectedCompanyId('')
    setOrgTab('empresa')
  }, [tenantId])

  const sourcesQuery = useQuery({
    queryKey: ['launch', 'sources'],
    queryFn: ({ signal }) =>
      fetchPublicSources(undefined, signal),
    retry: false,
  })

  const statsQuery = useQuery({
    queryKey: ['launch', 'stats'],
    queryFn: ({ signal }) =>
      fetchPublicStats(undefined, signal),
    retry: false,
  })

  const monitoringRunsQuery = useQuery({
    queryKey: [
      'launch',
      'monitoring-runs',
      tenantId,
    ],
    queryFn: () =>
      fetchMonitoringRuns(
        apiFetch,
        tenantId!,
      ),
    enabled: Boolean(tenantId),
    retry: false,
    refetchInterval: 60_000,
  })

  const latestArchiveQuery = useQuery({
    queryKey: ['launch', 'archive', 'latest'],
    queryFn: () =>
      fetchProductArchive(apiFetch, {
        page: 1,
        limit: 5,
      }),
    retry: false,
  })

  const archiveQuery = useQuery({
    queryKey: [
      'launch',
      'archive',
      appliedQuery,
      jurisdiction,
      uf,
      source,
      archivePage,
    ],
    queryFn: () =>
      fetchProductArchive(apiFetch, {
        q:
          appliedQuery.trim().length >= 2
            ? appliedQuery.trim()
            : undefined,
        jurisdiction:
          jurisdiction === 'FEDERAL' ||
          jurisdiction === 'STATE'
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
    queryKey: [
      'launch',
      'account',
      tenantId,
    ],
    queryFn: () =>
      fetchAccountSummary(
        apiFetch,
        tenantId!,
      ),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const archiveItems =
    archiveQuery.data?.items ?? []

  const latestPublications =
    latestArchiveQuery.data?.items ?? []

  const sources =
    sourcesQuery.data?.items ?? []
  const stats = statsQuery.data
  const account = accountQuery.data
  const selectedCompany =
    account?.companies.find(
      (company) =>
        company.id === selectedCompanyId,
    ) ?? account?.companies[0]

  const establishmentsQuery = useQuery({
    queryKey: [
      'launch',
      'establishments',
      tenantId,
      selectedCompany?.id,
    ],
    queryFn: () =>
      fetchEstablishments(
        apiFetch,
        tenantId!,
        selectedCompany!.id,
      ),
    enabled: Boolean(
      tenantId && selectedCompany?.id,
    ),
    retry: false,
  })

  const typesQuery = useQuery({
    queryKey: ['launch', 'establishment-types'],
    queryFn: () =>
      fetchEstablishmentTypes(apiFetch),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const profileQuery = useQuery({
    queryKey: [
      'launch',
      'tax-profile',
      tenantId,
      selectedCompany?.id,
    ],
    queryFn: () =>
      fetchTaxProfile(
        apiFetch,
        tenantId!,
        selectedCompany!.id,
      ),
    enabled: Boolean(
      tenantId && selectedCompany?.id,
    ),
    retry: false,
  })

  const taxonomyOptionsQuery = useQuery({
    queryKey: [
      'launch',
      'taxonomy-profile-options',
      tenantId,
    ],
    queryFn: () =>
      fetchTaxonomyProfileOptions(
        apiFetch,
        tenantId!,
      ),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const submitSearch = (
    event: FormEvent,
  ) => {
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

  const unavailable =
    sources.filter(
      (item) =>
        item.status === 'UNAVAILABLE',
    ).length
  const unstable =
    sources.filter(
      (item) =>
        item.status === 'UNSTABLE',
    ).length
  const consulted =
    sources.filter(
      (item) =>
        item.status !== 'NOT_CONSULTED',
    ).length

  return (
    <div
      className="tp-app"
      data-panel-mode="authenticated"
    >
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
                      className={
                        company.id === selectedCompany?.id
                          ? 'is-selected'
                          : undefined
                      }
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

          <form
            className="tp-global-search"
            onSubmit={submitSearch}
          >
            <Search
              size={17}
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) =>
                setQuery(
                  event.target.value,
                )
              }
              placeholder="Buscar no Acervo carregado"
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
                setUserMenu(
                  (value) => !value,
                )
                setTenantMenu(false)
              }}
            >
              <span>
                {initials(displayName)}
              </span>
              <ChevronDown
                size={14}
                aria-hidden="true"
              />
            </button>

            {userMenu && (
              <div className="tp-popover tp-user-popover">
                <div className="tp-user-summary">
                  <strong>
                    {displayName}
                  </strong>
                  <span>
                    {identity.email ?? '—'}
                  </span>
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
                    Configurações
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void onExit()
                    }
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav
          className="tp-tabs"
          aria-label="Navegação do painel"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              aria-current={
                screen === tab.key
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                setScreen(tab.key)
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {exitError && (
        <div
          className="tp-error-banner"
          role="alert"
        >
          {exitError}
        </div>
      )}

      <span className="sr-only">Conta autenticada</span>
      <span className="sr-only">{tenantName}</span>

      <main
        className={
          'tp-main tp-main-' + screen
        }
      >
        {screen === 'inicio' && (
          <>
            <div className="tp-welcome-row">
              <div>
                <span>
                  {new Intl.DateTimeFormat(
                    'pt-BR',
                    {
                      dateStyle: 'full',
                    },
                  ).format(new Date())}
                </span>
                <h1>
                  Olá,{' '}
                  {firstName(
                    displayName,
                  )}
                  .
                </h1>
                <p>
                  Este painel usa dados
                  reais do Acervo e da sua
                  conta. Métricas globais
                  estão identificadas como
                  globais.
                </p>
              </div>
            </div>

            <form
              className="tp-search-hero"
              onSubmit={submitSearch}
            >
              <span className="tp-hero-label">
                Acervo global · Busca
              </span>
              <div>
                <input
                  value={query}
                  onChange={(event) =>
                    setQuery(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Ex.: ICMS, NF-e, CONFAZ"
                  aria-label="Consulta rápida no Acervo"
                />
                <button type="submit">
                  Buscar
                </button>
              </div>
            </form>

            {statsQuery.isPending ? (
              <LoadingState />
            ) : statsQuery.isError ? (
              <ErrorState />
            ) : (
              <section
                className="tp-metrics"
                aria-label="Indicadores globais"
              >
                <article>
                  <span>
                    Fontes previstas
                  </span>
                  <strong>
                    {stats?.totalSources ??
                      0}
                  </strong>
                  <small>
                    Global
                  </small>
                </article>
                <article>
                  <span>
                    Fontes ativas
                  </span>
                  <strong>
                    {stats?.activeSources ??
                      0}
                  </strong>
                  <small>
                    Global
                  </small>
                </article>
                <article>
                  <span>
                    Publicações no Acervo
                  </span>
                  <strong>
                    {stats?.totalPublications ??
                      0}
                  </strong>
                  <small>
                    Global
                  </small>
                </article>
                <article>
                  <span>
                    Importadas hoje
                  </span>
                  <strong>
                    {stats?.importedToday ??
                      0}
                  </strong>
                  <small>
                    Global
                  </small>
                </article>
                <article>
                  <span>
                    Potencialmente relevantes
                  </span>
                  <strong>—</strong>
                  <small>
                    Matching não executado
                  </small>
                </article>
                <article>
                  <span>
                    Pendentes de análise
                  </span>
                  <strong>—</strong>
                  <small>
                    IA não executada
                  </small>
                </article>
              </section>
            )}

            <div className="tp-home-grid">
              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span>
                    <b>
                      Últimas publicações
                    </b>
                    <small>
                      Acervo oficial global
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setScreen(
                        'publicacoes',
                      )
                    }
                  >
                    Ver todas →
                  </button>
                </div>
                {latestArchiveQuery.isPending ? (
                  <LoadingState />
                ) : latestArchiveQuery.isError ? (
                  <ErrorState />
                ) : (
                  <PublicationList
                    items={latestPublications}
                    compact
                  />
                )}
              </section>

              <aside className="tp-home-rail">
                <section className="tp-panel-card tp-rail-card">
                  <div className="tp-card-head">
                    <span>
                      <b>
                        Saúde das fontes
                      </b>
                      <small>
                        Estado operacional
                        real
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setScreen(
                          'central',
                        )
                      }
                    >
                      Abrir →
                    </button>
                  </div>
                  {sourcesQuery.isPending ? (
                    <LoadingState />
                  ) : sourcesQuery.isError ? (
                    <ErrorState />
                  ) : (
                    <SourceHealth
                      items={sources.slice(
                        0,
                        6,
                      )}
                      compact
                    />
                  )}
                </section>

                <section className="tp-panel-card tp-rail-card">
                  <div className="tp-card-head">
                    <span>
                      <b>
                        Configuração da conta
                      </b>
                      <small>
                        Dados privados
                      </small>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setScreen(
                          'empresas',
                        )
                      }
                    >
                      Abrir →
                    </button>
                  </div>
                  {accountQuery.isPending ? (
                    <LoadingState />
                  ) : accountQuery.isError ? (
                    <ErrorState />
                  ) : (
                    <div className="launch-account-summary">
                      <strong>
                        {account
                          ?.companies
                          .length ?? 0}{' '}
                        empresa(s)
                      </strong>
                      <span>
                        {selectedCompany
                          ? selectedCompany
                              .establishmentCount +
                            ' estabelecimento(s)'
                          : 'Complete a empresa para liberar o perfil tributário.'}
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
              eyebrow="Acervo oficial global"
              title="Publicações"
              description="Publicações oficiais reais. Afinidade e relevância não são atribuídas até o matching da conta ser executado."
            />
            <div className="tp-filterbar">
              <span>
                {archiveItems.length}{' '}
                item(ns) no recorte
                carregado
              </span>
            </div>
            {archiveQuery.isPending ? (
              <LoadingState />
            ) : archiveQuery.isError ? (
              <ErrorState />
            ) : (
              <PublicationList
                items={archiveItems}
              />
            )}
          </>
        )}

        {screen === 'acervo' && (
          <>
            <SectionHeading
              eyebrow="Base oficial organizada"
              title="Acervo"
              description="Filtre e pesquise o Acervo autenticado completo por esfera, UF, fonte e conteúdo oficial, com navegação paginada."
            />

            <form
              className="tp-acervo-search"
              onSubmit={submitSearch}
            >
              <Search size={19} />
              <input
                value={query}
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
                placeholder="Título, número ou órgão"
                aria-label="Pesquisar no Acervo"
              />
              <button type="submit">
                Buscar
              </button>
            </form>

            <div className="tp-acervo-layout">
              <aside className="tp-filter-panel">
                <b>Filtros reais</b>
                <label>
                  Esfera
                  <select
                    value={jurisdiction}
                    onChange={(event) => {
                      setJurisdiction(event.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="">
                      Todas
                    </option>
                    <option value="FEDERAL">
                      Federal
                    </option>
                    <option value="STATE">
                      Estadual
                    </option>
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
                    {UFS.map((item) => (
                      <option
                        value={item}
                        key={
                          item ||
                          'all'
                        }
                      >
                        {item || 'Todas'}
                      </option>
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
                    <option value="">
                      Todas
                    </option>
                    {sources.map(
                      (item) => (
                        <option
                          value={
                            item.code
                          }
                          key={
                            item.code
                          }
                        >
                          {item.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  className="launch-secondary-button"
                  type="button"
                  onClick={
                    resetArchiveFilters
                  }
                >
                  Limpar filtros
                </button>
                <small>
                  Busca e paginação no Acervo autenticado.
                </small>
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
                        ← Anterior
                      </button>
                      <span>Página {archivePage}</span>
                      <button
                        type="button"
                        disabled={!archiveQuery.data?.hasMore}
                        onClick={() => setArchivePage((page) => page + 1)}
                      >
                        Próxima →
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          </>
        )}

        {screen === 'central' && (
          <>
            <SectionHeading
              eyebrow="Saúde operacional"
              title="Central de Monitoramento"
              description="Acompanhe a situação das fontes, a última execução e os documentos importados nas últimas 24 horas."
            />
            {sourcesQuery.isPending ||
            monitoringRunsQuery.isPending ? (
              <LoadingState />
            ) : sourcesQuery.isError ||
              monitoringRunsQuery.isError ? (
              <ErrorState />
            ) : (
              <MonitoringCenter
                sources={sources}
                runs={
                  monitoringRunsQuery.data?.items ??
                  []
                }
                consulted={consulted}
                unavailable={unavailable}
                unstable={unstable}
                expandedSource={
                  runHistorySource
                }
                onToggleSource={(code) =>
                  setRunHistorySource(
                    (current) =>
                      current === code
                        ? null
                        : code,
                  )
                }
              />
            )}
          </>
        )}

        {screen === 'fontes' && (
          <>
            <SectionHeading
              eyebrow="Cobertura legislativa"
              title="Fontes Oficiais"
              description="Fontes cadastradas e volume associado ao Acervo."
            />

            {sourcesQuery.isPending ? (
              <LoadingState />
            ) : sourcesQuery.isError ? (
              <ErrorState />
            ) : (
              <div className="tp-source-catalog">
                {sources.map(
                  (item) => (
                    <article
                      key={item.code}
                    >
                      <span className="tp-source-icon">
                        <Landmark
                          size={18}
                        />
                      </span>
                      <div>
                        <strong>
                          {item.name}
                        </strong>
                        <span>
                          {item.jurisdictionLevel}
                          {item.uf
                            ? ' · ' +
                              item.uf
                            : ''}
                        </span>
                        <p>
                          Última tentativa:{' '}
                          {formatLastSuccessAt(
                            item.lastAttemptAt,
                          )}
                        </p>
                      </div>
                      <em>
                        {
                          item.totalPublications
                        }{' '}
                        itens
                      </em>
                    </article>
                  ),
                )}
              </div>
            )}
          </>
        )}

        {screen === 'empresas' && (
          <>
            <div className="tp-company-context-head">
              <span>
                Empresa ativa
                {selectedCompany
                  ? ' · ' +
                    selectedCompany.establishmentCount +
                    ' estabelecimento' +
                    (selectedCompany.establishmentCount === 1 ? '' : 's')
                  : ''}
              </span>
              <h1>
                {selectedCompany?.legalName ??
                  'Empresas da conta'}
              </h1>
            </div>

            <div
              className="tp-org-tabs"
              role="tablist"
              aria-label="Organização"
            >
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
                  void queryClient.invalidateQueries({
                    queryKey: ['launch', 'account', tenantId],
                  })
                  void queryClient.invalidateQueries({
                    queryKey: ['launch', 'establishments'],
                  })
                }}
              />
            ) : !selectedCompany ? (
              <EmptyState title="Cadastre a empresa primeiro">
                O Perfil Tributário e os estabelecimentos dependem da empresa operacional.
              </EmptyState>
            ) : orgTab === 'estabelecimentos' ? (
              <EstablishmentSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                companyId={selectedCompany.id}
                companyCnpj={selectedCompany.cnpj}
                items={establishmentsQuery.data ?? []}
                types={typesQuery.data ?? []}
                loading={
                  establishmentsQuery.isPending ||
                  typesQuery.isPending
                }
                error={
                  establishmentsQuery.isError ||
                  typesQuery.isError
                }
                onChanged={() => {
                  void queryClient.invalidateQueries({
                    queryKey: ['launch', 'establishments'],
                  })
                  void queryClient.invalidateQueries({
                    queryKey: ['launch', 'account'],
                  })
                }}
              />
            ) : (
              <TaxProfileSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                company={selectedCompany}
                establishments={establishmentsQuery.data ?? []}
                profile={profileQuery.data ?? null}
                taxonomyOptions={
                  taxonomyOptionsQuery.data ?? {
                    release: null,
                    dimensions: [],
                  }
                }
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
                  void queryClient.invalidateQueries({
                    queryKey: ['launch', 'tax-profile'],
                  })
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
              description="Dados da sua conta e do acesso atual."
            />
            <div className="tp-settings-grid">
              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span>
                    <b>Usuário</b>
                    <small>
                      Conta e acesso
                    </small>
                  </span>
                </div>
                <div className="tp-settings-body">
                  <label>
                    Nome
                    <strong>
                      {displayName}
                    </strong>
                  </label>
                  <label>
                    E-mail
                    <strong>
                      {identity.email ??
                        '—'}
                    </strong>
                  </label>
                  <label>
                    Conta
                    <strong>
                      {tenantName}
                    </strong>
                  </label>
                  <label>
                    Papel
                    <strong>
                      {membership?.role ??
                        '—'}
                    </strong>
                  </label>
                </div>
              </section>

            </div>
          </>
        )}
      </main>
    </div>
  )
}

function monitoringStatusLabel(
  status: string,
) {
  switch (status) {
    case 'SUCCESS':
      return 'Concluída'
    case 'SUCCESS_NO_RESULTS':
      return 'Concluída sem novidades'
    case 'PARTIAL_SUCCESS':
      return 'Concluída com atenção'
    case 'SOURCE_UNAVAILABLE':
      return 'Fonte indisponível'
    case 'FETCH_FAILED':
      return 'Falha de consulta'
    case 'PROCESSING_FAILED':
      return 'Falha de processamento'
    case 'RUNNING':
      return 'Em execução'
    case 'PENDING':
      return 'Agendada'
    case 'CANCELLED':
      return 'Cancelada'
    default:
      return status
        .toLowerCase()
        .replaceAll('_', ' ')
  }
}

function monitoringStatusClass(
  status: string,
) {
  if (
    status === 'SUCCESS' ||
    status === 'SUCCESS_NO_RESULTS'
  ) {
    return 'is-success'
  }
  if (
    status === 'RUNNING' ||
    status === 'PENDING' ||
    status === 'PARTIAL_SUCCESS'
  ) {
    return 'is-attention'
  }
  return 'is-error'
}

function formatRunTimestamp(
  value: string | null,
) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(new Date(value))
}

function formatDuration(
  durationMs: number | null,
) {
  if (
    durationMs === null ||
    !Number.isFinite(durationMs)
  ) {
    return '—'
  }

  if (durationMs < 1000) {
    return durationMs + ' ms'
  }

  const seconds =
    durationMs / 1000
  return seconds < 60
    ? seconds.toFixed(
        seconds < 10 ? 1 : 0,
      ) + ' s'
    : Math.floor(seconds / 60) +
        ' min ' +
        Math.round(seconds % 60) +
        ' s'
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
    (total, run) =>
      total + run.importedDocuments,
    0,
  )
  const federal = sources.filter(
    (source) =>
      source.jurisdictionLevel ===
      'FEDERAL',
  )
  const states = sources.filter(
    (source) =>
      source.jurisdictionLevel ===
      'STATE',
  )

  const renderGroup = (
    title: string,
    items: PublicSource[],
  ) => (
    <section className="tp-monitor-group">
      <div className="tp-monitor-group-title">
        <h2>{title}</h2>
        <span>
          {items.length} fonte
          {items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="tp-monitor-sources">
        {items.map((source) => {
          const sourceRuns = runs.filter(
            (run) =>
              run.sourceCode ===
              source.code,
          )
          const lastRun =
            sourceRuns[0] ?? null

          return (
            <article
              className="tp-monitor-source-card"
              key={source.code}
            >
              <div className="tp-monitor-source-main">
                <span
                  className={
                    'tp-source-dot is-' +
                    sourceState(source)
                  }
                />
                <div className="tp-monitor-source-name">
                  <strong>
                    {source.name}
                  </strong>
                  <small>
                    {source.uf ??
                      'Federal'}
                  </small>
                </div>
                <div>
                  <span>Estado</span>
                  <b>
                    {sourceLabel(source)}
                  </b>
                </div>
                <div>
                  <span>
                    Última execução
                  </span>
                  <b>
                    {formatRunTimestamp(
                      lastRun?.startedAt ??
                        source.lastAttemptAt,
                    )}
                  </b>
                </div>
                <div>
                  <span>
                    Importados 24h
                  </span>
                  <b>
                    {sourceRuns.reduce(
                      (total, run) =>
                        total +
                        run.importedDocuments,
                      0,
                    )}
                  </b>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onToggleSource(
                      source.code,
                    )
                  }
                >
                  {expandedSource ===
                  source.code
                    ? 'Ocultar execuções'
                    : 'Ver últimas execuções'}
                </button>
              </div>

              {expandedSource ===
                source.code && (
                <div className="tp-run-history">
                  <div className="tp-run-history-head">
                    <span>Data/hora</span>
                    <span>Status</span>
                    <span>Tentativas</span>
                    <span>Encontrados</span>
                    <span>Importados</span>
                    <span>Duração</span>
                  </div>
                  {sourceRuns.length ===
                  0 ? (
                    <p>
                      Nenhuma execução
                      registrada nas últimas
                      24 horas.
                    </p>
                  ) : (
                    sourceRuns.map((run) => (
                      <div
                        className="tp-run-history-row"
                        key={run.id}
                      >
                        <span>
                          {formatRunTimestamp(
                            run.startedAt ??
                              run.scheduledFor,
                          )}
                        </span>
                        <span>
                          <em
                            className={
                              'tp-run-status ' +
                              monitoringStatusClass(
                                run.status,
                              )
                            }
                          >
                            {monitoringStatusLabel(
                              run.status,
                            )}
                          </em>
                        </span>
                        <span>
                          {run.attemptCount}
                        </span>
                        <span>
                          {run.foundItems}
                        </span>
                        <span>
                          <b>
                            {
                              run.importedDocuments
                            }
                          </b>
                        </span>
                        <span>
                          {formatDuration(
                            run.durationMs,
                          )}
                        </span>
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
        <article>
          <span>Fontes monitoradas</span>
          <strong>{sources.length}</strong>
        </article>
        <article>
          <span>Consultadas</span>
          <strong>{consulted}</strong>
        </article>
        <article>
          <span>Com atenção</span>
          <strong>
            {unavailable + unstable}
          </strong>
        </article>
        <article>
          <span>Importados 24h</span>
          <strong>{imported24h}</strong>
        </article>
      </div>

      {renderGroup(
        'Cobertura Federal',
        federal,
      )}
      {renderGroup(
        'Diários Oficiais Estaduais',
        states,
      )}
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
      return prefix + ' A consulta cadastral está temporariamente indisponível. Tente novamente em instantes.'
    case 'cnpj_provider_invalid_response':
      return prefix + ' A fonte cadastral respondeu com dados inválidos. Tente novamente.'
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
  const first = [
    item.street,
    item.streetNumber,
    item.complement,
  ].filter(Boolean).join(', ')
  const second = [
    item.district,
    item.municipalityName && item.uf
      ? item.municipalityName + '/' + item.uf
      : item.municipalityName ?? item.uf,
    item.postalCode
      ? 'CEP ' + item.postalCode
      : null,
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
        if (
          event.target === event.currentTarget &&
          !pending
        ) {
          onCancel()
        }
      }}
    >
      <section
        className="tp-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-confirm-title"
      >
        <div>
          <span className="tp-confirm-eyebrow">Confirmação</span>
          <h3 id="tp-confirm-title">{title}</h3>
          <p>{description}</p>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            Não foi possível concluir a exclusão. Tente novamente.
          </p>
        )}

        <div className="tp-confirm-actions">
          <button
            className="launch-secondary-button"
            type="button"
            disabled={pending}
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            className="tp-danger-button"
            type="button"
            disabled={pending}
            onClick={onConfirm}
          >
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
  account: Awaited<
    ReturnType<typeof fetchAccountSummary>
  >
  selectedCompanyId: string
  onSelect: (companyId: string) => void
  onOpenEstablishments: () => void
  onOpenProfile: () => void
  onChanged: () => void
}) {
  const [cnpj, setCnpj] = useState(
    account.onboarding?.cnpj ?? '',
  )
  const [
    businessLocationCode,
    setBusinessLocationCode,
  ] = useState('')
  const [creating, setCreating] = useState(
    account.companies.length === 0,
  )
  const [editing, setEditing] =
    useState<AccountCompany | null>(null)
  const [editLegalName, setEditLegalName] =
    useState('')
  const [
    editBusinessLocationCode,
    setEditBusinessLocationCode,
  ] = useState('')
  const [deleteCandidate, setDeleteCandidate] =
    useState<AccountCompany | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createCompanyFromCnpj(
        apiFetch,
        tenantId,
        cnpj,
        businessLocationCode,
      ),
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
      if (!editing) {
        throw new Error('company_required')
      }
      return updateCompany(
        apiFetch,
        tenantId,
        editing.id,
        {
          legalName: editLegalName,
          businessLocationCode:
            editBusinessLocationCode.trim() || null,
        },
      )
    },
    onSuccess: () => {
      setEditing(null)
      onChanged()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (companyId: string) =>
      deleteCompany(
        apiFetch,
        tenantId,
        companyId,
      ),
    onSuccess: (_result, deletedCompanyId) => {
      const hasRemainingCompany =
        account.companies.some(
          (company) =>
            company.id !== deletedCompanyId,
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
    setEditBusinessLocationCode(
      company.businessLocationCode ?? '',
    )
  }

  return (
    <div className="tp-company-management">
      <div className="tp-company-section-head">
        <div>
          <h2>Empresas da conta</h2>
          <p>
            Informe o CNPJ da matriz e, se desejar, o Local Negócio usado internamente.
            A TriBusca consulta o cadastro CNPJ/RFB, cria a matriz, registra todos os CNAEs
            e tenta consultar a Inscrição Estadual na fonte estadual oficial suportada para a UF.
          </p>
        </div>
        {!creating && (
          <button
            className="btn"
            type="button"
            onClick={() => setCreating(true)}
          >
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
              onChange={(event) =>
                setCnpj(event.target.value)
              }
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
              onChange={(event) =>
                setBusinessLocationCode(
                  event.target.value,
                )
              }
              placeholder="Código interno da matriz"
              maxLength={80}
            />
          </label>
          <button
            className="btn"
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? 'Consultando RFB e cadastro estadual…'
              : 'Consultar e cadastrar'}
          </button>
          {account.companies.length > 0 && (
            <button
              className="launch-secondary-button"
              type="button"
              onClick={() => setCreating(false)}
            >
              Cancelar
            </button>
          )}
          {createMutation.isError && (
            <p className="auth-error" role="alert">
              {registrationErrorMessage(
                createMutation.error,
                'empresa',
              )}
            </p>
          )}
        </form>
      )}

      <div className="tp-company-list">
        {account.companies.map((company) => (
          <article
            className={
              company.id === selectedCompanyId
                ? 'tp-company-row is-active'
                : 'tp-company-row'
            }
            key={company.id}
          >
            <div className="tp-company-identity">
              <strong>{company.legalName}</strong>
              <small>{formatCnpj(company.cnpj)}</small>
              {company.businessLocationCode && (
                <span>
                  Local Negócio · {company.businessLocationCode}
                </span>
              )}
            </div>

            <span className="tp-company-active">
              {company.id === selectedCompanyId
                ? 'Ativa'
                : 'Disponível'}
            </span>

            <dl>
              <div>
                <dt>Estabelecimentos</dt>
                <dd>{company.establishmentCount}</dd>
              </div>
              <div>
                <dt>Local Negócio</dt>
                <dd>
                  {company.businessLocationCode || '—'}
                </dd>
              </div>
              <div>
                <dt>Cadastro</dt>
                <dd>RFB / CNPJ</dd>
              </div>
            </dl>

            <div className="tp-company-actions">
              {company.id !== selectedCompanyId && (
                <button
                  type="button"
                  onClick={() => onSelect(company.id)}
                >
                  Selecionar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelect(company.id)
                  onOpenEstablishments()
                }}
              >
                Estabelecimentos
              </button>
              <button
                type="button"
                onClick={() => {
                  onSelect(company.id)
                  onOpenProfile()
                }}
              >
                Perfil tributário
              </button>
              <button
                type="button"
                onClick={() => beginEdit(company)}
              >
                <Pencil size={14} />
                Editar
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
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </article>
        ))}
      </div>

      {deleteCandidate && (
        <DangerConfirmDialog
          title="Excluir empresa?"
          description={
            'A empresa ' +
            deleteCandidate.legalName +
            ' será desativada junto com seus estabelecimentos. O histórico será preservado e o mesmo CNPJ poderá ser reativado depois.'
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
          onConfirm={() =>
            deleteMutation.mutate(deleteCandidate.id)
          }
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
            <span>
              CNPJ {formatCnpj(editing.cnpj)} — o CNPJ é a identidade cadastral e não é alterado manualmente.
            </span>
          </div>
          <label>
            Razão social
            <input
              value={editLegalName}
              onChange={(event) =>
                setEditLegalName(event.target.value)
              }
              required
            />
          </label>
          <label>
            Local Negócio
            <input
              value={editBusinessLocationCode}
              onChange={(event) =>
                setEditBusinessLocationCode(
                  event.target.value,
                )
              }
              placeholder="Código interno da matriz"
              maxLength={80}
            />
          </label>
          <div className="launch-form-actions">
            <button
              className="btn"
              type="submit"
              disabled={updateMutation.isPending}
            >
              Salvar alterações
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              onClick={() => setEditing(null)}
            >
              Cancelar
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
  types: Awaited<
    ReturnType<
      typeof fetchEstablishmentTypes
    >
  >
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [creating, setCreating] =
    useState(false)
  const [cnpj, setCnpj] =
    useState('')
  const [
    businessLocationCode,
    setBusinessLocationCode,
  ] = useState('')
  const [typeCode, setTypeCode] =
    useState('OTHER')
  const [editing, setEditing] =
    useState<Establishment | null>(null)
  const [draft, setDraft] =
    useState<Establishment | null>(null)
  const [deleteCandidate, setDeleteCandidate] =
    useState<Establishment | null>(null)

  const createMutation = useMutation({
    mutationFn: () =>
      createEstablishmentFromCnpj(
        apiFetch,
        tenantId,
        companyId,
        {
          cnpj,
          typeCode,
          businessLocationCode:
            businessLocationCode.trim() || undefined,
        },
      ),
    onSuccess: () => {
      setCreating(false)
      setCnpj('')
      setBusinessLocationCode('')
      onChanged()
    },
  })

  const refreshMutation = useMutation({
    mutationFn: (establishmentId: string) =>
      refreshEstablishmentCnpj(
        apiFetch,
        tenantId,
        establishmentId,
      ),
    onSuccess: onChanged,
  })

  const deleteMutation = useMutation({
    mutationFn: (establishmentId: string) =>
      deleteEstablishment(
        apiFetch,
        tenantId,
        establishmentId,
      ),
    onSuccess: () => {
      setDeleteCandidate(null)
      onChanged()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!draft) {
        throw new Error('establishment_required')
      }
      return updateEstablishment(
        apiFetch,
        tenantId,
        draft.id,
        {
          name: draft.name,
          typeCode: draft.typeCode,
          uf: draft.uf,
          municipalityName:
            draft.municipalityName,
          municipalityIbgeCode:
            draft.municipalityIbgeCode,
          postalCode: draft.postalCode,
          street: draft.street,
          streetNumber:
            draft.streetNumber,
          complement: draft.complement,
          district: draft.district,
          stateRegistration:
            draft.stateRegistration,
          businessLocationCode:
            draft.businessLocationCode,
          cnaes: draft.cnaes,
        },
      )
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
      cnaes: item.cnaes.map(
        (cnae) => ({ ...cnae }),
      ),
    })
  }

  const updateDraft = (
    patch: Partial<Establishment>,
  ) => {
    setDraft((current) =>
      current
        ? { ...current, ...patch }
        : current,
    )
  }

  const updateCnae = (
    index: number,
    patch: Partial<EstablishmentCnae>,
  ) => {
    setDraft((current) => {
      if (!current) return current
      const next = current.cnaes.map(
        (item, itemIndex) =>
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
            Matriz e filiais da empresa ativa. Ao informar um CNPJ, a TriBusca consulta
            endereço e CNAEs na base cadastral e tenta recuperar a Inscrição Estadual
            pela fonte oficial estadual suportada.
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
              onChange={(event) =>
                setCnpj(event.target.value)
              }
              placeholder="00.000.000/0000-00"
              required
              autoFocus
            />
          </label>
          <label>
            Local Negócio
            <input
              value={businessLocationCode}
              onChange={(event) =>
                setBusinessLocationCode(
                  event.target.value,
                )
              }
              placeholder="Código interno da filial"
              maxLength={80}
            />
          </label>
          <label>
            Tipo
            <select
              value={typeCode}
              onChange={(event) =>
                setTypeCode(event.target.value)
              }
            >
              {types
                .filter((type) => type.code !== 'HEAD_OFFICE')
                .map((type) => (
                  <option
                    value={type.code}
                    key={type.code}
                  >
                    {type.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="btn"
            type="submit"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? 'Consultando RFB e cadastro estadual…'
              : 'Consultar e cadastrar'}
          </button>
          <button
            className="launch-secondary-button"
            type="button"
            onClick={() => setCreating(false)}
          >
            Cancelar
          </button>
        </form>
      )}

      {createMutation.isError && (
        <p className="auth-error" role="alert">
          {registrationErrorMessage(
            createMutation.error,
            'estabelecimento',
          )}
        </p>
      )}

      <div className="tp-establishment-table-v2">
        <div className="tp-establishment-head">
          <span>Nome da unidade</span>
          <span>CNPJ</span>
          <span>Local Negócio</span>
          <span>Tipo</span>
          <span>Município/UF</span>
          <span>Endereço</span>
          <span>Inscrição estadual</span>
          <span>CNAE principal</span>
          <span>Ações</span>
        </div>

        {items.map((item) => {
          const primary = item.cnaes.find(
            (cnae) => cnae.isPrimary,
          )
          return (
            <div
              className="tp-establishment-row"
              key={item.id}
            >
              <div>
                <strong>{item.name}</strong>
                {item.isHeadOffice && (
                  <small>Matriz</small>
                )}
              </div>
              <span>{formatCnpj(item.cnpj)}</span>
              <span>
                {item.businessLocationCode || '—'}
              </span>
              <span>
                {types.find(
                  (type) =>
                    type.code === item.typeCode,
                )?.name ?? item.typeCode}
              </span>
              <span>
                {item.municipalityName
                  ? item.municipalityName + '/' + item.uf
                  : item.uf}
              </span>
              <span className="tp-address-cell">
                {registrationAddress(item)}
              </span>
              <span className="tp-state-registration-cell">
                <b>{item.stateRegistration || '—'}</b>
                {item.stateRegistrationLookupStatus === 'SUCCESS' && (
                  <small>
                    {item.stateRegistrationSource === 'SEFAZ_GO_SINTEGRA'
                      ? 'SEFAZ Goiás · SINTEGRA'
                      : 'Consulta estadual confirmada'}
                    {item.stateRegistrationStatus
                      ? ' · ' + item.stateRegistrationStatus
                      : ''}
                  </small>
                )}
                {item.stateRegistrationLookupStatus === 'NOT_FOUND' && (
                  <small>IE não localizada na consulta estadual</small>
                )}
                {item.stateRegistrationLookupStatus === 'UNAVAILABLE' && (
                  <small>Consulta estadual indisponível</small>
                )}
                {item.stateRegistrationLookupStatus === 'NOT_SUPPORTED' && (
                  <small>Consulta automática em implementação</small>
                )}
                {item.stateRegistrationSource === 'MANUAL' && (
                  <small>Informada manualmente</small>
                )}
              </span>
              <span className="tp-cnae-cell">
                {primary ? (
                  <>
                    <b>{primary.code}</b>
                    <small>{primary.description}</small>
                    {item.cnaes.length > 1 && (
                      <em>
                        + {item.cnaes.length - 1} secundário
                        {item.cnaes.length - 1 === 1 ? '' : 's'}
                      </em>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </span>
              <div className="tp-row-actions">
                <button
                  type="button"
                  disabled={refreshMutation.isPending}
                  onClick={() =>
                    refreshMutation.mutate(item.id)
                  }
                >
                  Atualizar RFB + IE
                </button>
                <button
                  type="button"
                  onClick={() => beginEdit(item)}
                >
                  Editar dados
                </button>
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
                    Excluir
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
          description={
            'O estabelecimento ' +
            deleteCandidate.name +
            ' será desativado. O histórico será preservado.'
          }
          confirmLabel="Excluir estabelecimento"
          pending={deleteMutation.isPending}
          error={deleteMutation.error}
          onCancel={() => {
            if (!deleteMutation.isPending) {
              deleteMutation.reset()
              setDeleteCandidate(null)
            }
          }}
          onConfirm={() =>
            deleteMutation.mutate(deleteCandidate.id)
          }
        />
      )}

      <p className="tp-registry-note">
        Dados cadastrais e CNAEs são consultados a partir do CNPJ/RFB. A
        Inscrição Estadual é buscada na fonte estadual oficial quando a UF já
        possui consulta automática. <b>Local Negócio</b> é um código interno
        informado manualmente e não é substituído pela consulta cadastral.
        Use <b>Atualizar RFB + IE</b> para consultar novamente ou
        <b>Editar dados</b> para ajustar manualmente. O CNPJ permanece como
        identidade do estabelecimento.
      </p>

      {editing && draft && (
        <form
          className="tp-establishment-editor"
          onSubmit={(event) => {
            event.preventDefault()
            updateMutation.mutate()
          }}
        >
          <div className="tp-editor-title">
            <div>
              <strong>Editar estabelecimento</strong>
              <span>{formatCnpj(draft.cnpj)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setDraft(null)
              }}
            >
              Fechar
            </button>
          </div>

          <div className="launch-form-grid">
            <label>
              Nome da unidade
              <input
                value={draft.name}
                onChange={(event) =>
                  updateDraft({
                    name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              Tipo
              <select
                value={draft.typeCode}
                onChange={(event) =>
                  updateDraft({
                    typeCode: event.target.value,
                  })
                }
                disabled={draft.isHeadOffice}
              >
                {types.map((type) => (
                  <option
                    value={type.code}
                    key={type.code}
                  >
                    {type.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              UF
              <select
                value={draft.uf}
                onChange={(event) =>
                  updateDraft({
                    uf: event.target.value,
                  })
                }
              >
                {UFS.filter(Boolean).map(
                  (uf) => (
                    <option value={uf} key={uf}>
                      {uf}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              Município
              <input
                value={draft.municipalityName ?? ''}
                onChange={(event) =>
                  updateDraft({
                    municipalityName:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Código IBGE
              <input
                value={draft.municipalityIbgeCode ?? ''}
                onChange={(event) =>
                  updateDraft({
                    municipalityIbgeCode:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              CEP
              <input
                value={draft.postalCode ?? ''}
                onChange={(event) =>
                  updateDraft({
                    postalCode:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Logradouro
              <input
                value={draft.street ?? ''}
                onChange={(event) =>
                  updateDraft({
                    street:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Número
              <input
                value={draft.streetNumber ?? ''}
                onChange={(event) =>
                  updateDraft({
                    streetNumber:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Complemento
              <input
                value={draft.complement ?? ''}
                onChange={(event) =>
                  updateDraft({
                    complement:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Bairro
              <input
                value={draft.district ?? ''}
                onChange={(event) =>
                  updateDraft({
                    district:
                      event.target.value || null,
                  })
                }
              />
            </label>
            <label>
              Local Negócio
              <input
                value={
                  draft.businessLocationCode ?? ''
                }
                onChange={(event) =>
                  updateDraft({
                    businessLocationCode:
                      event.target.value || null,
                  })
                }
                placeholder="Código interno da filial"
                maxLength={80}
              />
            </label>
            <label>
              Inscrição Estadual
              <input
                value={draft.stateRegistration ?? ''}
                onChange={(event) =>
                  updateDraft({
                    stateRegistration:
                      event.target.value || null,
                  })
                }
                placeholder="Consultada automaticamente quando disponível"
              />
            </label>
          </div>

          <div className="tp-cnae-editor">
            <div className="tp-cnae-editor-head">
              <div>
                <strong>CNAEs</strong>
                <span>
                  Um principal e todos os secundários usados no contexto cadastral.
                </span>
              </div>
              <button
                className="launch-secondary-button"
                type="button"
                onClick={() =>
                  updateDraft({
                    cnaes: [
                      ...draft.cnaes,
                      {
                        code: '',
                        description: '',
                        isPrimary:
                          draft.cnaes.length === 0,
                      },
                    ],
                  })
                }
              >
                Adicionar CNAE
              </button>
            </div>

            {draft.cnaes.map(
              (cnae, index) => (
                <div
                  className="tp-cnae-edit-row"
                  key={index}
                >
                  <label>
                    <input
                      type="radio"
                      name="primary-cnae"
                      aria-label={
                        'CNAE principal ' +
                        (cnae.code || index + 1)
                      }
                      checked={cnae.isPrimary}
                      onChange={() =>
                        updateCnae(index, {
                          isPrimary: true,
                        })
                      }
                    />
                    Principal
                  </label>
                  <input
                    value={cnae.code}
                    placeholder="0000000"
                    onChange={(event) =>
                      updateCnae(index, {
                        code:
                          event.target.value.replace(
                            /\D/g,
                            '',
                          ),
                      })
                    }
                  />
                  <input
                    value={cnae.description}
                    placeholder="Descrição do CNAE"
                    onChange={(event) =>
                      updateCnae(index, {
                        description:
                          event.target.value,
                      })
                    }
                  />
                  <button
                    className="is-danger"
                    type="button"
                    onClick={() =>
                      updateDraft({
                        cnaes: draft.cnaes.filter(
                          (_, itemIndex) =>
                            itemIndex !== index,
                        ),
                      })
                    }
                  >
                    Remover
                  </button>
                </div>
              ),
            )}
          </div>

          {updateMutation.isError && (
            <p className="auth-error" role="alert">
              Não foi possível salvar: {updateMutation.error.message}
            </p>
          )}

          <div className="launch-form-actions">
            <button
              className="btn"
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? 'Salvando…'
                : 'Salvar alterações'}
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              onClick={() => {
                setEditing(null)
                setDraft(null)
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <span className="sr-only">
        Matriz cadastrada: {formatCnpj(companyCnpj)}
      </span>
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

  const normalized =
    query.trim().toLocaleLowerCase('pt-BR')
  const concepts = dimension.concepts.filter(
    (concept) =>
      !normalized ||
      concept.label
        .toLocaleLowerCase('pt-BR')
        .includes(normalized) ||
      concept.code
        .toLocaleLowerCase('pt-BR')
        .includes(normalized),
  )

  const shown = normalized
    ? concepts.slice(0, 80)
    : concepts
        .filter((concept) =>
          selected.has(concept.code),
        )
        .concat(
          concepts
            .filter(
              (concept) =>
                !selected.has(concept.code),
            )
            .slice(0, 14),
        )

  return (
    <section className="tp-taxonomy-dimension">
      <div>
        <strong>{dimension.name}</strong>
        <span>
          {dimension.concepts.length} opções ·{' '}
          {
            dimension.concepts.filter(
              (concept) =>
                selected.has(concept.code),
            ).length
          } selecionadas
        </span>
      </div>
      <input
        value={query}
        onChange={(event) =>
          setQuery(event.target.value)
        }
        placeholder={
          'Buscar em ' +
          dimension.name.toLowerCase()
        }
        aria-label={
          'Buscar ' + dimension.name
        }
      />
      <div className="tp-taxonomy-options">
        {shown.map((concept) => (
          <label
            className={
              selected.has(concept.code)
                ? 'is-selected'
                : ''
            }
            key={concept.code}
            title={concept.definition}
          >
            <input
              type="checkbox"
              checked={selected.has(
                concept.code,
              )}
              onChange={() =>
                onToggle(concept.code)
              }
            />
            <span>
              <b>{concept.label}</b>
              <small>{concept.code}</small>
            </span>
            {selected.has(concept.code) && (
              <Check size={15} />
            )}
          </label>
        ))}
      </div>
    </section>
  )
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
  profile: Awaited<
    ReturnType<typeof fetchTaxProfile>
  >
  taxonomyOptions: TaxonomyProfileOptions
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [taxRegime, setTaxRegime] =
    useState(
      profile?.taxRegime ??
        'NAO_INFORMADO',
    )
  const [keywords, setKeywords] =
    useState(
      profile?.personalization.keywords?.join(
        ', ',
      ) ?? '',
    )
  const [selectedCodes, setSelectedCodes] =
    useState<Set<string>>(
      () =>
        new Set(
          profile?.personalization.taxonomy
            ?.conceptCodes ?? [],
        ),
    )

  useEffect(() => {
    setTaxRegime(
      profile?.taxRegime ??
        'NAO_INFORMADO',
    )
    setKeywords(
      profile?.personalization.keywords?.join(
        ', ',
      ) ?? '',
    )
    setSelectedCodes(
      new Set(
        profile?.personalization.taxonomy
          ?.conceptCodes ?? [],
      ),
    )
  }, [profile])

  const selectedLabels = (
    dimensionCode: string,
  ) =>
    taxonomyOptions.dimensions
      .find(
        (dimension) =>
          dimension.code ===
          dimensionCode,
      )
      ?.concepts.filter((concept) =>
        selectedCodes.has(concept.code),
      )
      .map((concept) => concept.label) ??
    []

  const mutation = useMutation({
    mutationFn: () =>
      saveTaxProfile(
        apiFetch,
        tenantId,
        company.id,
        {
          taxRegime,
          segments:
            selectedLabels('sector'),
          activities:
            selectedLabels('operation'),
          personalization: {
            taxes:
              selectedLabels('tax'),
            products:
              selectedLabels('product'),
            operations:
              selectedLabels('operation'),
            documents:
              selectedLabels('document'),
            obligations:
              selectedLabels('obligation'),
            keywords:
              splitCsv(keywords),
            taxonomy:
              taxonomyOptions.release
                ? {
                    releaseId:
                      taxonomyOptions.release.id,
                    releaseVersion:
                      taxonomyOptions.release.version,
                    conceptCodes:
                      [...selectedCodes].sort(),
                  }
                : null,
          },
        },
      ),
    onSuccess: onChanged,
  })

  if (loading) return <LoadingState />
  if (error) return <ErrorState />

  const ufs = [
    ...new Set(
      establishments.map(
        (item) => item.uf,
      ),
    ),
  ].sort()
  const municipalities = [
    ...new Set(
      establishments
        .map(
          (item) =>
            item.municipalityName,
        )
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  ].sort()
  const stateRegistrations = [
    ...new Set(
      establishments
        .map((item) => item.stateRegistration)
        .filter(
          (value): value is string =>
            Boolean(value),
        ),
    ),
  ].sort()
  const cnaes = [
    ...new Map(
      establishments
        .flatMap((item) => item.cnaes)
        .map((cnae) => [
          cnae.code,
          cnae,
        ]),
    ).values(),
  ].sort((left, right) =>
    left.code.localeCompare(right.code),
  )

  const toggleCode = (code: string) => {
    setSelectedCodes((current) => {
      const next = new Set(current)
      if (next.has(code)) {
        next.delete(code)
      } else {
        next.add(code)
      }
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
            Combina dados cadastrais automáticos com conceitos canônicos da Taxonomia
            TriBusca. Este contexto será usado no matching das legislações.
          </p>
        </div>
        {profile && (
          <span className="tp-profile-version">
            Perfil atual v{profile.versionNo}
          </span>
        )}
      </div>

      <section className="tp-profile-context">
        <div className="tp-profile-section-title">
          <span>1 · Automático</span>
          <h3>Contexto cadastral</h3>
          <p>
            Derivado da empresa e dos estabelecimentos. Não precisa ser digitado novamente.
          </p>
        </div>
        <div className="tp-context-grid">
          <article>
            <span>CNPJ da matriz</span>
            <strong>{formatCnpj(company.cnpj)}</strong>
          </article>
          <article>
            <span>Estabelecimentos</span>
            <strong>{establishments.length}</strong>
          </article>
          <article>
            <span>UFs</span>
            <strong>
              {ufs.join(', ') || '—'}
            </strong>
          </article>
          <article>
            <span>Municípios</span>
            <strong>
              {municipalities.join(', ') || '—'}
            </strong>
          </article>
          <article>
            <span>Inscrições estaduais</span>
            <strong>
              {stateRegistrations.join(', ') || '—'}
            </strong>
          </article>
        </div>
        <div className="tp-profile-cnaes">
          <strong>CNAEs capturados</strong>
          {cnaes.length ? (
            <div>
              {cnaes.map((cnae) => (
                <span key={cnae.code}>
                  <b>{cnae.code}</b>
                  {cnae.description}
                </span>
              ))}
            </div>
          ) : (
            <p>
              Nenhum CNAE cadastrado. Atualize os estabelecimentos pela Consulta API.
            </p>
          )}
        </div>
      </section>

      <section className="tp-profile-declared">
        <div className="tp-profile-section-title">
          <span>2 · Declarado</span>
          <h3>Contexto fiscal</h3>
          <p>
            Dados que dependem da realidade fiscal da empresa e não são inferidos pelo CNPJ.
          </p>
        </div>
        <div className="launch-form-grid">
          <label>
            Regime tributário
            <select
              value={taxRegime}
              onChange={(event) =>
                setTaxRegime(
                  event.target.value,
                )
              }
            >
              <option value="NAO_INFORMADO">
                Não informado
              </option>
              <option value="LUCRO_REAL">
                Lucro Real
              </option>
              <option value="LUCRO_PRESUMIDO">
                Lucro Presumido
              </option>
              <option value="SIMPLES_NACIONAL">
                Simples Nacional
              </option>
              <option value="IMUNE_ISENTA">
                Imune/Isenta
              </option>
              <option value="OUTRO">
                Outro
              </option>
            </select>
          </label>
          <label>
            Palavras-chave adicionais
            <input
              value={keywords}
              onChange={(event) =>
                setKeywords(
                  event.target.value,
                )
              }
              placeholder="ex.: crédito presumido, barter"
            />
          </label>
        </div>
      </section>

      <section className="tp-profile-taxonomy">
        <div className="tp-profile-section-title">
          <span>3 · Taxonomia</span>
          <h3>Marcadores para o Sonar</h3>
          <p>
            Selecione conceitos do vocabulário controlado. O perfil salva os códigos canônicos,
            não tags livres.
          </p>
        </div>

        {taxonomyOptions.release ? (
          <>
            <div className="tp-taxonomy-release">
              <span>
                Taxonomia publicada
              </span>
              <strong>
                {taxonomyOptions.release.version}
              </strong>
              <em>
                {selectedCodes.size} conceito
                {selectedCodes.size === 1 ? '' : 's'} selecionado
                {selectedCodes.size === 1 ? '' : 's'}
              </em>
            </div>
            <div className="tp-taxonomy-grid">
              {taxonomyOptions.dimensions.map(
                (dimension) => (
                  <TaxonomyDimensionPicker
                    dimension={dimension}
                    selected={selectedCodes}
                    onToggle={toggleCode}
                    key={dimension.code}
                  />
                ),
              )}
            </div>
          </>
        ) : (
          <div className="tp-taxonomy-unavailable">
            <strong>Taxonomia publicada ainda não disponível</strong>
            <p>
              A tela já está preparada. As opções aparecerão automaticamente quando uma release
              da Taxonomia TriBusca for publicada.
            </p>
          </div>
        )}
      </section>

      {mutation.isError && (
        <p className="auth-error" role="alert">
          Não foi possível salvar o perfil: {mutation.error.message}
        </p>
      )}

      <div className="tp-profile-save">
        <div>
          <strong>
            {selectedCodes.size} marcador
            {selectedCodes.size === 1 ? '' : 'es'} canônico
            {selectedCodes.size === 1 ? '' : 's'}
          </strong>
          <span>
            Uma nova versão do perfil preserva o histórico do contexto usado no matching.
          </span>
        </div>
        <button
          className="btn"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? 'Salvando…'
            : profile
              ? 'Salvar nova versão'
              : 'Criar Perfil Tributário'}
        </button>
      </div>
    </form>
  )
}

