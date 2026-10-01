import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

import {
  createCompanyProductProfile,
  deleteCompanyProductProfile,
  fetchCompanyProductProfiles,
  searchNcmCatalog,
  updateCompanyProductProfile,
  type CompanyProductProfile,
  type NcmCatalogItem,
} from './product-ncm-api'
import type { ProductApiFetch } from './product-api'
import './product-ncm-profile.css'

type CnaeItem = {
  code: string
  description: string
}

type Props = {
  apiFetch: ProductApiFetch
  tenantId: string
  companyId: string
  cnaes: CnaeItem[]
  sectorForCnae: (code: string) => string
}

type EditorState = {
  cnaeCode: string
  profileId: string | null
  productLabel: string
  ncms: NcmCatalogItem[]
}

function formatNcm(code: string) {
  const digits = code.replace(/\D/g, '')
  if (digits.length !== 8) return code
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
}

function errorLabel(error: unknown) {
  const code = error instanceof Error ? error.message : 'request_failed'
  if (code === 'cnae_not_linked') return 'O CNAE não está vinculado à empresa ativa.'
  if (code === 'invalid_ncm_codes') return 'Um ou mais NCMs não pertencem ao catálogo oficial vigente.'
  if (code === 'product_profile_exists') return 'Essa parametrização já existe para a empresa.'
  if (code === 'tenant_access_denied') return 'Você não possui acesso a esta empresa.'
  return 'Não foi possível salvar a parametrização. Tente novamente.'
}

function profileNcms(profile: CompanyProductProfile): NcmCatalogItem[] {
  return profile.ncms.map((item) => ({
    entryId: item.entryId,
    code: item.code,
    officialCode: item.officialCode,
    description: item.description,
  }))
}

export function ProductNcmProfile({
  apiFetch,
  tenantId,
  companyId,
  cnaes,
  sectorForCnae,
}: Props) {
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [ncmQuery, setNcmQuery] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const profilesQuery = useQuery({
    queryKey: ['product-ncm-profiles', tenantId, companyId],
    queryFn: () => fetchCompanyProductProfiles(apiFetch, tenantId, companyId),
    retry: false,
  })

  const searchQuery = useQuery({
    queryKey: ['ncm-catalog-search', ncmQuery.trim()],
    queryFn: () => searchNcmCatalog(apiFetch, ncmQuery.trim(), 12),
    enabled: ncmQuery.trim().length >= 2,
    retry: false,
  })

  const profilesByCnae = useMemo(() => {
    const map = new Map<string, CompanyProductProfile[]>()
    for (const profile of profilesQuery.data ?? []) {
      if (!profile.cnaeCode) continue
      const items = map.get(profile.cnaeCode) ?? []
      items.push(profile)
      map.set(profile.cnaeCode, items)
    }
    return map
  }, [profilesQuery.data])

  const invalidate = () => queryClient.invalidateQueries({
    queryKey: ['product-ncm-profiles', tenantId, companyId],
  })

  const saveMutation = useMutation({
    mutationFn: async (state: EditorState) => {
      const input = {
        cnaeCode: state.cnaeCode,
        productLabel: state.productLabel.trim(),
        ncmCodes: state.ncms.map((item) => item.code),
      }
      if (state.profileId) {
        return updateCompanyProductProfile(
          apiFetch,
          tenantId,
          companyId,
          state.profileId,
          input,
        )
      }
      return createCompanyProductProfile(apiFetch, tenantId, companyId, input)
    },
    onSuccess: async () => {
      await invalidate()
      setEditor(null)
      setNcmQuery('')
      setSaveError(null)
    },
    onError: (error) => setSaveError(errorLabel(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: (profileId: string) =>
      deleteCompanyProductProfile(apiFetch, tenantId, companyId, profileId),
    onSuccess: async () => {
      await invalidate()
      setEditor(null)
      setNcmQuery('')
      setSaveError(null)
    },
    onError: (error) => setSaveError(errorLabel(error)),
  })

  const startNew = (cnaeCode: string) => {
    setEditor({ cnaeCode, profileId: null, productLabel: '', ncms: [] })
    setNcmQuery('')
    setSaveError(null)
  }

  const startEdit = (profile: CompanyProductProfile) => {
    if (!profile.cnaeCode) return
    setEditor({
      cnaeCode: profile.cnaeCode,
      profileId: profile.id,
      productLabel: profile.productLabel,
      ncms: profileNcms(profile),
    })
    setNcmQuery('')
    setSaveError(null)
  }

  const addNcm = (item: NcmCatalogItem) => {
    setEditor((current) => {
      if (!current || current.ncms.some((ncm) => ncm.code === item.code)) return current
      return { ...current, ncms: [...current.ncms, item] }
    })
  }

  const removeNcm = (code: string) => {
    setEditor((current) => current
      ? { ...current, ncms: current.ncms.filter((item) => item.code !== code) }
      : current)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!editor || !editor.productLabel.trim()) return
    setSaveError(null)
    saveMutation.mutate(editor)
  }

  if (profilesQuery.isLoading) {
    return <p className="tp-product-ncm-status">Carregando produtos e NCMs…</p>
  }

  if (profilesQuery.isError) {
    return <p className="tp-product-ncm-status is-error">Não foi possível carregar produtos e NCMs.</p>
  }

  return (
    <div className="tp-product-ncm-table">
      <div className="tp-product-ncm-head" aria-hidden="true">
        <span>CNAE</span>
        <span>Atividade</span>
        <span>Setor</span>
        <span>Produto</span>
        <span>NCM</span>
      </div>

      {cnaes.map((cnae) => {
        const profiles = profilesByCnae.get(cnae.code) ?? []
        const editingThisCnae = editor?.cnaeCode === cnae.code

        return (
          <div className="tp-product-ncm-group" key={cnae.code}>
            <div className="tp-product-ncm-row">
              <b>{cnae.code}</b>
              <span>{cnae.description}</span>
              <span>{sectorForCnae(cnae.code)}</span>
              <div className="tp-product-ncm-products">
                {profiles.length === 0 ? (
                  <button type="button" className="tp-product-ncm-add" onClick={() => startNew(cnae.code)}>
                    <Plus size={14} aria-hidden="true" /> Adicionar produto
                  </button>
                ) : (
                  <>
                    {profiles.map((profile) => (
                      <button
                        type="button"
                        className="tp-product-ncm-product"
                        key={profile.id}
                        onClick={() => startEdit(profile)}
                        aria-label={`Editar produto ${profile.productLabel}`}
                      >
                        {profile.productLabel} <Pencil size={13} aria-hidden="true" />
                      </button>
                    ))}
                    <button type="button" className="tp-product-ncm-add is-compact" onClick={() => startNew(cnae.code)}>
                      <Plus size={13} aria-hidden="true" /> Adicionar
                    </button>
                  </>
                )}
              </div>
              <div className="tp-product-ncm-codes">
                {profiles.length === 0 || profiles.every((profile) => profile.ncms.length === 0) ? (
                  <span className="tp-product-ncm-empty">Nenhum NCM parametrizado</span>
                ) : profiles.flatMap((profile) => profile.ncms).map((ncm) => (
                  <span className="tp-ncm-code" title={ncm.description} key={`${ncm.entryId}-${ncm.code}`}>
                    {formatNcm(ncm.code)}
                  </span>
                ))}
              </div>
            </div>

            {editingThisCnae && editor && (
              <form className="tp-product-ncm-editor" onSubmit={submit}>
                <div className="tp-product-ncm-editor-title">
                  <div>
                    <strong>{editor.profileId ? 'Editar produto e NCM' : 'Adicionar produto e NCM'}</strong>
                    <span>CNAE {cnae.code} · {cnae.description}</span>
                  </div>
                  <button
                    type="button"
                    className="tp-product-ncm-icon-button"
                    onClick={() => {
                      setEditor(null)
                      setNcmQuery('')
                      setSaveError(null)
                    }}
                    aria-label="Cancelar edição"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                <label>
                  Produto
                  <input
                    value={editor.productLabel}
                    placeholder="Ex.: Arroz"
                    maxLength={160}
                    required
                    onChange={(event) => setEditor({ ...editor, productLabel: event.target.value })}
                  />
                </label>

                <label>
                  Pesquisar NCM oficial
                  <div className="tp-product-ncm-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      value={ncmQuery}
                      placeholder="Código ou descrição do NCM"
                      onChange={(event) => setNcmQuery(event.target.value)}
                    />
                  </div>
                </label>

                {ncmQuery.trim().length >= 2 && (
                  <div className="tp-product-ncm-results" aria-label="Resultados do catálogo NCM">
                    {searchQuery.isFetching ? (
                      <span>Pesquisando catálogo oficial…</span>
                    ) : searchQuery.isError ? (
                      <span>Não foi possível pesquisar o catálogo.</span>
                    ) : (searchQuery.data?.items.length ?? 0) === 0 ? (
                      <span>Nenhum NCM atribuível encontrado.</span>
                    ) : searchQuery.data!.items.map((item) => {
                      const selected = editor.ncms.some((ncm) => ncm.code === item.code)
                      return (
                        <button
                          type="button"
                          key={item.entryId}
                          disabled={selected}
                          onClick={() => addNcm(item)}
                        >
                          <b>{formatNcm(item.code)}</b>
                          <span>{item.description}</span>
                          {selected && <Check size={15} aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="tp-product-ncm-selected">
                  <strong>NCMs selecionados</strong>
                  {editor.ncms.length === 0 ? (
                    <span>Nenhum NCM selecionado.</span>
                  ) : (
                    <div>
                      {editor.ncms.map((ncm) => (
                        <button
                          type="button"
                          key={ncm.entryId}
                          onClick={() => removeNcm(ncm.code)}
                          title={`Remover ${ncm.description}`}
                        >
                          {formatNcm(ncm.code)} <X size={13} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {saveError && <p className="tp-product-ncm-error">{saveError}</p>}

                <div className="tp-product-ncm-actions">
                  <button type="submit" disabled={saveMutation.isPending || !editor.productLabel.trim()}>
                    <Check size={15} aria-hidden="true" />
                    {editor.profileId ? 'Atualizar produto e NCM' : 'Salvar produto e NCM'}
                  </button>
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={() => {
                      setEditor(null)
                      setNcmQuery('')
                      setSaveError(null)
                    }}
                  >
                    Cancelar edição
                  </button>
                  {editor.profileId && (
                    <button
                      type="button"
                      className="is-danger"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(editor.profileId!)}
                    >
                      <Trash2 size={15} aria-hidden="true" /> Excluir produto e NCM
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )
      })}
    </div>
  )
}
