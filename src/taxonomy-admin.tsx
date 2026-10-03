import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Download,
  FileUp,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { ProductApiFetch } from './product-api'
import {
  ALIAS_TYPE_LABELS,
  OFFICIAL_CODE_TYPE_LABELS,
  TaxonomyApiError,
  checkCatalog,
  createConcept,
  createCurationDraft,
  createGroup,
  deleteGroup,
  downloadDimensionCsv,
  fetchAdminMe,
  fetchCurationState,
  fetchDraftReview,
  fetchReleaseView,
  formatOfficialCode,
  importCatalog,
  importDimensionCsv,
  readCsvFile,
  patchConcept,
  patchDimension,
  patchGroup,
  publishDraft,
  setClassificationEnabled,
  setExcludedSources,
  type AliasType,
  type CatalogCheck,
  type CurationConcept,
  type CurationDimension,
  type CurationGroup,
  type CurationState,
  type OfficialCodeType,
  type ReleaseView,
} from './taxonomy-api'
import './panel-experience.css'
import { CurationGrid } from './taxonomy-grid'
import './taxonomy-admin.css'

const DEFAULT_REASON = 'Curadoria da taxonomia'

type Tab = 'tabelas' | 'revisar' | 'catalogos' | 'classificacao'

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'tabelas', label: 'Tabelas' },
  { key: 'revisar', label: 'Revisar e publicar' },
  { key: 'catalogos', label: 'Catálogos oficiais' },
  { key: 'classificacao', label: 'Classificação automática' },
]

const ERROR_MESSAGES: Record<string, string> = {
  taxonomy_curator_required: 'Seu usuário não tem acesso de curadoria.',
  curator_database_unavailable:
    'A conexão de curadoria do banco não está configurada neste ambiente.',
  justification_required: 'Informe o motivo da alteração.',
  no_open_draft: 'Não há rascunho aberto. Crie um rascunho para editar.',
  draft_already_open: 'Já existe um rascunho aberto.',
  invalid_official_code: 'Código oficial inválido para o tipo desta tabela.',
  group_already_exists: 'Já existe um grupo com esse nome.',
  concept_already_exists: 'Já existe um item com esse código.',
  draft_has_blockers: 'O rascunho tem bloqueios. Corrija antes de publicar.',
  stale_draft_base: 'Outra versão foi publicada depois deste rascunho.',
  source_changed_since_check: 'A fonte oficial mudou desde a conferência. Confira de novo.',
  csv_required: 'Envie o arquivo CSV.',
}

function errorText(error: unknown): string {
  if (error instanceof TaxonomyApiError) {
    return error.detail || ERROR_MESSAGES[error.code] || `Erro: ${error.code}`
  }
  return error instanceof Error ? error.message : 'Erro inesperado.'
}

function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/* ------------------------------------------------------------------ */

export function TaxonomyAdminPage({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const meQuery = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => fetchAdminMe(apiFetch),
    retry: false,
  })

  if (meQuery.isPending) {
    return <main className="auth-panel-loading">Verificando acesso de curadoria…</main>
  }
  if (meQuery.isError || !meQuery.data?.taxonomyCurator) {
    return (
      <div className="tp-app tc-app">
        <main className="tc-denied">
          <ShieldCheck size={28} />
          <h1>Acesso restrito</h1>
          <p>A curadoria da taxonomia é exclusiva de usuários com acesso especial.</p>
          <Link to="/painel">Voltar ao painel</Link>
        </main>
      </div>
    )
  }

  return <CurationWorkspace apiFetch={apiFetch} />
}

function CurationWorkspace({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('tabelas')
  const [justification, setJustification] = useState(() => {
    try {
      return sessionStorage.getItem('tribusca.curation.justification') ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem('tribusca.curation.justification', justification)
    } catch {
      // per-viewer convenience only
    }
  }, [justification])

  const stateQuery = useQuery({
    queryKey: ['admin', 'taxonomy', 'state'],
    queryFn: () => fetchCurationState(apiFetch),
    retry: false,
  })

  const state = stateQuery.data
  const editingRelease = state?.draft ?? state?.published ?? null

  const viewQuery = useQuery({
    queryKey: ['admin', 'taxonomy', 'release', editingRelease?.id],
    queryFn: () => fetchReleaseView(apiFetch, editingRelease!.id),
    enabled: Boolean(editingRelease),
    retry: false,
  })

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'taxonomy'] })
  }

  // The reason is optional for the curator; the audit trail always gets one.
  const auditReason = justification.trim().length >= 3 ? justification.trim() : DEFAULT_REASON

  const createDraft = useMutation({
    mutationFn: () => createCurationDraft(apiFetch, auditReason),
    onSuccess: refresh,
  })

  return (
    <div className="tp-app tc-app">
      <header className="tc-header">
        <Link to="/painel" className="tc-back">
          <ArrowLeft size={16} /> Painel
        </Link>
        <div>
          <span className="tp-eyebrow">Acesso de curadoria</span>
          <h1>Curadoria da Taxonomia</h1>
        </div>
        <label className="tc-justification">
          <span>Motivo das alterações (opcional, vai para a auditoria)</span>
          <input
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
            placeholder="ex.: revisão dos grupos de produtos do agronegócio"
          />
        </label>
      </header>

      {stateQuery.isError && <p className="tp-error-banner">{errorText(stateQuery.error)}</p>}

      {state && (
        <section className="tc-status">
          <article>
            <small>Versão publicada</small>
            <strong>{state.published?.version ?? '—'}</strong>
            <span>{formatDateTime(state.published?.publishedAt ?? null)}</span>
          </article>
          <article className={state.draft ? 'is-draft' : ''}>
            <small>Rascunho</small>
            {state.draft ? (
              <>
                <strong>{state.draft.version}</strong>
                <span>em edição desde {formatDateTime(state.draft.createdAt)}</span>
              </>
            ) : (
              <>
                <strong>Nenhum</strong>
                <button
                  type="button"
                  disabled={createDraft.isPending || !state.published}
                  onClick={() => createDraft.mutate()}
                >
                  <Plus size={14} />
                  {createDraft.isPending ? 'Criando…' : `Criar rascunho a partir da ${state.published?.version ?? ''}`}
                </button>
              </>
            )}
          </article>
          <article className={state.settings.classificationEnabled ? 'is-on' : 'is-off'}>
            <small>Classificação automática</small>
            <strong>{state.settings.classificationEnabled ? 'Ligada' : 'Desligada'}</strong>
            <span>
              {state.progress
                ? `${state.progress.classified.toLocaleString('pt-BR')} de ${state.progress.total.toLocaleString('pt-BR')} legislações`
                : '—'}
            </span>
          </article>
          {!state.curatorDatabase && (
            <p className="tc-warning">
              A conexão de curadoria do banco não está configurada: a edição fica indisponível.
            </p>
          )}
          {createDraft.isError && <p className="tc-error">{errorText(createDraft.error)}</p>}
        </section>
      )}

      <nav className="tp-tabs tc-tabs" aria-label="Seções da curadoria">
        {TABS.map((item) => (
          <button
            type="button"
            key={item.key}
            aria-current={tab === item.key ? 'page' : undefined}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="tc-main">
        {tab === 'tabelas' &&
          (viewQuery.data && state ? (
            <TablesTab
              apiFetch={apiFetch}
              view={viewQuery.data}
              editable={Boolean(state.draft) && state.curatorDatabase}
              justification={auditReason}
              onChanged={refresh}
            />
          ) : (
            <p className="tc-hint">{viewQuery.isError ? errorText(viewQuery.error) : 'Carregando tabelas…'}</p>
          ))}
        {tab === 'revisar' && state && (
          <ReviewTab apiFetch={apiFetch} state={state} justification={auditReason} onChanged={refresh} />
        )}
        {tab === 'catalogos' && state && (
          <CatalogsTab apiFetch={apiFetch} state={state} justification={auditReason} onChanged={refresh} />
        )}
        {tab === 'classificacao' && state && (
          <ClassificationTab apiFetch={apiFetch} state={state} justification={auditReason} onChanged={refresh} />
        )}
      </main>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

function TablesTab({
  apiFetch,
  view,
  editable,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  view: ReleaseView
  editable: boolean
  justification: string
  onChanged: () => Promise<void>
}) {
  const [dimensionCode, setDimensionCode] = useState(view.dimensions[0]?.code ?? '')
  const [gridDirty, setGridDirty] = useState(false)
  const dimension = view.dimensions.find((d) => d.code === dimensionCode) ?? view.dimensions[0]

  const sortedDimensions = useMemo(
    () =>
      [...view.dimensions].sort(
        (left, right) =>
          Number(right.profileVisible) - Number(left.profileVisible) ||
          left.profileOrder - right.profileOrder ||
          left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [view.dimensions],
  )

  if (!dimension) return <p className="tc-hint">Nenhuma dimensão nesta versão.</p>

  return (
    <div className="tc-tables">
      <aside className="tc-dimension-list" aria-label="Tabelas da taxonomia">
        {sortedDimensions.map((item) => (
          <button
            type="button"
            key={item.code}
            className={item.code === dimension.code ? 'is-selected' : ''}
            onClick={() => {
              if (
                item.code !== dimension.code &&
                gridDirty &&
                !window.confirm('Há alterações não salvas nesta tabela. Sair sem salvar?')
              ) {
                return
              }
              setGridDirty(false)
              setDimensionCode(item.code)
            }}
          >
            <b>{item.name}</b>
            <span>
              {item.conceptCount} itens
              {item.profileVisible && <em>Perfil</em>}
              {item.detailSection && <em>Legislação</em>}
            </span>
          </button>
        ))}
      </aside>
      <DimensionEditor
        key={dimension.code}
        apiFetch={apiFetch}
        view={view}
        dimension={dimension}
        editable={editable}
        justification={justification}
        onChanged={onChanged}
        onDirtyChange={setGridDirty}
      />
    </div>
  )
}

function DimensionSettings({
  apiFetch,
  dimension,
  editable,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  dimension: CurationDimension
  editable: boolean
  justification: string
  onChanged: () => Promise<void>
}) {
  const [form, setForm] = useState({
    name: dimension.name,
    helpText: dimension.helpText ?? '',
    profileVisible: dimension.profileVisible,
    profileOrder: dimension.profileOrder,
    detailSection: dimension.detailSection ?? '',
    detailOrder: dimension.detailOrder,
    usesGroups: dimension.usesGroups,
    officialCodeType: dimension.officialCodeType ?? '',
  })
  const save = useMutation({
    mutationFn: () =>
      patchDimension(apiFetch, dimension.code, justification, {
        name: form.name,
        helpText: form.helpText || null,
        profileVisible: form.profileVisible,
        profileOrder: Number(form.profileOrder),
        detailSection: form.detailSection || null,
        detailOrder: Number(form.detailOrder),
        usesGroups: form.usesGroups,
        officialCodeType: (form.officialCodeType || null) as OfficialCodeType | null,
      }),
    onSuccess: onChanged,
  })

  return (
    <details className="tc-settings">
      <summary>Configuração da tabela “{dimension.name}”</summary>
      <div className="tc-settings-grid">
        <label>
          Nome
          <input disabled={!editable} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="tc-wide">
          Texto de ajuda para o cliente
          <input
            disabled={!editable}
            value={form.helpText}
            onChange={(e) => setForm({ ...form, helpText: e.target.value })}
          />
        </label>
        <label className="tc-check">
          <input
            type="checkbox"
            disabled={!editable}
            checked={form.profileVisible}
            onChange={(e) => setForm({ ...form, profileVisible: e.target.checked })}
          />
          Aparece no Perfil Tributário
        </label>
        <label>
          Ordem no perfil
          <input
            type="number"
            min={0}
            disabled={!editable}
            value={form.profileOrder}
            onChange={(e) => setForm({ ...form, profileOrder: Number(e.target.value) })}
          />
        </label>
        <label>
          Seção na página da legislação
          <input
            disabled={!editable}
            value={form.detailSection}
            placeholder="vazio = não aparece"
            onChange={(e) => setForm({ ...form, detailSection: e.target.value })}
          />
        </label>
        <label>
          Ordem da seção
          <input
            type="number"
            min={0}
            disabled={!editable}
            value={form.detailOrder}
            onChange={(e) => setForm({ ...form, detailOrder: Number(e.target.value) })}
          />
        </label>
        <label className="tc-check">
          <input
            type="checkbox"
            disabled={!editable}
            checked={form.usesGroups}
            onChange={(e) => setForm({ ...form, usesGroups: e.target.checked })}
          />
          Usa grupos
        </label>
        <label>
          Tipo de código oficial
          <select
            disabled={!editable}
            value={form.officialCodeType}
            onChange={(e) => setForm({ ...form, officialCodeType: e.target.value })}
          >
            <option value="">Nenhum (texto livre)</option>
            {Object.entries(OFFICIAL_CODE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {editable && (
        <div className="tc-actions">
          <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
            <Save size={14} /> {save.isPending ? 'Salvando…' : 'Salvar configuração'}
          </button>
          {save.isError && <span className="tc-error">{errorText(save.error)}</span>}
          {save.isSuccess && <span className="tc-ok">Salvo no rascunho.</span>}
        </div>
      )}
    </details>
  )
}

function DimensionEditor({
  apiFetch,
  view,
  dimension,
  editable,
  justification,
  onChanged,
  onDirtyChange,
}: {
  apiFetch: ProductApiFetch
  view: ReleaseView
  dimension: CurationDimension
  editable: boolean
  justification: string
  onChanged: () => Promise<void>
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [detail, setDetail] = useState<CurationConcept | 'new' | null>(null)
  const [groupEditor, setGroupEditor] = useState<CurationGroup | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const groups = view.groups
    .filter((group) => group.dimensionCode === dimension.code)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label, 'pt-BR'))
  const dimensionConcepts = view.concepts.filter((concept) => concept.dimensionCode === dimension.code)
  const [gridVersion, setGridVersion] = useState(0)

  const exportCsv = async () => {
    setExportError(null)
    try {
      const blob = await downloadDimensionCsv(apiFetch, view.release.id, dimension.code)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `taxonomia-${view.release.version}-${dimension.code}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setExportError(`Não foi possível exportar: ${errorText(error)}`)
    }
  }

  const importCsv = async (file: File) => {
    setImporting(true)
    setImportReport(null)
    try {
      const report = await importDimensionCsv(apiFetch, dimension.code, justification, await readCsvFile(file))
      setImportReport(
        `${report.rows} linhas · ${report.created} criados · ${report.updated} atualizados · ${report.groupsCreated} grupos novos` +
          (report.errors.length
            ? ` · erros: ${report.errors.map((e) => `linha ${e.line}: ${e.message}`).join('; ')}`
            : ''),
      )
      await onChanged()
      setGridVersion((value) => value + 1)
    } catch (error) {
      setImportReport(errorText(error))
    } finally {
      setImporting(false)
    }
  }

  const codeLabel = dimension.officialCodeType
    ? OFFICIAL_CODE_TYPE_LABELS[dimension.officialCodeType]
    : 'Código oficial'

  return (
    <section className="tc-editor">
      <div className="tc-editor-head">
        <div>
          <h2>{dimension.name}</h2>
          <p>
            {dimension.conceptCount} itens · {groups.length} grupos ·{' '}
            {dimension.profileVisible ? 'aparece no Perfil Tributário' : 'não aparece no perfil'} ·{' '}
            {dimension.detailSection ? `seção “${dimension.detailSection}” na legislação` : 'oculta na legislação'}
          </p>
        </div>
        {!editable && <span className="tc-readonly">Somente leitura — crie um rascunho para editar</span>}
      </div>

      <DimensionSettings
        key={`${dimension.code}-${dimension.revisionNo}-${dimension.profileOrder}-${dimension.helpText}`}
        apiFetch={apiFetch}
        dimension={dimension}
        editable={editable}
        justification={justification}
        onChanged={onChanged}
      />

      <div className="tc-toolbar">
        <label className="tc-search">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome, sinônimo ou código"
          />
        </label>
        <label className="tc-check">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Mostrar retirados
        </label>
        <span className="tc-spacer" />
        {dimension.usesGroups && editable && (
          <>
            <select
              aria-label="Editar grupo"
              value=""
              onChange={(event) => {
                const group = groups.find((item) => item.id === event.target.value)
                if (group) setGroupEditor(group)
              }}
            >
              <option value="">Editar grupo…</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setGroupEditor('new')}>
              <Plus size={14} /> Novo grupo
            </button>
          </>
        )}
        <button type="button" onClick={() => void exportCsv()}>
          <Download size={14} /> Exportar planilha
        </button>
        <label
          className={`tc-file-button is-primary${!editable || importing ? ' is-disabled' : ''}`}
          title={editable ? 'Carga massiva por planilha CSV' : 'Crie um rascunho para importar'}
        >
          <FileUp size={14} /> {importing ? 'Importando…' : 'Importar planilha (carga massiva)'}
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={!editable || importing}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importCsv(file)
              event.target.value = ''
            }}
          />
        </label>
      </div>
      {exportError && <p className="tc-error" role="alert">{exportError}</p>}
      {importReport && <p className="tc-hint">{importReport}</p>}
      <details className="tc-hint tc-import-help">
        <summary>Como montar a planilha de carga massiva</summary>
        <p>
          Use o arquivo do “Exportar planilha” como modelo: uma linha por item, colunas Grupo · Item · {codeLabel} ·
          Sinônimos · No perfil · Ordem · Classificar pelo nome · Código TriBusca. Só “Item” é obrigatório.
        </p>
        <ul>
          <li>Pode reimportar a planilha exportada inteira: cada linha encontra o item pelo “Código TriBusca” (ou, se
          vazio, pelo nome) e só atualiza o que mudou; nada é duplicado.</li>
          <li>Linha nova: deixe “Código TriBusca” vazio; o código é gerado a partir do nome do item.</li>
          <li>Itens que não estão na planilha continuam como estão. Para excluir, use “Excluir selecionadas” na
          tabela.</li>
          <li>“No perfil” e “Classificar pelo nome”: marque com <b>x</b> (vazio mantém o valor atual).</li>
          <li>Vários sinônimos ou códigos na mesma célula: separe com vírgula ou ponto e vírgula.</li>
          <li>Célula em branco mantém o valor atual; “—” apaga o valor. Grupo novo é criado automaticamente.</li>
          <li>A coluna de código também pode se chamar “NCM”, “CNAE”, “CFOP”, “NBS”, “Modelo”, “cClassTrib” ou “Item LC
          116”.</li>
        </ul>
      </details>

      <CurationGrid
        key={gridVersion}
        apiFetch={apiFetch}
        dimension={dimension}
        concepts={dimensionConcepts}
        groups={groups}
        editable={editable}
        justification={justification}
        showRetired={showRetired}
        query={query}
        onChanged={onChanged}
        onOpenDetail={(concept) => setDetail(concept)}
        {...(onDirtyChange ? { onDirtyChange } : {})}
      />

      {detail && (
        <ConceptDrawer
          apiFetch={apiFetch}
          concept={detail === 'new' ? null : detail}
          dimension={dimension}
          groups={groups}
          editable={editable}
          justification={justification}
          onClose={() => setDetail(null)}
          onChanged={onChanged}
        />
      )}
      {groupEditor && (
        <GroupDrawer
          apiFetch={apiFetch}
          group={groupEditor === 'new' ? null : groupEditor}
          dimension={dimension}
          segments={view.concepts.filter(
            (c) =>
              view.dimensions.find((d) => d.code === c.dimensionCode)?.officialCodeType === 'CNAE' &&
              c.membershipStatus === 'INCLUDED',
          )}
          justification={justification}
          onClose={() => setGroupEditor(null)}
          onChanged={onChanged}
        />
      )}
    </section>
  )
}

function ConceptDrawer({
  apiFetch,
  concept,
  dimension,
  groups,
  editable,
  justification,
  onClose,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  concept: CurationConcept | null
  dimension: CurationDimension
  groups: CurationGroup[]
  editable: boolean
  justification: string
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [form, setForm] = useState({
    label: concept?.label ?? '',
    definition: concept?.definition ?? '',
    positiveExample: concept?.positiveExample ?? '',
    negativeExample: concept?.negativeExample ?? '',
    governanceStatus: concept?.governanceStatus ?? 'PROPOSED',
    evidenceStatus: concept?.evidenceStatus ?? 'NOT_ASSESSED',
    notes: concept?.notes ?? '',
    helpText: concept?.helpText ?? '',
    groupId: concept?.groupId ?? '',
    codes: (concept?.officialCodes ?? [])
      .map((code) => formatOfficialCode(dimension.officialCodeType, code))
      .join(', '),
    aliases: concept?.aliases ?? [],
  })
  const [newAlias, setNewAlias] = useState<{ text: string; aliasType: AliasType }>({
    text: '',
    aliasType: 'EXACT_LEXICAL',
  })

  const payload = () => ({
    label: form.label,
    definition: form.definition || form.label,
    positiveExample: form.positiveExample || null,
    negativeExample: form.negativeExample || null,
    governanceStatus: form.governanceStatus,
    evidenceStatus: form.evidenceStatus,
    notes: form.notes || null,
    helpText: form.helpText || null,
    groupId: form.groupId || null,
    officialCodes: splitList(form.codes),
    aliases: form.aliases,
  })

  const save = useMutation({
    mutationFn: async () => {
      if (concept) await patchConcept(apiFetch, concept.code, justification, payload())
      else await createConcept(apiFetch, dimension.code, justification, payload())
    },
    onSuccess: async () => {
      await onChanged()
      onClose()
    },
  })

  const [confirmRetire, setConfirmRetire] = useState(false)
  const toggleRetired = useMutation({
    mutationFn: () =>
      patchConcept(apiFetch, concept!.code, justification, {
        membershipStatus: concept!.membershipStatus === 'INCLUDED' ? 'RETIRED' : 'INCLUDED',
      }),
    onSuccess: async () => {
      await onChanged()
      onClose()
    },
  })

  return (
    <div className="tc-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="tc-drawer"
        role="dialog"
        aria-label={concept ? `Item ${concept.label}` : 'Novo item'}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>{dimension.name}</small>
            <h3>{concept ? concept.label : 'Novo item'}</h3>
            {concept && <code>{concept.code}</code>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="tc-drawer-body">
          <label>
            Nome
            <input disabled={!editable} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          {dimension.usesGroups && (
            <label>
              Grupo
              <select
                disabled={!editable}
                value={form.groupId}
                onChange={(e) => setForm({ ...form, groupId: e.target.value })}
              >
                <option value="">Sem grupo</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {dimension.officialCodeType ? OFFICIAL_CODE_TYPE_LABELS[dimension.officialCodeType] : 'Código oficial'} (pode
            ficar em branco; separe vários por vírgula)
            <input disabled={!editable} value={form.codes} onChange={(e) => setForm({ ...form, codes: e.target.value })} />
          </label>
          <label>
            Definição
            <textarea
              disabled={!editable}
              rows={3}
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
            />
          </label>
          <div className="tc-two">
            <label>
              Exemplo positivo
              <input
                disabled={!editable}
                value={form.positiveExample}
                onChange={(e) => setForm({ ...form, positiveExample: e.target.value })}
              />
            </label>
            <label>
              Exemplo negativo
              <input
                disabled={!editable}
                value={form.negativeExample}
                onChange={(e) => setForm({ ...form, negativeExample: e.target.value })}
              />
            </label>
          </div>
          <label>
            Ajuda exibida ao cliente
            <input disabled={!editable} value={form.helpText} onChange={(e) => setForm({ ...form, helpText: e.target.value })} />
          </label>
          <div className="tc-two">
            <label>
              Aprovação
              <select
                disabled={!editable}
                value={form.governanceStatus}
                onChange={(e) => setForm({ ...form, governanceStatus: e.target.value })}
              >
                <option value="PROPOSED">Proposto</option>
                <option value="UNDER_REVIEW">Em revisão</option>
                <option value="APPROVED">Aprovado</option>
                <option value="DEPRECATED">Obsoleto</option>
                <option value="REJECTED">Rejeitado</option>
              </select>
            </label>
            <label>
              Evidência
              <select
                disabled={!editable}
                value={form.evidenceStatus}
                onChange={(e) => setForm({ ...form, evidenceStatus: e.target.value })}
              >
                <option value="DOCUMENTED">Documentada</option>
                <option value="NEEDS_EVIDENCE">Precisa de evidência</option>
                <option value="NOT_ASSESSED">Não avaliada</option>
              </select>
            </label>
          </div>
          <fieldset>
            <legend>Sinônimos</legend>
            <ul className="tc-alias-list">
              {form.aliases.map((alias, index) => (
                <li key={`${alias.text}-${index}`}>
                  <b>{alias.text}</b>
                  <span>{ALIAS_TYPE_LABELS[alias.aliasType] ?? alias.aliasType}</span>
                  {editable && (
                    <button
                      type="button"
                      aria-label={`Remover ${alias.text}`}
                      onClick={() =>
                        setForm({ ...form, aliases: form.aliases.filter((_, position) => position !== index) })
                      }
                    >
                      <X size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {editable && (
              <div className="tc-alias-add">
                <input
                  value={newAlias.text}
                  placeholder="novo sinônimo"
                  onChange={(e) => setNewAlias({ ...newAlias, text: e.target.value })}
                />
                <select
                  value={newAlias.aliasType}
                  onChange={(e) => setNewAlias({ ...newAlias, aliasType: e.target.value as AliasType })}
                >
                  {Object.entries(ALIAS_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!newAlias.text.trim()}
                  onClick={() => {
                    setForm({ ...form, aliases: [...form.aliases, { ...newAlias, text: newAlias.text.trim() }] })
                    setNewAlias({ text: '', aliasType: newAlias.aliasType })
                  }}
                >
                  Adicionar
                </button>
              </div>
            )}
            <small>Só “Equivalente exato” e “Sigla” marcam legislações automaticamente.</small>
          </fieldset>
          <label>
            Observações internas
            <textarea disabled={!editable} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        {editable && (
          <footer>
            {concept && (
              <button
                type="button"
                disabled={toggleRetired.isPending}
                onClick={() =>
                  concept.membershipStatus === 'INCLUDED' ? setConfirmRetire(true) : toggleRetired.mutate()
                }
              >
                {concept.membershipStatus === 'INCLUDED' ? 'Retirar item' : 'Restaurar item'}
              </button>
            )}
            <span className="tc-spacer" />
            {(save.isError || toggleRetired.isError) && (
              <span className="tc-error">{errorText(save.error ?? toggleRetired.error)}</span>
            )}
            <button
              type="button"
              className="is-primary"
              disabled={save.isPending || !form.label.trim()}
              onClick={() => save.mutate()}
            >
              <Save size={14} /> {save.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </footer>
        )}
      </aside>
      {confirmRetire && concept && (
        <ConfirmDialog
          title="Retirar item?"
          message={`“${concept.label}” deixa de aparecer no Perfil Tributário e de marcar legislações quando esta versão for publicada. Ele pode ser restaurado depois em “Mostrar retirados”.`}
          confirmLabel="Retirar item"
          pending={toggleRetired.isPending}
          error={toggleRetired.isError ? errorText(toggleRetired.error) : null}
          onCancel={() => {
            toggleRetired.reset()
            setConfirmRetire(false)
          }}
          onConfirm={() => toggleRetired.mutate()}
        />
      )}
    </div>
  )
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className="tc-confirm-backdrop"
      role="presentation"
      onClick={(event) => {
        event.stopPropagation()
        if (!pending) onCancel()
      }}
    >
      <div
        className="tc-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tc-confirm-title"
        aria-describedby="tc-confirm-message"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 id="tc-confirm-title">{title}</h3>
        <p id="tc-confirm-message">{message}</p>
        {error && (
          <p className="tc-error" role="alert">
            {error}
          </p>
        )}
        <div className="tc-confirm-actions">
          <button type="button" disabled={pending} onClick={onCancel} autoFocus>
            Cancelar
          </button>
          <button type="button" className="is-danger" disabled={pending} onClick={onConfirm}>
            {pending ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function GroupDrawer({
  apiFetch,
  group,
  dimension,
  segments,
  justification,
  onClose,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  group: CurationGroup | null
  dimension: CurationDimension
  segments: CurationConcept[]
  justification: string
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [form, setForm] = useState({
    label: group?.label ?? '',
    displayOrder: group ? String(group.displayOrder) : '',
    helpText: group?.helpText ?? '',
    detailSection: group?.detailSection ?? '',
    codes: (group?.officialCodes ?? []).map((code) => formatOfficialCode(dimension.officialCodeType, code)).join(', '),
    segmentCodes: group?.segmentCodes ?? [],
  })

  const input = () => ({
    label: form.label,
    ...(form.displayOrder ? { displayOrder: Number(form.displayOrder) } : {}),
    helpText: form.helpText || null,
    detailSection: form.detailSection || null,
    officialCodes: splitList(form.codes),
    segmentCodes: form.segmentCodes,
  })

  const save = useMutation({
    mutationFn: async () => {
      if (group) await patchGroup(apiFetch, group.id, justification, input())
      else await createGroup(apiFetch, dimension.code, justification, input())
    },
    onSuccess: async () => {
      await onChanged()
      onClose()
    },
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const remove = useMutation({
    mutationFn: () => deleteGroup(apiFetch, group!.id, justification),
    onSuccess: async () => {
      await onChanged()
      onClose()
    },
  })

  return (
    <div className="tc-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="tc-drawer"
        role="dialog"
        aria-label={group ? `Grupo ${group.label}` : 'Novo grupo'}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>{dimension.name}</small>
            <h3>{group ? group.label : 'Novo grupo'}</h3>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="tc-drawer-body">
          <label>
            Nome do grupo
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </label>
          <div className="tc-two">
            <label>
              Ordem
              <input
                value={form.displayOrder}
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, displayOrder: e.target.value.replace(/\D/g, '') })}
              />
            </label>
            <label>
              Seção própria na legislação (opcional)
              <input
                value={form.detailSection}
                placeholder={dimension.detailSection ?? 'mesma da tabela'}
                onChange={(e) => setForm({ ...form, detailSection: e.target.value })}
              />
            </label>
          </div>
          <label>
            {dimension.officialCodeType ? OFFICIAL_CODE_TYPE_LABELS[dimension.officialCodeType] : 'Código oficial'} do grupo
            (prefixo, opcional)
            <input value={form.codes} onChange={(e) => setForm({ ...form, codes: e.target.value })} />
          </label>
          <label>
            Ajuda exibida ao cliente
            <input value={form.helpText} onChange={(e) => setForm({ ...form, helpText: e.target.value })} />
          </label>
          {segments.length > 0 && (
            <fieldset>
              <legend>Segmentos atendidos por este grupo</legend>
              <div className="tc-segment-grid">
                {segments.map((segment) => (
                  <label key={segment.code} className="tc-check">
                    <input
                      type="checkbox"
                      checked={form.segmentCodes.includes(segment.code)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          segmentCodes: e.target.checked
                            ? [...form.segmentCodes, segment.code]
                            : form.segmentCodes.filter((code) => code !== segment.code),
                        })
                      }
                    />
                    {segment.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>
        <footer>
          {group && (
            <button type="button" disabled={remove.isPending} onClick={() => setConfirmDelete(true)}>
              Excluir grupo (itens ficam sem grupo)
            </button>
          )}
          <span className="tc-spacer" />
          {(save.isError || remove.isError) && <span className="tc-error">{errorText(save.error ?? remove.error)}</span>}
          <button
            type="button"
            className="is-primary"
            disabled={save.isPending || !form.label.trim()}
            onClick={() => save.mutate()}
          >
            <Save size={14} /> {save.isPending ? 'Salvando…' : 'Salvar grupo'}
          </button>
        </footer>
      </aside>
      {confirmDelete && group && (
        <ConfirmDialog
          title="Excluir grupo?"
          message={`O grupo “${group.label}” será excluído deste rascunho. Os itens dele continuam na tabela, mas ficam sem grupo.`}
          confirmLabel="Excluir grupo"
          pending={remove.isPending}
          error={remove.isError ? errorText(remove.error) : null}
          onCancel={() => {
            remove.reset()
            setConfirmDelete(false)
          }}
          onConfirm={() => remove.mutate()}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Review and publish                                                   */
/* ------------------------------------------------------------------ */

function ReviewTab({
  apiFetch,
  state,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  state: CurationState
  justification: string
  onChanged: () => Promise<void>
}) {
  const [notes, setNotes] = useState('')
  const reviewQuery = useQuery({
    queryKey: ['admin', 'taxonomy', 'review', state.draft?.id],
    queryFn: () => fetchDraftReview(apiFetch),
    enabled: Boolean(state.draft),
    retry: false,
  })
  const publish = useMutation({
    mutationFn: () => publishDraft(apiFetch, justification, notes),
    onSuccess: onChanged,
  })

  if (!state.draft) {
    return (
      <p className="tc-hint">
        Não há rascunho aberto. A versão publicada é a {state.published?.version ?? '—'}.
        {publish.isSuccess && ` Versão ${publish.data.release.version} publicada.`}
      </p>
    )
  }
  if (reviewQuery.isPending) return <p className="tc-hint">Calculando diferenças…</p>
  if (reviewQuery.isError) return <p className="tc-error">{errorText(reviewQuery.error)}</p>

  const { diff, issues } = reviewQuery.data
  const blockers = issues.filter((issue) => issue.severity === 'BLOCKER')
  const warnings = issues.filter((issue) => issue.severity === 'WARNING')

  return (
    <div className="tc-review">
      <section className="tc-review-summary">
        <article>
          <strong>{diff.addedConcepts.length}</strong>
          <span>itens novos</span>
        </article>
        <article>
          <strong>{diff.changedConcepts.length}</strong>
          <span>itens alterados</span>
        </article>
        <article>
          <strong>{diff.removedConcepts.length}</strong>
          <span>itens retirados</span>
        </article>
        <article>
          <strong>{diff.addedGroups.length + diff.changedGroups.length + diff.removedGroups.length}</strong>
          <span>mudanças em grupos</span>
        </article>
        <article>
          <strong>{diff.changedDimensions.length}</strong>
          <span>tabelas reconfiguradas</span>
        </article>
      </section>

      {blockers.length > 0 && (
        <section className="tc-issues is-blocker">
          <h3>Bloqueios ({blockers.length})</h3>
          <ul>
            {blockers.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <details className="tc-issues">
          <summary>Alertas ({warnings.length})</summary>
          <ul>
            {warnings.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="tc-diff">
        <summary>Ver lista de mudanças ({diff.sourceVersion ?? '—'} → {diff.targetVersion})</summary>
        <div>
          {diff.addedConcepts.length > 0 && <p><b>Novos:</b> {diff.addedConcepts.join(', ')}</p>}
          {diff.removedConcepts.length > 0 && <p><b>Retirados:</b> {diff.removedConcepts.join(', ')}</p>}
          {diff.changedConcepts.length > 0 && (
            <p>
              <b>Alterados:</b>{' '}
              {diff.changedConcepts.map((change) => `${change.code} (${change.fields.join(', ')})`).join('; ')}
            </p>
          )}
          {diff.addedGroups.length > 0 && <p><b>Grupos novos:</b> {diff.addedGroups.join(', ')}</p>}
          {diff.removedGroups.length > 0 && <p><b>Grupos removidos:</b> {diff.removedGroups.join(', ')}</p>}
          {diff.changedDimensions.length > 0 && (
            <p>
              <b>Tabelas:</b>{' '}
              {diff.changedDimensions.map((change) => `${change.code} (${change.fields.join(', ')})`).join('; ')}
            </p>
          )}
        </div>
      </details>

      <section className="tc-publish">
        <label>
          Notas da versão {state.draft.version} (o que mudou para os clientes)
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="tc-hint">
          Ao publicar, o Perfil Tributário passa a usar a {state.draft.version}
          {state.settings.classificationEnabled
            ? ' e o acervo inteiro será reclassificado em segundo plano.'
            : '. A classificação automática continua desligada.'}
        </p>
        <button
          type="button"
          className="is-primary"
          disabled={blockers.length > 0 || notes.trim().length < 3 || justification.trim().length < 3 || publish.isPending}
          onClick={() => publish.mutate()}
        >
          {publish.isPending ? 'Publicando…' : `Publicar ${state.draft.version}`}
        </button>
        {publish.isError && <p className="tc-error">{errorText(publish.error)}</p>}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Official catalogs                                                    */
/* ------------------------------------------------------------------ */

function CatalogsTab({
  apiFetch,
  state,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  state: CurationState
  justification: string
  onChanged: () => Promise<void>
}) {
  return (
    <div className="tc-catalogs">
      {state.catalogs.map((catalog) => (
        <CatalogCard
          key={catalog.code}
          apiFetch={apiFetch}
          catalog={catalog}
          justification={justification}
          onChanged={onChanged}
        />
      ))}
    </div>
  )
}

const CATALOG_COPY: Record<string, { title: string; source: string }> = {
  NCM: { title: 'NCM', source: 'Portal Único Siscomex (download oficial).' },
  CNAE: { title: 'CNAE 2.3', source: 'API de dados do IBGE / CONCLA.' },
  CCLASSTRIB: {
    title: 'cClassTrib (IBS/CBS)',
    source:
      'A consulta automática da Receita exige certificado digital ICP-Brasil, por isso a carga é por arquivo: 1) baixe a tabela de cClassTrib no Portal da NF-e (Informe Técnico 2025.002) ou no Portal Conformidade Fácil; 2) no Excel, “Salvar como” → CSV; 3) selecione o arquivo abaixo e clique em “Conferir fonte oficial”.',
  },
}

function CatalogCard({
  apiFetch,
  catalog,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  catalog: CurationState['catalogs'][number]
  justification: string
  onChanged: () => Promise<void>
}) {
  const [csv, setCsv] = useState<string | null>(null)
  const [validFrom, setValidFrom] = useState('')
  const [check, setCheck] = useState<CatalogCheck | null>(null)
  const copy = CATALOG_COPY[catalog.code]!

  const [needsFile, setNeedsFile] = useState(false)
  const runCheck = useMutation({
    mutationFn: () => checkCatalog(apiFetch, catalog.code, csv ?? undefined),
    onSuccess: setCheck,
  })
  const startCheck = () => {
    if (catalog.source === 'UPLOAD' && !csv) {
      setNeedsFile(true)
      return
    }
    setNeedsFile(false)
    setCheck(null)
    runCheck.mutate()
  }
  const runImport = useMutation({
    mutationFn: () =>
      importCatalog(apiFetch, catalog.code, {
        justification,
        expectedSha256: check!.sourceSha256,
        ...(csv ? { csv } : {}),
        ...(validFrom ? { validFrom } : {}),
      }),
    onSuccess: async () => {
      setCheck(null)
      await onChanged()
    },
  })

  return (
    <article className="tc-catalog">
      <header>
        <h3>{copy.title}</h3>
        <em className={catalog.loaded ? 'is-on' : 'is-off'}>{catalog.loaded ? 'Carregado' : 'Não carregado'}</em>
      </header>
      <p>{copy.source}</p>
      <dl>
        <div>
          <dt>Edição</dt>
          <dd>{catalog.editionCode ?? '—'}</dd>
        </div>
        <div>
          <dt>Vigente desde</dt>
          <dd>{catalog.validFrom ?? '—'}</dd>
        </div>
        <div>
          <dt>Códigos</dt>
          <dd>{catalog.entries.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Carregado em</dt>
          <dd>{formatDateTime(catalog.loadedAt)}</dd>
        </div>
      </dl>
      {catalog.source === 'UPLOAD' && (
        <div className="tc-catalog-upload">
          <label className="tc-file-button">
            <FileUp size={14} /> {csv ? 'Arquivo selecionado' : 'Selecionar CSV oficial'}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                setCheck(null)
                setNeedsFile(false)
                setCsv(file ? await readCsvFile(file) : null)
              }}
            />
          </label>
          <label>
            Vigência da tabela
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </label>
        </div>
      )}
      <div className="tc-actions">
        <button type="button" disabled={runCheck.isPending} onClick={startCheck}>
          <RefreshCw size={14} /> {runCheck.isPending ? 'Conferindo… (pode levar alguns segundos)' : 'Conferir fonte oficial'}
        </button>
        {needsFile && (
          <span className="tc-error" role="alert">
            Selecione primeiro o arquivo CSV oficial do cClassTrib.
          </span>
        )}
        {runCheck.isError && (
          <span className="tc-error" role="alert">
            {errorText(runCheck.error)}
          </span>
        )}
      </div>
      {check && (
        <div className="tc-catalog-check">
          {check.diff.upToDate ? (
            <p className="tc-ok">
              Conferido: a edição carregada já é a mais recente ({check.entries.toLocaleString('pt-BR')} códigos).
            </p>
          ) : (
            <>
              <p>
                <b>Conferência concluída.</b>{' '}
                {catalog.loaded ? 'Há uma edição nova na fonte oficial: ' : 'Catálogo ainda não carregado: '}
                {check.entries.toLocaleString('pt-BR')} códigos na fonte · {check.diff.added.toLocaleString('pt-BR')} novos ·{' '}
                {check.diff.removed.toLocaleString('pt-BR')} extintos ·{' '}
                {check.diff.descriptionChanged.toLocaleString('pt-BR')} descrições alteradas
              </p>
              {check.diff.samples.removed.length > 0 && (
                <small>Extintos (amostra): {check.diff.samples.removed.join(', ')}</small>
              )}
              <button
                type="button"
                className="is-primary"
                disabled={runImport.isPending}
                onClick={() => runImport.mutate()}
              >
                {runImport.isPending ? 'Carregando…' : catalog.loaded ? 'Carregar nova edição' : 'Carregar catálogo'}
              </button>
              {runImport.isError && <span className="tc-error">{errorText(runImport.error)}</span>}
            </>
          )}
        </div>
      )}
      {runImport.isSuccess && <p className="tc-ok">Edição {runImport.data.editionCode} carregada.</p>}
    </article>
  )
}

/* ------------------------------------------------------------------ */
/* Classification switch                                                */
/* ------------------------------------------------------------------ */

function ClassificationTab({
  apiFetch,
  state,
  justification,
  onChanged,
}: {
  apiFetch: ProductApiFetch
  state: CurationState
  justification: string
  onChanged: () => Promise<void>
}) {
  const [excluded, setExcluded] = useState(state.settings.classificationExcludedSources.join(', '))
  const enabled = state.settings.classificationEnabled
  const toggle = useMutation({
    mutationFn: () => setClassificationEnabled(apiFetch, !enabled, justification),
    onSuccess: onChanged,
  })
  const saveExcluded = useMutation({
    mutationFn: () => setExcludedSources(apiFetch, splitList(excluded).map((s) => s.toLowerCase()), justification),
    onSuccess: onChanged,
  })
  const progress = state.progress
  const percent = progress && progress.total > 0 ? Math.round((progress.classified / progress.total) * 100) : 0
  const justified = justification.trim().length >= 3

  return (
    <div className="tc-classification">
      <section className={`tc-switch ${enabled ? 'is-on' : 'is-off'}`}>
        <div>
          <h3>Classificação automática {enabled ? 'ligada' : 'desligada'}</h3>
          <p>
            Quando ligada, cada legislação gravada recebe as tags da versão {state.published?.version ?? '—'} e o
            acervo antigo é classificado em segundo plano, das mais recentes para as mais antigas. Publicar uma
            nova versão reclassifica tudo sem apagar o histórico.
          </p>
        </div>
        <button
          type="button"
          className={enabled ? '' : 'is-primary'}
          disabled={!justified || toggle.isPending}
          onClick={() => toggle.mutate()}
        >
          {toggle.isPending ? 'Salvando…' : enabled ? 'Desligar' : 'Ligar classificação'}
        </button>
        {toggle.isError && <p className="tc-error">{errorText(toggle.error)}</p>}
      </section>

      {state.draft && !enabled && (
        <p className="tc-warning">
          Há um rascunho ({state.draft.version}) ainda não publicado. Recomendado: revise e publique as tabelas
          antes de ligar — a classificação usa sempre a última versão publicada ({state.published?.version}).
        </p>
      )}

      {progress && (
        <section className="tc-progress">
          <h3>Classificação do acervo — taxonomia {state.published?.version}</h3>
          <div className="tc-bar" aria-label={`${percent}% classificado`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <p>
            {percent}% · {progress.classified.toLocaleString('pt-BR')} classificadas ·{' '}
            {progress.pending.toLocaleString('pt-BR')} pendentes · {progress.withoutTags.toLocaleString('pt-BR')}{' '}
            sem tags · {progress.failed.toLocaleString('pt-BR')} falhas · {progress.excluded.toLocaleString('pt-BR')}{' '}
            de fontes excluídas
          </p>
          <small>
            Motor {state.engine.key} v{state.engine.version}
          </small>
        </section>
      )}

      <section className="tc-excluded">
        <h3>Fontes fora da classificação</h3>
        <p>
          O DOE-SP fica excluído até o fechamento formal da sua reconstrução, que recusa histórico de
          classificação. Informe os códigos das fontes separados por vírgula.
        </p>
        <div className="tc-actions">
          <input value={excluded} onChange={(e) => setExcluded(e.target.value)} />
          <button type="button" disabled={!justified || saveExcluded.isPending} onClick={() => saveExcluded.mutate()}>
            Salvar
          </button>
          {saveExcluded.isError && <span className="tc-error">{errorText(saveExcluded.error)}</span>}
        </div>
      </section>
    </div>
  )
}
