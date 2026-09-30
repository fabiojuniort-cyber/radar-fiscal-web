import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Building2,
  ChevronDown,
  ExternalLink,
  Landmark,
  LogOut,
  RefreshCw,
  Search,
  Settings,
} from 'lucide-react'
import {
  FormEvent,
  useState,
} from 'react'

import type { PanelIdentity } from './panel-experience'
import {
  fetchPublicSources,
  fetchPublicStats,
  formatLastSuccessAt,
  formatPublicDate,
  type PublicSource,
} from './public-api'
import {
  createCompany,
  createEstablishment,
  fetchAccountSummary,
  fetchEstablishmentTypes,
  fetchEstablishments,
  fetchTaxProfile,
  fetchProductArchive,
  saveTaxProfile,
  type ProductApiFetch,
  type ProductArchiveItem,
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
  text = 'Carregando dados reais…',
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

        if (item.officialUrl) {
          return (
            <a
              className="tp-publication-row tp-publication-link"
              href={item.officialUrl}
              target="_blank"
              rel="noreferrer"
              key={item.id}
            >
              <ExternalLink
                size={17}
                aria-hidden="true"
              />
              {body}
            </a>
          )
        }

        return (
          <div
            className="tp-publication-row"
            key={item.id}
          >
            <span aria-hidden="true">•</span>
            {body}
          </div>
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
        A API respondeu sem fontes
        cadastradas.
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
  const membership =
    identity.memberships?.[0]
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
  const firstCompany =
    account?.companies[0]

  const establishmentsQuery = useQuery({
    queryKey: [
      'launch',
      'establishments',
      tenantId,
      firstCompany?.id,
    ],
    queryFn: () =>
      fetchEstablishments(
        apiFetch,
        tenantId!,
        firstCompany!.id,
      ),
    enabled: Boolean(
      tenantId && firstCompany?.id,
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
      firstCompany?.id,
    ],
    queryFn: () =>
      fetchTaxProfile(
        apiFetch,
        tenantId!,
        firstCompany!.id,
      ),
    enabled: Boolean(
      tenantId && firstCompany?.id,
    ),
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

          <div className="tp-company-button launch-account-static">
            <span className="tp-company-copy">
              <small>
                Conta autenticada
              </small>
              <strong>{tenantName}</strong>
              <span>
                {membership?.role ??
                  'Usuário'}
              </span>
            </span>
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

          <span className="tp-account-pill">
            Dados reais
          </span>

          <div className="tp-pop-wrap tp-user-wrap">
            <button
              className="tp-user-button"
              type="button"
              aria-label="Menu do usuário"
              aria-expanded={userMenu}
              onClick={() =>
                setUserMenu(
                  (value) => !value,
                )
              }
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
                    {membership?.role ??
                      'Usuário'}
                  </small>
                </div>
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
                        {firstCompany
                          ? firstCompany
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
              eyebrow="Saúde operacional global"
              title="Central de Monitoramento"
              description="Distingue fonte consultada, instabilidade, indisponibilidade e ausência de execução."
            />
            {sourcesQuery.isPending ? (
              <LoadingState />
            ) : sourcesQuery.isError ? (
              <ErrorState />
            ) : (
              <div className="tp-monitor-grid">
                <div className="tp-monitor-summary">
                  <article>
                    <span>
                      Fontes monitoradas
                    </span>
                    <strong>
                      {sources.length}
                    </strong>
                  </article>
                  <article>
                    <span>
                      Consultadas
                    </span>
                    <strong>
                      {consulted}
                    </strong>
                  </article>
                  <article>
                    <span>
                      Indisponíveis
                    </span>
                    <strong>
                      {unavailable}
                    </strong>
                  </article>
                  <article>
                    <span>
                      Instáveis
                    </span>
                    <strong>
                      {unstable}
                    </strong>
                  </article>
                </div>
                <SourceHealth
                  items={sources}
                />
              </div>
            )}
          </>
        )}

        {screen === 'fontes' && (
          <>
            <SectionHeading
              eyebrow="Cobertura legislativa"
              title="Fontes Oficiais"
              description="Catálogo real das fontes cadastradas e do volume já associado ao Acervo."
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
            <SectionHeading
              eyebrow="Organização"
              title="Empresas"
              description="Cadastre a empresa operacional, seus estabelecimentos e o Perfil Tributário usados pelo produto."
            />
            <div
              className="tp-org-tabs"
              role="tablist"
              aria-label="Organização"
            >
              <button
                type="button"
                role="tab"
                aria-selected={
                  orgTab === 'empresa'
                }
                onClick={() =>
                  setOrgTab('empresa')
                }
              >
                Empresa
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={
                  orgTab ===
                  'estabelecimentos'
                }
                onClick={() =>
                  setOrgTab(
                    'estabelecimentos',
                  )
                }
              >
                Estabelecimentos
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={
                  orgTab === 'perfil'
                }
                onClick={() =>
                  setOrgTab('perfil')
                }
              >
                Perfil Tributário
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
                onChanged={() =>
                  void queryClient.invalidateQueries(
                    {
                      queryKey: [
                        'launch',
                        'account',
                        tenantId,
                      ],
                    },
                  )
                }
              />
            ) : !firstCompany ? (
              <EmptyState title="Cadastre a empresa primeiro">
                O Perfil Tributário e os
                estabelecimentos dependem
                da empresa operacional.
              </EmptyState>
            ) : orgTab ===
              'estabelecimentos' ? (
              <EstablishmentSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                companyId={
                  firstCompany.id
                }
                companyCnpj={
                  firstCompany.cnpj
                }
                items={
                  establishmentsQuery
                    .data ?? []
                }
                types={
                  typesQuery.data ?? []
                }
                loading={
                  establishmentsQuery.isPending ||
                  typesQuery.isPending
                }
                error={
                  establishmentsQuery.isError ||
                  typesQuery.isError
                }
                onChanged={() => {
                  void queryClient.invalidateQueries(
                    {
                      queryKey: [
                        'launch',
                        'establishments',
                      ],
                    },
                  )
                  void queryClient.invalidateQueries(
                    {
                      queryKey: [
                        'launch',
                        'account',
                      ],
                    },
                  )
                }}
              />
            ) : (
              <TaxProfileSection
                apiFetch={apiFetch}
                tenantId={tenantId}
                companyId={
                  firstCompany.id
                }
                profile={
                  profileQuery.data ??
                  null
                }
                loading={
                  profileQuery.isPending
                }
                error={
                  profileQuery.isError
                }
                onChanged={() =>
                  void queryClient.invalidateQueries(
                    {
                      queryKey: [
                        'launch',
                        'tax-profile',
                      ],
                    },
                  )
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
              description="Identidade autenticada e contexto do tenant atual."
            />
            <div className="tp-settings-grid">
              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span>
                    <b>Usuário</b>
                    <small>
                      Sessão real
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

              <section className="tp-panel-card">
                <div className="tp-card-head">
                  <span>
                    <b>
                      Estado do produto
                    </b>
                    <small>
                      Release candidate
                    </small>
                  </span>
                </div>
                <div className="tp-settings-body">
                  <p>
                    Acervo, fontes e
                    estrutura da conta
                    usam dados reais.
                  </p>
                  <p>
                    Sonar/Revela só serão
                    apresentados como
                    resultados quando o
                    matching real tiver
                    sido executado.
                  </p>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function CompanySection({
  apiFetch,
  tenantId,
  account,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  account: Awaited<
    ReturnType<
      typeof fetchAccountSummary
    >
  >
  onChanged: () => void
}) {
  const [legalName, setLegalName] =
    useState(
      account.onboarding
        ?.companyName ?? '',
    )
  const [tradeName, setTradeName] =
    useState('')
  const [cnpj, setCnpj] = useState(
    account.onboarding?.cnpj ?? '',
  )

  const mutation = useMutation({
    mutationFn: () =>
      createCompany(
        apiFetch,
        tenantId,
        {
          legalName,
          tradeName:
            tradeName || undefined,
          cnpj,
        },
      ),
    onSuccess: onChanged,
  })

  if (
    account.companies.length > 0
  ) {
    return (
      <div className="tp-company-cards">
        {account.companies.map(
          (company) => (
            <article
              className="is-primary"
              key={company.id}
            >
              <div>
                <Building2 size={22} />
                <span>
                  <strong>
                    {company.legalName}
                  </strong>
                  <small>
                    {company.cnpj}
                  </small>
                </span>
              </div>
              <dl>
                <div>
                  <dt>
                    Estabelecimentos
                  </dt>
                  <dd>
                    {
                      company.establishmentCount
                    }
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {company.isActive
                      ? 'Ativa'
                      : 'Inativa'}
                  </dd>
                </div>
              </dl>
            </article>
          ),
        )}
      </div>
    )
  }

  return (
    <form
      className="launch-form-card"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <h2>
        Complete o cadastro da empresa
      </h2>
      <p>
        O tenant já existe. Agora informe
        os dados operacionais usados pelo
        Perfil Tributário.
      </p>
      <label>
        Razão social
        <input
          value={legalName}
          onChange={(event) =>
            setLegalName(
              event.target.value,
            )
          }
          required
        />
      </label>
      <label>
        Nome fantasia
        <input
          value={tradeName}
          onChange={(event) =>
            setTradeName(
              event.target.value,
            )
          }
        />
      </label>
      <label>
        CNPJ
        <input
          value={cnpj}
          onChange={(event) =>
            setCnpj(event.target.value)
          }
          required
        />
      </label>
      {mutation.isError && (
        <p
          className="auth-error"
          role="alert"
        >
          Não foi possível criar a
          empresa: {mutation.error.message}
        </p>
      )}
      <button
        className="btn"
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending
          ? 'Salvando…'
          : 'Salvar empresa'}
      </button>
    </form>
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
  items: Awaited<
    ReturnType<
      typeof fetchEstablishments
    >
  >
  types: Awaited<
    ReturnType<
      typeof fetchEstablishmentTypes
    >
  >
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [cnpj, setCnpj] =
    useState(companyCnpj)
  const [typeCode, setTypeCode] =
    useState('HEAD_OFFICE')
  const [uf, setUf] = useState('GO')
  const [municipality, setMunicipality] =
    useState('')

  const mutation = useMutation({
    mutationFn: () =>
      createEstablishment(
        apiFetch,
        tenantId,
        {
          companyId,
          cnpj,
          name,
          typeCode,
          isHeadOffice:
            typeCode === 'HEAD_OFFICE',
          uf,
          municipalityName:
            municipality || undefined,
        },
      ),
    onSuccess: () => {
      setName('')
      onChanged()
    },
  })

  if (loading) return <LoadingState />
  if (error) return <ErrorState />

  return (
    <div className="launch-stack">
      {items.length > 0 ? (
        <div className="tp-establishment-table">
          <div className="tp-table-head">
            <span>Unidade</span>
            <span>CNPJ</span>
            <span>UF</span>
            <span>Tipo</span>
          </div>
          {items.map((item) => (
            <div
              className="tp-table-row"
              key={item.id}
            >
              <span>{item.name}</span>
              <span>{item.cnpj}</span>
              <span>{item.uf}</span>
              <span>{item.typeCode}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Nenhum estabelecimento cadastrado">
          Cadastre a matriz ou uma filial.
        </EmptyState>
      )}

      <form
        className="launch-form-card"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate()
        }}
      >
        <h2>
          Adicionar estabelecimento
        </h2>
        <div className="launch-form-grid">
          <label>
            Nome
            <input
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label>
            CNPJ
            <input
              value={cnpj}
              onChange={(event) =>
                setCnpj(
                  event.target.value,
                )
              }
              required
            />
          </label>
          <label>
            Tipo
            <select
              value={typeCode}
              onChange={(event) =>
                setTypeCode(
                  event.target.value,
                )
              }
            >
              {types.map((item) => (
                <option
                  value={item.code}
                  key={item.code}
                >
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            UF
            <select
              value={uf}
              onChange={(event) =>
                setUf(
                  event.target.value,
                )
              }
            >
              {UFS.filter(Boolean).map(
                (item) => (
                  <option
                    value={item}
                    key={item}
                  >
                    {item}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Município
            <input
              value={municipality}
              onChange={(event) =>
                setMunicipality(
                  event.target.value,
                )
              }
            />
          </label>
        </div>
        {mutation.isError && (
          <p
            className="auth-error"
            role="alert"
          >
            Não foi possível cadastrar:
            {' '}
            {mutation.error.message}
          </p>
        )}
        <button
          className="btn"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? 'Salvando…'
            : 'Adicionar estabelecimento'}
        </button>
      </form>
    </div>
  )
}

function TaxProfileSection({
  apiFetch,
  tenantId,
  companyId,
  profile,
  loading,
  error,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  companyId: string
  profile: Awaited<
    ReturnType<typeof fetchTaxProfile>
  >
  loading: boolean
  error: boolean
  onChanged: () => void
}) {
  const [taxRegime, setTaxRegime] =
    useState(
      profile?.taxRegime ??
        'NAO_INFORMADO',
    )
  const [segments, setSegments] =
    useState(
      profile?.segments.join(', ') ??
        '',
    )
  const [activities, setActivities] =
    useState(
      Array.isArray(
        profile?.activities,
      )
        ? profile?.activities.join(
            ', ',
          )
        : '',
    )
  const [taxes, setTaxes] = useState(
    profile?.personalization.taxes?.join(
      ', ',
    ) ?? '',
  )
  const [products, setProducts] =
    useState(
      profile?.personalization.products?.join(
        ', ',
      ) ?? '',
    )
  const [operations, setOperations] =
    useState(
      profile?.personalization.operations?.join(
        ', ',
      ) ?? '',
    )
  const [documents, setDocuments] =
    useState(
      profile?.personalization.documents?.join(
        ', ',
      ) ?? '',
    )
  const [obligations, setObligations] =
    useState(
      profile?.personalization.obligations?.join(
        ', ',
      ) ?? '',
    )
  const [keywords, setKeywords] =
    useState(
      profile?.personalization.keywords?.join(
        ', ',
      ) ?? '',
    )

  const mutation = useMutation({
    mutationFn: () =>
      saveTaxProfile(
        apiFetch,
        tenantId,
        companyId,
        {
          taxRegime,
          segments:
            splitCsv(segments),
          activities:
            splitCsv(activities),
          personalization: {
            taxes: splitCsv(taxes),
            products:
              splitCsv(products),
            operations:
              splitCsv(operations),
            documents:
              splitCsv(documents),
            obligations:
              splitCsv(obligations),
            keywords:
              splitCsv(keywords),
          },
        },
      ),
    onSuccess: onChanged,
  })

  if (loading) return <LoadingState />
  if (error) return <ErrorState />

  return (
    <form
      className="launch-form-card"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <h2>Perfil Tributário</h2>
      <p>
        Use vírgulas para separar vários
        valores. Estes dados serão a base
        do matching do Sonar.
      </p>

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
          Segmentos
          <input
            value={segments}
            onChange={(event) =>
              setSegments(
                event.target.value,
              )
            }
            placeholder="Agronegócio, sementes"
          />
        </label>
        <label>
          Atividades
          <input
            value={activities}
            onChange={(event) =>
              setActivities(
                event.target.value,
              )
            }
            placeholder="Venda, armazenagem"
          />
        </label>
        <label>
          Tributos
          <input
            value={taxes}
            onChange={(event) =>
              setTaxes(
                event.target.value,
              )
            }
            placeholder="ICMS, IBS, CBS"
          />
        </label>
        <label>
          Produtos
          <input
            value={products}
            onChange={(event) =>
              setProducts(
                event.target.value,
              )
            }
            placeholder="Soja, fertilizantes"
          />
        </label>
        <label>
          Operações
          <input
            value={operations}
            onChange={(event) =>
              setOperations(
                event.target.value,
              )
            }
            placeholder="Venda interestadual"
          />
        </label>
        <label>
          Documentos
          <input
            value={documents}
            onChange={(event) =>
              setDocuments(
                event.target.value,
              )
            }
            placeholder="NF-e, CT-e"
          />
        </label>
        <label>
          Obrigações
          <input
            value={obligations}
            onChange={(event) =>
              setObligations(
                event.target.value,
              )
            }
            placeholder="EFD, SPED"
          />
        </label>
        <label>
          Palavras-chave
          <input
            value={keywords}
            onChange={(event) =>
              setKeywords(
                event.target.value,
              )
            }
            placeholder="crédito presumido, diferimento"
          />
        </label>
      </div>

      {mutation.isError && (
        <p
          className="auth-error"
          role="alert"
        >
          Não foi possível salvar o
          perfil: {mutation.error.message}
        </p>
      )}

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

      {profile && (
        <p className="launch-success-note">
          Perfil atual v
          {profile.versionNo} · válido
          desde{' '}
          {profile.validFrom ?? '—'}
        </p>
      )}
    </form>
  )
}
