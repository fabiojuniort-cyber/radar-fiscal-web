import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'

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
import './product-ncm-profiles.css'

type Cnae = {
  code: string
  description: string
}

type EditorState = {
  profileId: string | null
  cnaeCode: string
  cnaeDescription: string
  productLabel: string
  ncms: NcmCatalogItem[]
}

type Props = {
  apiFetch: ProductApiFetch
  tenantId: string
  companyId: string
  cnaes: Cnae[]
  sectorLabel: (code: string) => string
}

function profileErrorMessage(error: Error) {
  switch (error.message) {
    case 'product_profile_exists':
      return 'Já existe uma parametrização igual para este CNAE.'
    case 'cnae_not_linked':
      return 'O CNAE selecionado não está vinculado à empresa.'
    case 'invalid_ncm_codes':
      return 'Um dos NCMs selecionados não pertence ao catálogo oficial vigente.'
    case 'company_not_found':
      return 'A empresa não está disponível nesta conta.'
    case 'tenant_access_denied':
      return 'Sua conta não possui acesso a esta empresa.'
    default:
      return 'Não foi possível salvar a parametrização. Tente novamente.'
  }
}

function toCatalogItem(profileNcm: CompanyProductProfile['ncms'][number]): NcmCatalogItem {
  return {
    entryId: profileNcm.entryId,
    code: profileNcm.code,
    officialCode: profileNcm.officialCode,
    description: profileNcm.description,
  }
}

export function ProductNcmProfiles({
  apiFetch,
  tenantId,
  companyId,
  cnaes,
  sectorLabel,
}: Props) {
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [ncmSearch, setNcmSearch] = useState('')

  const profilesQuery = useQuery({
    queryKey: ['product-ncm-profiles', tenantId, companyId],
    queryFn: () => fetchCompanyProductProfiles(apiFetch, tenantId, companyId),
    retry: false,
  })

  const ncmQuery = useQuery({
    queryKey: ['ncm-catalog-search', ncmSearch.trim()],
    queryFn: () => searchNcmCatalog(apiFetch, ncmSearch.trim(), 20),
    enabled: ncmSearch.trim().length >= 2,
    retry: false,
  })

  const closeEditor = () => {
    setEditor(null)
    setNcmSearch('')
  }

  const refreshProfiles = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['product-ncm-profiles', tenantId, companyId],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('editor_required')
      const input = {
        cnaeCode: editor.cnaeCode,
        productLabel: editor.productLabel.trim(),
        ncmCodes: editor.ncms.map((item) => item.code),
      }
      if (!input.productLabel) throw new Error('product_label_required')

      return editor.profileId
        ? updateCompanyProductProfile(
            apiFetch,
            tenantId,
            companyId,
            editor.profileId,
            input,
          )
        : createCompanyProductProfile(
            apiFetch,
            tenantId,
            companyId,
            input,
          )
    },
    onSuccess: async () => {
      await refreshProfiles()
      closeEditor()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (profileId: string) =>
      deleteCompanyProductProfile(apiFetch, tenantId, companyId, profileId),
    onSuccess: refreshProfiles,
  })

  const profilesByCnae = useMemo(() => {
    const map = new Map<string, CompanyProductProfile[]>()
    for (const profile of profilesQuery.data ?? []) {
      if (!profile.cnaeCode) continue
      const current = map.get(profile.cnaeCode) ?? []
      current.push(profile)
      map.set(profile.cnaeCode, current)
    }
    return map
  }, [profilesQuery.data])

  const beginCreate = (cnae: Cnae) => {
    saveMutation.reset()
    setNcmSearch('')
    setEditor({
      profileId: null,
      cnaeCode: cnae.code,
      cnaeDescription: cnae.description,
      productLabel: '',
      ncms: [],
    })
  }

  const beginEdit = (profile: CompanyProductProfile) => {
    saveMutation.reset()
    setNcmSearch('')
    setEditor({
      profileId: profile.id,
      cnaeCode: profile.cnaeCode ?? '',
      cnaeDescription: profile.cnaeDescription ?? '',
      productLabel: profile.productLabel,
      ncms: profile.ncms.map(toCatalogItem),
    })
  }

  const addNcm = (item: NcmCatalogItem) => {
    setEditor((current) => {
      if (!current || current.ncms.some((candidate) => candidate.code === item.code)) {
        return current
      }
      return { ...current, ncms: [...current.ncms, item] }
    })
  }

  const removeNcm = (code: string) => {
    setEditor((current) =>
      current
        ? { ...current, ncms: current.ncms.filter((item) => item.code !== code) }
        : current,
    )
  }

  if (profilesQuery.isPending) {
    return <p className="tp-product-ncm-status">Carregando produtos e NCMs…</p>
  }

  if (profilesQuery.isError) {
    return (
      <p className="tp-product-ncm-status is-error" role="alert">
        Não foi possível carregar os produtos e NCMs parametrizados.
      </p>
    )
  }

  return (
    <div className="tp-product-ncm-profiles">
      <div className="tp-cnae-profile-table">
        <div className="tp-cnae-profile-head">
          <span>CNAE</span>
          <span>Atividade</span>
          <span>Setor</span>
          <span>Produto</span>
          <span>NCM</span>
        </div>

        {cnaes.map((cnae) => {
          const profiles = profilesByCnae.get(cnae.code) ?? []
          return (
            <div className="tp-cnae-profile-row" key={cnae.code}>
              <b>{cnae.code}</b>
              <span>{cnae.description}</span>
              <span>{sectorLabel(cnae.code)}</span>

              <div className="tp-product-profile-cell">
                {profiles.length === 0 ? (
                  <span className="tp-parameter-empty">Nenhum produto parametrizado</span>
                ) : (
                  profiles.map((profile) => (
                    <div className="tp-product-profile-item" key={profile.id}>
                      <strong>{profile.productLabel}</strong>
                      <span className="tp-product-profile-actions">
                        <button
                          type="button"
                          title={'Editar ' + profile.productLabel}
                          aria-label={'Editar produto ' + profile.productLabel}
                          onClick={() => beginEdit(profile)}
                        >
                          <Pencil size={14} />
                          Editar
                        </button>
                        <button
                          className="is-danger"
                          type="button"
                          title={'Remover ' + profile.productLabel}
                          aria-label={'Remover produto ' + profile.productLabel}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(profile.id)}
                        >
                          <Trash2 size={14} />
                          Remover
                        </button>
                      </span>
                    </div>
                  ))
                )}
                <button
                  className="tp-product-add-button"
                  type="button"
                  onClick={() => beginCreate(cnae)}
                >
                  <Plus size={14} />
                  Adicionar produto e NCM
                </button>
              </div>

              <div className="tp-ncm-profile-cell">
                {profiles.length === 0 ? (
                  <span className="tp-parameter-empty">Nenhum NCM parametrizado</span>
                ) : (
                  profiles.map((profile) => (
                    <div className="tp-ncm-product-group" key={profile.id}>
                      <small>{profile.productLabel}</small>
                      <div className="tp-ncm-chip-list">
                        {profile.ncms.length === 0 ? (
                          <span className="tp-parameter-empty">Sem NCM</span>
                        ) : (
                          profile.ncms.map((ncm) => (
                            <span className="tp-ncm-chip" key={ncm.code} title={ncm.description}>
                              {ncm.officialCode || ncm.code}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {deleteMutation.isError && (
        <p className="auth-error" role="alert">
          Não foi possível remover a parametrização.
        </p>
      )}

      {editor && (
        <section className="tp-product-ncm-editor" aria-label="Parametrização de produto e NCM">
          <div className="tp-product-ncm-editor-head">
            <div>
              <span className="tp-eyebrow">Produto e NCM</span>
              <h4>{editor.profileId ? 'Editar parametrização' : 'Adicionar parametrização'}</h4>
              <p>
                CNAE <b>{editor.cnaeCode}</b> · {editor.cnaeDescription || 'Atividade não informada'}
              </p>
            </div>
            <button type="button" onClick={closeEditor} aria-label="Fechar parametrização">
              <X size={16} />
              Fechar
            </button>
          </div>

          <label className="tp-product-field">
            Produto
            <input
              value={editor.productLabel}
              maxLength={160}
              placeholder="Ex.: Arroz, soja, fertilizante NPK"
              onChange={(event) =>
                setEditor((current) =>
                  current ? { ...current, productLabel: event.target.value } : current,
                )
              }
            />
          </label>

          <div className="tp-ncm-picker">
            <label htmlFor="tp-ncm-search">Pesquisar NCM oficial</label>
            <div className="tp-ncm-search-box">
              <Search size={16} aria-hidden="true" />
              <input
                id="tp-ncm-search"
                value={ncmSearch}
                placeholder="Código ou descrição do NCM"
                onChange={(event) => setNcmSearch(event.target.value)}
              />
            </div>

            {ncmSearch.trim().length > 0 && ncmSearch.trim().length < 2 && (
              <small>Digite pelo menos 2 caracteres para pesquisar.</small>
            )}

            {ncmQuery.isFetching && (
              <small>Pesquisando no catálogo oficial…</small>
            )}

            {ncmQuery.isError && (
              <p className="auth-error" role="alert">
                Não foi possível pesquisar o catálogo NCM.
              </p>
            )}

            {(ncmQuery.data?.items.length ?? 0) > 0 && (
              <div className="tp-ncm-search-results">
                {ncmQuery.data!.items.map((item) => {
                  const selected = editor.ncms.some((candidate) => candidate.code === item.code)
                  return (
                    <button
                      type="button"
                      className={selected ? 'is-selected' : ''}
                      disabled={selected}
                      key={item.entryId}
                      onClick={() => addNcm(item)}
                    >
                      <span>
                        <b>{item.officialCode || item.code}</b>
                        <small>{item.description}</small>
                      </span>
                      {selected ? <Check size={15} /> : <Plus size={15} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="tp-selected-ncms">
            <strong>NCMs selecionados</strong>
            {editor.ncms.length === 0 ? (
              <p>Nenhum NCM selecionado. Você pode salvar o produto e adicionar NCMs depois.</p>
            ) : (
              <div className="tp-selected-ncm-list">
                {editor.ncms.map((item) => (
                  <span key={item.code} title={item.description}>
                    <b>{item.officialCode || item.code}</b>
                    <button
                      type="button"
                      aria-label={'Remover NCM ' + (item.officialCode || item.code)}
                      onClick={() => removeNcm(item.code)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {saveMutation.isError && (
            <p className="auth-error" role="alert">
              {saveMutation.error.message === 'product_label_required'
                ? 'Informe o nome do produto.'
                : profileErrorMessage(saveMutation.error)}
            </p>
          )}

          <div className="tp-product-ncm-editor-actions">
            <button
              className="btn"
              type="button"
              disabled={saveMutation.isPending || !editor.productLabel.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Salvando…' : 'Salvar produto e NCM'}
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              disabled={saveMutation.isPending}
              onClick={closeEditor}
            >
              Cancelar edição
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
