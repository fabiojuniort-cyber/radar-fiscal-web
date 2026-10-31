import {OnboardingProfileScreen} from './onboarding-profile-screen'
import type {EstablishmentType} from './product-api'
import { useBuildVersionGuard, BuildVersionNotice } from './build-version'
import { OnboardingAssistant } from './onboarding-assistant'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import {
  Building2,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  FileText,
  HelpCircle,
  Landmark,
  LogOut,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Link } from 'react-router-dom'

import { BrandMark } from './brand-mark'
import { anatomyConfigEnabled } from './anatomy-config-flag'
import { manualIeActionLabel, manualIeHelperText } from './t06-ie-manual'
import type { PanelIdentity } from './panel-experience'
import { NewsSection as LiveNewsSection } from './news-section'
import { ProductNcmProfiles } from './product-ncm-profiles'
import { fetchCompanyCnaeNcms, fetchCompanyProductProfiles } from './product-ncm-api'
import { NcmProfileCard, TaxonomyDimensionPicker, type DerivedTag } from './profile-taxonomy-cards'
import {
  fetchAdminMe,
  fetchTaxonomySuggestions,
} from './taxonomy-api'
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
  fetchCatalogFacetOptions,
  fetchCatalogNavigation,
  type CatalogNavigationFilters,
  type CatalogNavigationGroup,
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

type AcervoView = 'pesquisa' | 'navegacao'
type ArchiveNavigationRoute = 'jurisdiction' | 'actType' | 'source' | 'period'
type ArchiveNavigationCrumb = {
  group: CatalogNavigationGroup
  value: string
  label: string
  count: number
}

const ARCHIVE_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const archiveNavigationGroupLabels: Record<CatalogNavigationGroup, string> = {
  jurisdiction: 'Esfera',
  uf: 'Estado / UF',
  source: 'Órgão / Fonte',
  actType: 'Tipo de legislação',
  year: 'Ano',
  month: 'Mês',
}

function nextArchiveNavigationGroup(
  route: ArchiveNavigationRoute,
  path: ArchiveNavigationCrumb[],
): CatalogNavigationGroup | null {
  const has = (group: CatalogNavigationGroup) => path.some((item) => item.group === group)
  const isState = path.find((item) => item.group === 'jurisdiction')?.value === 'STATE'

  const routeSteps: CatalogNavigationGroup[] =
    route === 'jurisdiction'
      ? ['jurisdiction', ...(isState ? ['uf' as const] : []), 'source', 'actType', 'year', 'month']
      : route === 'actType'
        ? ['actType', 'jurisdiction', ...(isState ? ['uf' as const] : []), 'source', 'year', 'month']
        : route === 'source'
          ? ['source', 'actType', 'year', 'month']
          : ['year', 'month', 'jurisdiction', ...(isState ? ['uf' as const] : []), 'source', 'actType']

  return routeSteps.find((group) => !has(group)) ?? null
}

function archiveNavigationDateRange(path: ArchiveNavigationCrumb[]) {
  const year = Number(path.find((item) => item.group === 'year')?.value)
  const month = Number(path.find((item) => item.group === 'month')?.value)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const monthPart = String(month).padStart(2, '0')
  return {
    from: `${year}-${monthPart}-01`,
    to: `${year}-${monthPart}-${String(lastDay).padStart(2, '0')}`,
    year,
    month,
  }
}

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

  if (parts.length === 0) return 'TF'
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
      fullText?: boolean
      archivePage?: number
      jurisdiction?: string
      uf?: string
      source?: string
      actType?: string
      archiveTag?: { code: string; label: string } | null
      archiveView?: AcervoView
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

// Global catalog aggregates are not real-time: the backend caches them for up
// to 1 h, so refetching them on every panel mount only adds load.
const CATALOG_AGGREGATE_STALE_MS = 30 * 60_000

export function AuthenticatedProductPanel({
  identity,
  apiFetch: rawApiFetch,
  onExit,
  exitError,
}: Props) {
  const { apiFetch, newVersion } = useBuildVersionGuard(rawApiFetch)
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
    identity.name || identity.email || 'Usuário TriFaros'
  const tenantName = membership?.tenantName ?? 'Conta TriFaros'

  const [screen, setScreen] = useState<Screen>(persisted?.screen ?? 'inicio')
  const [query, setQuery] = useState(persisted?.query ?? '')
  const [appliedQuery, setAppliedQuery] = useState(persisted?.appliedQuery ?? '')
  const [fullText, setFullText] = useState(persisted?.fullText ?? false)
  const [archivePage, setArchivePage] = useState(persisted?.archivePage ?? 1)
  const [jurisdiction, setJurisdiction] = useState(persisted?.jurisdiction ?? '')
  const [uf, setUf] = useState(persisted?.uf ?? '')
  const [source, setSource] = useState(persisted?.source ?? '')
  const [actType, setActType] = useState(persisted?.actType ?? '')
  const [archiveView, setArchiveView] = useState<AcervoView>(persisted?.archiveView ?? 'pesquisa')
  const [archiveNavigationRoute, setArchiveNavigationRoute] =
    useState<ArchiveNavigationRoute>('jurisdiction')
  const [archiveNavigationPath, setArchiveNavigationPath] =
    useState<ArchiveNavigationCrumb[]>([])
  const [archiveNavigationPage, setArchiveNavigationPage] = useState(1)
  // TAX-11: tag filter handed over from a legislation page.
  const [archiveTag, setArchiveTag] = useState<{ code: string; label: string } | null>(
    persisted?.archiveTag ?? null,
  )
  const [assistantOpen,setAssistantOpen]=useState(false)
  const [assistantAnimate,setAssistantAnimate]=useState(false)
  const [assistantUnit,setAssistantUnit]=useState<string|undefined>()
  const [profileUnit,setProfileUnit]=useState<string|undefined>(),[assistantCard,setAssistantCard]=useState<string|undefined>()
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
        fullText,
        archivePage,
        jurisdiction,
        uf,
        source,
        actType,
        archiveTag,
        archiveView,

        selectedCompanyId,
      }),
    )
  }, [
    screen,
    query,
    appliedQuery,
    fullText,
    archivePage,
    jurisdiction,
    uf,
    source,
    actType,
    archiveTag,
    archiveView,
    selectedCompanyId,
  ])

  useEffect(() => {
    setSelectedCompanyId('')
    setAssistantOpen(false)
    setAssistantUnit(undefined)
    setProfileUnit(undefined)
    setAssistantCard(undefined)
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

  // Keep dropdown options independent of every active search filter.
  // The archive query below still applies all selected criteria to results.
  const facetsQuery = useQuery({
    queryKey: ['launch', 'archive-facets', 'all'],
    queryFn: () => fetchCatalogFacetOptions(apiFetch),
    enabled: screen === 'acervo',
    retry: false,
    staleTime: CATALOG_AGGREGATE_STALE_MS,
  })

  const latestArchiveQuery = useQuery({
    queryKey: ['launch', 'archive-v2', 'latest'],
    queryFn: () => fetchCatalogArchive(apiFetch, { page: 1, limit: 5 }),
    retry: false,
  })

  // Publicações always lists the most recent acts; the Acervo filters and
  // search must not leak into it.
  const recentPublicationsQuery = useQuery({
    queryKey: ['launch', 'archive-v2', 'recent'],
    queryFn: () => fetchCatalogArchive(apiFetch, { page: 1, limit: 25 }),
    enabled: screen === 'publicacoes',
    retry: false,
  })

  const archiveQuery = useQuery({
    queryKey: [
      'launch',
      'archive-v2',
      appliedQuery,
      fullText,
      jurisdiction,
      uf,
      source,
      actType,
      archiveTag?.code,
      archivePage,
    ],
    queryFn: () =>
      fetchCatalogArchive(apiFetch, {
        q: appliedQuery.trim().length >= 2
          ? appliedQuery.trim()
          : undefined,
        scope: fullText ? 'full' : 'title',
        jurisdiction:
          jurisdiction === 'FEDERAL' || jurisdiction === 'STATE'
            ? jurisdiction
            : undefined,
        uf: uf || undefined,
        source: source || undefined,
        actType: actType || undefined,
        tag: archiveTag?.code,
        page: archivePage,
        limit: 25,
      }),
    retry: false,
  })

  const archiveNavigationSelection = useMemo(() => {
    const selected: Partial<Record<CatalogNavigationGroup, string>> = {}
    for (const item of archiveNavigationPath) selected[item.group] = item.value
    return selected
  }, [archiveNavigationPath])

  const archiveNavigationGroup = useMemo(
    () => nextArchiveNavigationGroup(archiveNavigationRoute, archiveNavigationPath),
    [archiveNavigationRoute, archiveNavigationPath],
  )

  const archiveNavigationFilters: Omit<CatalogNavigationFilters, 'groupBy'> = {
    jurisdiction:
      archiveNavigationSelection.jurisdiction === 'FEDERAL' ||
      archiveNavigationSelection.jurisdiction === 'STATE'
        ? archiveNavigationSelection.jurisdiction
        : undefined,
    uf: archiveNavigationSelection.uf,
    source: archiveNavigationSelection.source,
    actType: archiveNavigationSelection.actType,
    year: archiveNavigationSelection.year
      ? Number(archiveNavigationSelection.year)
      : undefined,
    month: archiveNavigationSelection.month
      ? Number(archiveNavigationSelection.month)
      : undefined,
  }

  const archiveNavigationOptionsQuery = useQuery({
    queryKey: [
      'launch',
      'archive-navigation',
      archiveNavigationRoute,
      archiveNavigationGroup,
      archiveNavigationPath.map((item) => [item.group, item.value]),
    ],
    queryFn: () =>
      fetchCatalogNavigation(apiFetch, {
        groupBy: archiveNavigationGroup ?? 'jurisdiction',
        ...archiveNavigationFilters,
      }),
    enabled:
      screen === 'acervo' &&
      archiveView === 'navegacao' &&
      archiveNavigationGroup !== null,
    retry: false,
    staleTime: CATALOG_AGGREGATE_STALE_MS,
  })

  const archiveNavigationRange = useMemo(
    () => archiveNavigationDateRange(archiveNavigationPath),
    [archiveNavigationPath],
  )

  const archiveNavigationArchiveQuery = useQuery({
    queryKey: [
      'launch',
      'archive-navigation-results',
      archiveNavigationPath.map((item) => [item.group, item.value]),
      archiveNavigationPage,
    ],
    queryFn: () =>
      fetchCatalogArchive(apiFetch, {
        jurisdiction: archiveNavigationFilters.jurisdiction,
        uf: archiveNavigationFilters.uf,
        source: archiveNavigationFilters.source,
        actType: archiveNavigationFilters.actType,
        publishedFrom: archiveNavigationRange?.from,
        publishedTo: archiveNavigationRange?.to,
        page: archiveNavigationPage,
        limit: 25,
      }),
    enabled:
      screen === 'acervo' &&
      archiveView === 'navegacao' &&
      archiveNavigationGroup === null &&
      archiveNavigationRange !== null,
    retry: false,
  })

  const adminMeQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
    staleTime: 5 * 60_000,
  })

  const accountQuery = useQuery({
    queryKey: ['launch', 'account', tenantId],
    queryFn: () => fetchAccountSummary(apiFetch, tenantId!),
    enabled: Boolean(tenantId),
    retry: false,
  })

  const archiveItems = archiveQuery.data?.items ?? []
  const latestPublications = latestArchiveQuery.data?.items ?? []
  const recentPublications = recentPublicationsQuery.data?.items ?? []
  const activeSourceName = source
    ? facetsQuery.data?.sources.find((item) => item.code === source)?.name ?? source
    : ''
  const archiveHasNarrowing = Boolean(
    appliedQuery.trim() || jurisdiction || uf || source || actType || archiveTag,
  )
  const sources = sourcesQuery.data?.items ?? []
  const stats = statsQuery.data
  const account = accountQuery.data
  const selectedCompany = selectedCompanyId
    ? account?.companies.find((company) => company.id === selectedCompanyId)
    : account?.companies[0]

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

  const updateQuery = (value: string) => {
    setQuery(value)
    // An emptied search box means "no search": do not keep filtering by a
    // term the user can no longer see.
    if (value.trim() === '' && appliedQuery !== '') {
      setAppliedQuery('')
      setArchivePage(1)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setAppliedQuery('')
    setArchivePage(1)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setAppliedQuery(query.trim())
    setArchivePage(1)
    setArchiveView('pesquisa')
    setScreen('acervo')
  }

  const resetArchiveFilters = () => {
    setQuery('')
    setAppliedQuery('')
    setFullText(false)
    setJurisdiction('')
    setUf('')
    setSource('')
    setActType('')
    setArchiveTag(null)
    setArchivePage(1)
  }

  const unavailable = sources.filter((item) => item.status === 'UNAVAILABLE').length
  const unstable = sources.filter((item) => item.status === 'UNSTABLE').length
  const consulted = sources.filter((item) => item.status !== 'NOT_CONSULTED').length

  return (
    <div className="tp-app" data-panel-mode="authenticated">
      <BuildVersionNotice visible={newVersion}/>
      <header className="tp-header">
        <div className="tp-header-primary">
          <button
            type="button"
            className="tp-home-brand-link"
            aria-label="TriFaros — Início"
            onClick={() => {
              setScreen('inicio')
              setTenantMenu(false)
              setUserMenu(false)
            }}
          >
            <BrandMark compact />
          </button>

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
              onChange={(event) => updateQuery(event.target.value)}
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
                  {adminMeQuery.data?.platformAdmin && (
                    <>
                      <Link to="/admin/taxonomia" className="tp-user-admin-link">
                        <ShieldCheck size={16} />
                        Curadoria da taxonomia
                      </Link>
                      <Link to="/admin/administradores" className="tp-user-admin-link">
                        <ShieldCheck size={16} />
                        Administradores
                      </Link>
                      <Link to="/admin/filtro-coleta" className="tp-user-admin-link">
                        <ShieldCheck size={16} />
                        Filtro de Coleta
                      </Link>
                      {anatomyConfigEnabled() && (
                        <Link to="/admin/anatomia" className="tp-user-admin-link">
                          <ShieldCheck size={16} />
                          Anatomia dos atos
                        </Link>
                      )}
                    </>
                  )}
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

      <main
        className={'tp-main tp-main-' + screen}
        data-acervo-view={screen === 'acervo' ? archiveView : undefined}
      >
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
                  onChange={(event) => updateQuery(event.target.value)}
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
            {recentPublicationsQuery.isPending ? (
              <LoadingState />
            ) : recentPublicationsQuery.isError ? (
              <ErrorState />
            ) : (
              <PublicationList items={recentPublications} />
            )}
          </>
        )}

        {screen === 'acervo' && (
          <>
            <div className="tp-acervo-pages" role="tablist" aria-label="Modos do Acervo">
              <button
                type="button"
                role="tab"
                aria-selected={archiveView === 'pesquisa'}
                onClick={() => setArchiveView('pesquisa')}
              >
                Pesquisa
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={archiveView === 'navegacao'}
                onClick={() => setArchiveView('navegacao')}
              >
                Navegação
              </button>
            </div>

            {archiveView === 'pesquisa' ? (
              <>
            <SectionHeading
              eyebrow="Pesquisa"
              title="Acervo"
              description="Pesquise por esfera, UF, fonte, tipo de base legal e conteúdo."
            />

            <form className="tp-acervo-search" onSubmit={submitSearch}>
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Título, número, órgão ou termo"
                aria-label="Pesquisar no Acervo"
              />
              <button type="submit">Buscar no Acervo</button>
            </form>
            <label className="tp-acervo-fulltext">
              <input
                type="checkbox"
                checked={fullText}
                onChange={(event) => {
                  setFullText(event.target.checked)
                  setArchivePage(1)
                }}
              />
              Buscar também no texto completo (ex.: NCM ou trecho do ato)
            </label>
            {archiveTag && (
              <p className="tp-acervo-active-search" role="status">
                Legislações com a tag <strong>“{archiveTag.label}”</strong>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveTag(null)
                    setArchivePage(1)
                  }}
                >
                  Remover tag
                </button>
              </p>
            )}
            {appliedQuery.trim() && (
              <p className="tp-acervo-active-search" role="status">
                Resultados para <strong>“{appliedQuery.trim()}”</strong>
                <button type="button" onClick={clearSearch}>
                  Limpar busca
                </button>
              </p>
            )}

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
                <label>
                  Tipo de base legal
                  <select
                    value={actType}
                    onChange={(event) => {
                      setActType(event.target.value)
                      setArchivePage(1)
                    }}
                  >
                    <option value="">Todos</option>
                    {(facetsQuery.data?.actTypes ?? []).map((item) => (
                      <option value={item} key={item}>{item}</option>
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
                    {archiveItems.length === 0 && archiveHasNarrowing ? (
                      <EmptyState title="Nenhuma publicação encontrada">
                        {[
                          'Nenhum resultado com os filtros atuais',
                          appliedQuery.trim() ? `busca “${appliedQuery.trim()}”` : '',
                          activeSourceName ? `fonte ${activeSourceName}` : '',
                          actType ? `tipo ${actType}` : '',
                          uf ? `UF ${uf}` : '',
                          archiveTag ? `tag ${archiveTag.label}` : '',
                        ].filter(Boolean).join(' · ') +
                          '. Use “Limpar filtros” ou altere a busca.'}
                      </EmptyState>
                    ) : (
                      <PublicationList items={archiveItems} />
                    )}
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
                      {archiveQuery.data?.totalIsCapped
                        ? `Página ${archivePage} · mais de ${(archiveQuery.data.totalItems).toLocaleString('pt-BR')} publicações`
                        : `Página ${archivePage} de ${archiveQuery.data?.totalPages ?? 1} · ${archiveQuery.data?.totalItems ?? 0} publicações`}
                    </p>
                  </>
                )}
              </section>
            </div>
              </>
            ) : (
              <>
                <div className="tp-acervo-library-stage">
                <div className="tp-acervo-navigation-heading tp-acervo-library-hero">
                  <div className="tp-acervo-library-copy">
                    <span className="tp-acervo-library-kicker">Acervo · Biblioteca Viva</span>
                    <h1 className="tp-acervo-library-title">A Biblioteca Tributária</h1>
                    <p className="tp-acervo-library-subtitle">
                      Conhecimento organizado para ser encontrado.
                    </p>
                  </div>
                  <Dialog.Root>
                    <Dialog.Trigger asChild>
                      <button className="tp-acervo-help" type="button">
                        <HelpCircle size={15} aria-hidden="true" />
                        Ajuda
                      </button>
                    </Dialog.Trigger>
                    <Dialog.Portal>
                      <Dialog.Overlay className="tp-acervo-help-overlay" />
                      <Dialog.Content className="tp-acervo-help-dialog">
                        <Dialog.Title>Farol de navegação</Dialog.Title>
                        <Dialog.Description>
                          A ideia é reduzir o Acervo em etapas claras. A cada clique, você troca
                          milhares de possibilidades por um conjunto menor e mais relevante.
                        </Dialog.Description>
                        <ol>
                          <li><b>1</b><span>Escolha o ponto de partida</span></li>
                          <li><b>2</b><span>Refine por categoria</span></li>
                          <li><b>3</b><span>Chegue à lista de documentos</span></li>
                          <li><b>4</b><span>Abra a fonte preservada</span></li>
                        </ol>
                        <Dialog.Close asChild>
                          <button type="button" className="tp-acervo-help-close">Fechar</button>
                        </Dialog.Close>
                      </Dialog.Content>
                    </Dialog.Portal>
                  </Dialog.Root>
                </div>

                <section className="tp-acervo-navigation" aria-label="Navegação por categorias">
                  <div className="tp-acervo-gateways" role="group" aria-label="Forma de navegação">
                    {[
                      { key: 'jurisdiction', label: 'Esfera', hint: 'Federal ou estadual, depois órgão e legislação' },
                      { key: 'actType', label: 'Tipo de ato', hint: 'Comece pela espécie de legislação' },
                      { key: 'source', label: 'Órgão / Fonte', hint: 'Comece pela origem oficial' },
                      { key: 'period', label: 'Período', hint: 'Comece por ano e mês de publicação' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={archiveNavigationRoute === item.key ? 'is-active' : undefined}
                        aria-pressed={archiveNavigationRoute === item.key}
                        onClick={() => {
                          setArchiveNavigationRoute(item.key as ArchiveNavigationRoute)
                          setArchiveNavigationPath([])
                          setArchiveNavigationPage(1)
                        }}
                      >
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </button>
                    ))}
                  </div>

                  {archiveNavigationPath.length > 0 && (
                    <div className="tp-acervo-path-rail" aria-label="Etapas selecionadas">
                      {archiveNavigationPath.map((item, index) => (
                        <button
                          type="button"
                          key={item.group}
                          onClick={() => {
                            setArchiveNavigationPath(archiveNavigationPath.slice(0, index + 1))
                            setArchiveNavigationPage(1)
                          }}
                        >
                          <i className="tp-acervo-path-icon" aria-hidden="true">
                            {item.group === 'jurisdiction' ? <Landmark size={22} /> :
                              item.group === 'uf' ? <MapPin size={22} /> :
                                item.group === 'source' ? <Building2 size={22} /> :
                                  item.group === 'actType' ? <FileText size={22} /> :
                                    item.group === 'year' ? <CalendarDays size={22} /> :
                                      <CalendarRange size={22} />}
                          </i>
                          <small>{archiveNavigationGroupLabels[item.group]}</small>
                          <strong>{item.label}</strong>
                          <span>
                            {item.count.toLocaleString('pt-BR')} {item.count === 1 ? 'ato' : 'atos'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="tp-acervo-browse-options">
                    <nav className="tp-acervo-breadcrumb" aria-label="Caminho atual">
                      <button
                        type="button"
                        onClick={() => {
                          setArchiveNavigationPath([])
                          setArchiveNavigationPage(1)
                        }}
                      >
                        Início
                      </button>
                      {archiveNavigationPath.map((item, index) => (
                        <span key={item.group}>
                          <i aria-hidden="true">›</i>
                          <button
                            type="button"
                            onClick={() => {
                              setArchiveNavigationPath(archiveNavigationPath.slice(0, index + 1))
                              setArchiveNavigationPage(1)
                            }}
                          >
                            {item.label}
                          </button>
                        </span>
                      ))}
                    </nav>

                    {archiveNavigationGroup !== null ? (
                      <>
                        <div className="tp-acervo-browse-title">
                          <span>Agora escolha</span>
                          <strong>{archiveNavigationGroupLabels[archiveNavigationGroup]}</strong>
                        </div>
                        {archiveNavigationOptionsQuery.isPending ? (
                          <LoadingState text="Carregando opções…" />
                        ) : archiveNavigationOptionsQuery.isError ? (
                          <ErrorState title="Não foi possível carregar esta etapa" />
                        ) : archiveNavigationOptionsQuery.data?.items.length === 0 ? (
                          <EmptyState title="Nenhuma opção encontrada">
                            Não há atos neste caminho. Volte uma etapa e tente outro recorte.
                          </EmptyState>
                        ) : (
                          <div className="tp-acervo-option-grid">
                            {(archiveNavigationOptionsQuery.data?.items ?? []).map((item) => {
                              const displayLabel = archiveNavigationGroup === 'month'
                                ? ARCHIVE_MONTHS[Number(item.value) - 1] ?? item.label
                                : item.label
                              return (
                                <button
                                  type="button"
                                  key={item.value}
                                  onClick={() => {
                                    setArchiveNavigationPath((current) => [
                                      ...current,
                                      {
                                        group: archiveNavigationGroup,
                                        value: item.value,
                                        label: displayLabel,
                                        count: item.count,
                                      },
                                    ])
                                    setArchiveNavigationPage(1)
                                  }}
                                >
                                  <strong>{displayLabel}</strong>
                                  <span>
                                    {item.count.toLocaleString('pt-BR')}{' '}
                                    {item.count === 1 ? 'ato' : 'atos'}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="tp-acervo-navigation-results">
                        <div className="tp-acervo-browse-title">
                          <span>Resultado do caminho</span>
                          <strong>
                            {archiveNavigationRange
                              ? `${ARCHIVE_MONTHS[archiveNavigationRange.month - 1]} de ${archiveNavigationRange.year}`
                              : 'Atos encontrados'}
                          </strong>
                        </div>
                        {archiveNavigationArchiveQuery.isPending ? (
                          <LoadingState text="Carregando atos…" />
                        ) : archiveNavigationArchiveQuery.isError ? (
                          <ErrorState title="Não foi possível carregar os atos" />
                        ) : (
                          <>
                            <PublicationList items={archiveNavigationArchiveQuery.data?.items ?? []} />
                            <div className="tp-acervo-navigation-pagination">
                              <button
                                type="button"
                                disabled={archiveNavigationPage <= 1}
                                onClick={() => setArchiveNavigationPage((page) => Math.max(1, page - 1))}
                              >
                                Página anterior
                              </button>
                              <span>
                                Página {archiveNavigationPage} ·{' '}
                                {(archiveNavigationArchiveQuery.data?.totalItems ?? 0).toLocaleString('pt-BR')}{' '}
                                atos
                              </span>
                              <button
                                type="button"
                                disabled={!archiveNavigationArchiveQuery.data?.hasMore}
                                onClick={() => setArchiveNavigationPage((page) => page + 1)}
                              >
                                Próxima página
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </section>
                </div>
              </>
            )}
          </>
        )}

        {screen === 'noticias' && (
          <LiveNewsSection apiFetch={apiFetch} />
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
            {!profileUnit&&<><div className="tp-company-context-head">
              <span>
                Empresa ativa
                {selectedCompany
                  ? ' · ' + selectedCompany.establishmentCount + ' estabelecimento' +
                    (selectedCompany.establishmentCount === 1 ? '' : 's')
                  : ''}
              </span>
              <h1>{selectedCompany?.legalName ?? 'Empresas da conta'}</h1>
            </div>

            <div className="tp-org-tabs">
              <h2>Empresa e filiais</h2>

            </div>
            </>}
            {assistantOpen&&tenantId&&selectedCompany&&<OnboardingAssistant key={selectedCompany.id+':'+(assistantUnit??'all')} apiFetch={apiFetch} tenantId={tenantId} companyId={selectedCompany.id} units={establishmentsQuery.data??[]} initialEstablishmentId={assistantUnit} initialCardId={assistantCard} onComplete={id=>{setAssistantOpen(false);setAssistantCard(undefined);setProfileUnit(id)}} versionChanged={newVersion} animate={assistantAnimate} onClose={()=>{setAssistantOpen(false);setAssistantCard(undefined)}} onSaved={()=>{void queryClient.invalidateQueries({queryKey:['launch','tax-profile']});void queryClient.invalidateQueries({queryKey:['launch','establishments']})}}/>}
            {profileUnit&&selectedCompany&&tenantId&&establishmentsQuery.data?.find(u=>u.id===profileUnit)&&<OnboardingProfileScreen key={profileUnit+':'+assistantOpen} apiFetch={apiFetch} tenantId={tenantId} companyId={selectedCompany.id} unit={establishmentsQuery.data.find(u=>u.id===profileUnit)!} types={typesQuery.data??[]} onBack={()=>setProfileUnit(undefined)} onEdit={card=>{setAssistantUnit(profileUnit);setAssistantCard(card);setAssistantAnimate(false);setAssistantOpen(true)}}/>}
            {!profileUnit&&<>
            {!tenantId?<ErrorState title="Conta sem tenant ativo"/>:accountQuery.isPending?<LoadingState/>:accountQuery.isError?<ErrorState/>:<>
              <CompanySection apiFetch={apiFetch} tenantId={tenantId} account={account!} selectedCompanyId={selectedCompany?.id??''}
                onSelect={id=>{setSelectedCompanyId(id);setProfileUnit(undefined)}} onOpenEstablishments={()=>document.getElementById('company-units')?.scrollIntoView({behavior:'smooth'})}
                types={typesQuery.data??[]} onOpenProfile={(unitId)=>{setAssistantUnit(unitId);setAssistantCard(undefined);setAssistantAnimate(true);setAssistantOpen(true)}}
                onChanged={()=>{void queryClient.invalidateQueries({queryKey:['launch','account',tenantId]});void queryClient.invalidateQueries({queryKey:['launch','establishments']})}}/>
              {!selectedCompany&&selectedCompanyId&&(accountQuery.isFetching?<LoadingState text="Carregando empresa selecionada…"/>:<ErrorState title="Empresa selecionada indisponível"/>)}
              {selectedCompany&&<section id="company-units"><EstablishmentSection apiFetch={apiFetch} tenantId={tenantId} companyId={selectedCompany.id} companyCnpj={selectedCompany.cnpj}
                items={establishmentsQuery.data??[]} types={typesQuery.data??[]} loading={establishmentsQuery.isPending||typesQuery.isPending} error={establishmentsQuery.isError||typesQuery.isError}
                onChanged={()=>{void queryClient.invalidateQueries({queryKey:['launch','establishments']});void queryClient.invalidateQueries({queryKey:['launch','account']})}}
                onOpenProfile={(unitId)=>{setProfileUnit(unitId);setAssistantCard(undefined)}}/></section>}
            </>}
            </>}
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

function monitoringTotals(runs: MonitoringRun[]) {
  return runs.reduce((total, run) => ({
    found: total.found + run.foundItems,
    discarded: total.discarded + (run.discardedItems ?? 0),
    retained: total.retained + (run.retainedItems ?? 0),
    processed: total.processed + (run.processedItems ?? 0),
    imported: total.imported + run.importedDocuments,
  }), { found: 0, discarded: 0, retained: 0, processed: 0, imported: 0 })
}

function MonitoringMetricSequence({ totals }: { totals: ReturnType<typeof monitoringTotals> }) {
  const items = [
    { label: 'Encontradas', value: totals.found },
    { label: 'Descartadas', value: totals.discarded },
    { label: 'Mantidas', value: totals.retained },
    { label: 'Processadas', value: totals.processed },
    { label: 'Importadas', value: totals.imported },
  ]
  return (
    <div className="tp-monitor-metric-sequence">
      {items.map((item, index) => (
        <span className="tp-monitor-metric-unit" key={item.label}>
          {index > 0 && <span aria-hidden="true" className="tp-monitor-metric-separator">|</span>}
          <span className="tp-monitor-metric-detail">
            <small>{item.label}</small>
            <b>{item.value}</b>
          </span>
        </span>
      ))}
    </div>
  )
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
  const totals24h = monitoringTotals(runs)
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
          const sourceTotals = monitoringTotals(sourceRuns)
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
                <div className="tp-monitor-source-counters" aria-label={`Indicadores de 24h da fonte ${source.name}`}>
                  <MonitoringMetricSequence totals={sourceTotals} />
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
                    <span><i aria-hidden="true">|</i> Encontradas</span>
                    <span><i aria-hidden="true">|</i> Descartadas</span>
                    <span><i aria-hidden="true">|</i> Mantidas</span>
                    <span><i aria-hidden="true">|</i> Processadas</span>
                    <span><i aria-hidden="true">|</i> Importadas</span>
                    <span><i aria-hidden="true">|</i> Duração</span>
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
                        <span>{run.discardedItems ?? 0}</span>
                        <span>{run.retainedItems ?? 0}</span>
                        <span>{run.processedItems ?? 0}</span>
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
      <div className="tp-monitor-summary tp-monitor-summary-runs">
        <article><span>Fontes monitoradas</span><strong>{sources.length}</strong></article>
        <article><span>Consultadas</span><strong>{consulted}</strong></article>
        <article><span>Com atenção</span><strong>{unavailable + unstable}</strong></article>
        <article className="tp-monitor-totals-24h">
          <span>Indicadores das últimas 24h</span>
          <MonitoringMetricSequence totals={totals24h} />
        </article>
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
    case 'company_inactive_requires_deletion':
      return 'Este CNPJ está bloqueado por um cadastro antigo. Contate o suporte.'
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

export function DangerConfirmDialog({
  scope,
  title,
  description,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  scope?: string
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
          <p>{description}</p>{scope&&<p>{scope}</p>}
        </div>
        {error && <p className="auth-error" role="alert">Não foi possível concluir a exclusão.</p>}
        <div className="tp-confirm-actions">
          <button className="launch-secondary-button" type="button" disabled={pending} onClick={onCancel}>
            Cancelar
          </button>
          <button className="tp-danger-button" type="button" disabled={pending}
            onClick={() => { if (!pending) onConfirm() }}>
            {pending ? 'Excluindo…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export function CompanySection({
  apiFetch,
  tenantId,
  account,
  selectedCompanyId,
  onSelect,
  onOpenEstablishments,
  onOpenProfile,
  onChanged,
  types=[],
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  account: Awaited<ReturnType<typeof fetchAccountSummary>>
  selectedCompanyId: string
  onSelect: (companyId: string) => void
  onOpenEstablishments: () => void
  onOpenProfile: (unitId?:string) => void
  types?:EstablishmentType[]
  onChanged: () => void
}) {
  const [cnpj, setCnpj] = useState('')
  const [typeCode,setTypeCode]=useState('HEAD_OFFICE')
  const [businessLocationCode, setBusinessLocationCode] = useState('')
  const [creating, setCreating] = useState(account.companies.length === 0)
  const [editing, setEditing] = useState<AccountCompany | null>(null)
  const [editLegalName, setEditLegalName] = useState('')
  const [editBusinessLocationCode, setEditBusinessLocationCode] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState<AccountCompany | null>(null)
  const createMutation = useMutation({
    mutationFn: () =>
      createCompanyFromCnpj(apiFetch, tenantId, cnpj, businessLocationCode,typeCode),
    onSuccess: (result) => {
      onSelect(result.company.id)
      setCreating(false)
      setCnpj('')
      setBusinessLocationCode('')
      onChanged()
      onOpenProfile(result.establishment.id)
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
            Informe o CNPJ e o tipo da unidade. Se a raiz já existe nesta conta, ela será cadastrada como filial da empresa correspondente. Uma nova raiz cria uma empresa e sua matriz.
          </p>
        </div>
        {!creating && (
          <button className="btn" type="button" onClick={() => setCreating(true)}>
            Adicionar CNPJ
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
            CNPJ
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
              placeholder="Código interno da unidade"
              maxLength={80}
            />
          </label>
          <label>Tipo de estabelecimento<select aria-label="Tipo de estabelecimento" value={typeCode} onChange={e=>setTypeCode(e.target.value)}>{(types.length?types:[{code:'HEAD_OFFICE',name:'Matriz'}]).map(type=><option key={type.code} value={type.code}>{type.name}</option>)}</select></label>
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

      {createMutation.isError && createMutation.error.message !== 'manual_registration_cancelled' && (
        <Dialog.Root open onOpenChange={(open) => { if (!open) createMutation.reset() }}>
          <Dialog.Portal>
            <Dialog.Overlay className="tp-acervo-help-overlay" />
            <Dialog.Content className="tp-acervo-help-dialog">
              <Dialog.Title>Erro na consulta do CNPJ</Dialog.Title>
              <Dialog.Description>
                {registrationErrorMessage(createMutation.error, 'empresa')}
                {' '}Confira o CNPJ ou tente novamente. Se a fonte oficial estiver indisponível,
                use o cadastro manual quando ele for oferecido.
              </Dialog.Description>
              {/^[a-z][a-z0-9_]{0,63}$/.test(createMutation.error.message) && (
                <p>Referência do erro: {createMutation.error.message}</p>
              )}
              <Dialog.Close asChild>
                <button className="btn" type="button">Entendi</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
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
          title="Excluir definitivamente?"
          scope="Serão apagados a empresa, seus perfis e todos os CNPJs da mesma raiz nesta conta, inclusive filiais cadastradas separadamente. Outras raízes e contas serão preservadas."
          description="Excluir definitivamente. Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
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
  onOpenProfile,
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
  onOpenProfile: (unitId?:string) => void
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
      onOpenProfile()
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
            Matriz e filiais da empresa ativa. A consulta cadastral acontece somente ao adicionar o CNPJ. Endereço e IE podem ser corrigidos manualmente
            e tenta recuperar a Inscrição Estadual quando houver fonte estadual suportada.
          </p>
        </div>

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
            <select aria-label="Tipo" value={typeCode} onChange={(event) => setTypeCode(event.target.value)}>
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
                {['NOT_SUPPORTED', 'UNAVAILABLE', 'NOT_FOUND'].includes(item.stateRegistrationLookupStatus ?? '') && (
                  <small>{manualIeHelperText(item.uf, item.stateRegistrationLookupStatus)}</small>
                )}
                {item.stateRegistrationSource === 'MANUAL' && <small>Informada manualmente</small>}
              </span>
              <span className="tp-cnae-cell">
                {primary ? (
                  <><b>{primary.code}</b><small>{primary.description}</small></>
                ) : '—'}
              </span>
              <div className="tp-row-actions">
                <button type="button" onClick={()=>onOpenProfile(item.id)}>Ver perfil tributário</button>
                <button type="button" onClick={() => beginEdit(item)}>
                  {manualIeActionLabel(item.stateRegistration, item.stateRegistrationLookupStatus)}
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
              Inscrição Estadual (preenchimento manual permitido)
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


