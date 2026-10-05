import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  createCompanyProductProfile,
  deleteCompanyProductProfile,
  fetchCompanyProductProfiles,
  searchNcmCatalog,
  updateCompanyProductProfile,
  type CompanyProductProfile,
  type NcmCatalogItem,
} from './product-ncm-api'
import type { ProductApiFetch, TaxonomyProductOption } from './product-api'
import { formatOfficialCode } from './taxonomy-api'
import './product-ncm-profiles.css'

type Cnae = {
  code: string
  description: string
}

type EditorState = {
  profileId: string | null
  cnaeCode: string
  cnaeDescription: string
  /** "table": item of the Produtos table; "manual": product typed by the user. */
  mode: 'table' | 'manual'
  productCode: string | null
  manualLabel: string
  ncms: NcmCatalogItem[]
}

type Props = {
  apiFetch: ProductApiFetch
  tenantId: string
  companyId: string
  cnaes: Cnae[]
  /** Segmento table, offered for each CNAE. */
  segmentOptions: Array<{ code: string; label: string }>
  /** Segment of a CNAE and whether it is the CNAE's own suggestion. */
  segmentFor: (cnaeCode: string) => { code: string; suggested: boolean }
  onSegmentChange?: (cnaeCode: string, segmentCode: string) => void
  /** Produtos table: the only products a company can parametrize. */
  products: TaxonomyProductOption[]
}

const PRODUCT_LIST_LIMIT = 60

function profileErrorMessage(error: Error) {
  switch (error.message) {
    case 'product_profile_exists':
      return 'Já existe uma parametrização igual para este CNAE.'
    case 'cnae_not_linked':
      return 'O CNAE selecionado não está vinculado à empresa.'
    case 'invalid_ncm_codes':
      return 'Um dos NCMs selecionados não pertence ao catálogo oficial vigente.'
    case 'invalid_product':
      return 'O produto escolhido não está na tabela de Produtos publicada.'
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

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

const keepEnterInside = (event: React.KeyboardEvent<HTMLInputElement>) => {
  // The table lives inside the profile form: Enter must not submit it.
  if (event.key === 'Enter') event.preventDefault()
}

export function ProductNcmProfiles({
  apiFetch,
  tenantId,
  companyId,
  cnaes,
  segmentOptions,
  segmentFor,
  onSegmentChange,
  products,
}: Props) {
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [ncmFilter, setNcmFilter] = useState('')
  const [ncmSearch, setNcmSearch] = useState('')

  const productByCode = useMemo(() => new Map(products.map((item) => [item.code, item])), [products])
  const segmentLabel = useMemo(
    () => new Map(segmentOptions.map((item) => [item.code, item.label])),
    [segmentOptions],
  )
  const selectedProduct =
    editor?.mode === 'table' && editor.productCode ? productByCode.get(editor.productCode) : undefined

  const profilesQuery = useQuery({
    queryKey: ['product-ncm-profiles', tenantId, companyId],
    queryFn: () => fetchCompanyProductProfiles(apiFetch, tenantId, companyId),
    retry: false,
  })

  // NCMs offered = the catalog NCMs under the product's codes.
  const productNcmQuery = useQuery({
    queryKey: ['ncm-by-product', selectedProduct?.code, selectedProduct?.officialCodes.join(',')],
    queryFn: () => searchNcmCatalog(apiFetch, '', 200, selectedProduct!.officialCodes),
    enabled: Boolean(selectedProduct && selectedProduct.officialCodes.length > 0),
    retry: false,
  })

  // Manual product: any NCM of the official catalog.
  const ncmSearchQuery = useQuery({
    queryKey: ['ncm-catalog-search', ncmSearch.trim()],
    queryFn: () => searchNcmCatalog(apiFetch, ncmSearch.trim(), 20),
    enabled: editor?.mode === 'manual' && ncmSearch.trim().length >= 2,
    retry: false,
  })

  // The popup closes with Escape.
  useEffect(() => {
    if (!editor) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEditor()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  function closeEditor() {
    setEditor(null)
    setProductSearch('')
    setNcmFilter('')
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
      let productLabel: string
      let productConceptCode: string | null = null
      if (editor.mode === 'manual') {
        productLabel = editor.manualLabel.trim()
        if (!productLabel) throw new Error('product_label_required')
      } else {
        const product = editor.productCode ? productByCode.get(editor.productCode) : undefined
        if (!product) throw new Error('product_required')
        productLabel = product.label
        productConceptCode = product.code
      }
      const input = {
        cnaeCode: editor.cnaeCode,
        productLabel,
        productConceptCode,
        ncmCodes: editor.ncms.map((item) => item.code),
      }

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
    setProductSearch('')
    setNcmFilter('')
    setNcmSearch('')
    setEditor({
      profileId: null,
      cnaeCode: cnae.code,
      cnaeDescription: cnae.description,
      mode: products.length > 0 ? 'table' : 'manual',
      productCode: null,
      manualLabel: '',
      ncms: [],
    })
  }

  const beginEdit = (profile: CompanyProductProfile) => {
    saveMutation.reset()
    setProductSearch('')
    setNcmFilter('')
    setNcmSearch('')
    // A product of the table stays linked; otherwise it is a manual product.
    const linked =
      profile.productConceptCode && productByCode.has(profile.productConceptCode)
        ? profile.productConceptCode
        : null
    setEditor({
      profileId: profile.id,
      cnaeCode: profile.cnaeCode ?? '',
      cnaeDescription: profile.cnaeDescription ?? '',
      mode: linked ? 'table' : 'manual',
      productCode: linked,
      manualLabel: linked ? '' : profile.productLabel,
      ncms: profile.ncms.map(toCatalogItem),
    })
  }

  const chooseProduct = (product: TaxonomyProductOption) => {
    setProductSearch('')
    setNcmFilter('')
    setEditor((current) =>
      current
        ? {
            ...current,
            productCode: product.code,
            // Keep only NCMs that belong to the chosen product.
            ncms: current.ncms.filter((item) =>
              product.officialCodes.some((prefix) => item.code.startsWith(prefix.replace(/\D/g, ''))),
            ),
          }
        : current,
    )
  }

  const toggleNcm = (item: NcmCatalogItem, checked: boolean) => {
    setEditor((current) => {
      if (!current) return current
      const without = current.ncms.filter((candidate) => candidate.code !== item.code)
      return { ...current, ncms: checked ? [...without, item] : without }
    })
  }

  const removeNcm = (code: string) => {
    setEditor((current) =>
      current
        ? { ...current, ncms: current.ncms.filter((item) => item.code !== code) }
        : current,
    )
  }

  // Product list: the CNAE's segment first, then the rest of the table.
  const productSections = useMemo(() => {
    if (!editor) return []
    const needle = normalize(productSearch)
    const matches = products.filter(
      (item) =>
        !needle ||
        normalize(item.label).includes(needle) ||
        normalize(item.groupLabel ?? '').includes(needle) ||
        item.officialCodes.some((code) => code.includes(needle.replace(/\D/g, '') || '\u0000')),
    )
    const segmentCode = segmentFor(editor.cnaeCode).code
    const inSegment = segmentCode ? matches.filter((item) => item.segmentCodes.includes(segmentCode)) : []
    const others = matches.filter((item) => !inSegment.includes(item))
    return [
      ...(inSegment.length
        ? [{ title: `Do segmento ${segmentLabel.get(segmentCode) ?? ''}`.trim(), items: inSegment }]
        : []),
      ...(others.length ? [{ title: inSegment.length ? 'Outros produtos' : 'Produtos', items: others }] : []),
    ]
  }, [editor, productSearch, products, segmentFor, segmentLabel])

  const productNcms = productNcmQuery.data?.items ?? []
  const ncmNeedle = normalize(ncmFilter)
  const visibleProductNcms = productNcms.filter(
    (item) =>
      !ncmNeedle ||
      item.code.includes(ncmNeedle.replace(/\D/g, '') || '\u0000') ||
      normalize(item.description).includes(ncmNeedle),
  )

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
          <span>Segmento</span>
          <span>Produto</span>
          <span>NCM</span>
        </div>

        {cnaes.map((cnae) => {
          const profiles = profilesByCnae.get(cnae.code) ?? []
          return (
            <div className="tp-cnae-profile-row" key={cnae.code}>
              <b>{cnae.code}</b>
              <span>{cnae.description}</span>
              <div className="tp-cnae-segment-cell">
                {onSegmentChange ? (
                  <select
                    aria-label={`Segmento do CNAE ${cnae.code}`}
                    value={segmentFor(cnae.code).code}
                    onChange={(event) => onSegmentChange(cnae.code, event.target.value)}
                  >
                    <option value="">— sem segmento —</option>
                    {segmentFor(cnae.code).code && !segmentLabel.has(segmentFor(cnae.code).code) && (
                      <option value={segmentFor(cnae.code).code} disabled>
                        {segmentFor(cnae.code).code} (fora da tabela Segmento)
                      </option>
                    )}
                    {segmentOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{segmentLabel.get(segmentFor(cnae.code).code) ?? '—'}</span>
                )}
                {segmentFor(cnae.code).code && (
                  <small>{segmentFor(cnae.code).suggested ? 'Pelo CNAE' : 'Alterado por você'}</small>
                )}
              </div>

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
        <div
          className="tp-product-dialog-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saveMutation.isPending) closeEditor()
          }}
        >
        <section
          className="tp-product-ncm-editor tp-product-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tp-product-dialog-title"
        >
          <div className="tp-product-ncm-editor-head">
            <div>
              <span className="tp-eyebrow">Produto e NCM</span>
              <h4 id="tp-product-dialog-title">
                {editor.profileId ? 'Editar produto e NCM' : 'Adicionar produto e NCM'}
              </h4>
              <p>
                CNAE <b>{editor.cnaeCode}</b> · {editor.cnaeDescription || 'Atividade não informada'}
              </p>
            </div>
            <button type="button" onClick={closeEditor} aria-label="Fechar parametrização">
              <X size={16} />
              Fechar
            </button>
          </div>

          <div className="tp-product-mode" role="tablist" aria-label="Origem do produto">
            <button
              type="button"
              role="tab"
              aria-selected={editor.mode === 'table'}
              onClick={() => setEditor((current) => (current ? { ...current, mode: 'table', ncms: [] } : current))}
            >
              Da tabela de Produtos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editor.mode === 'manual'}
              onClick={() =>
                setEditor((current) => (current ? { ...current, mode: 'manual', productCode: null } : current))
              }
            >
              Produto novo (manual)
            </button>
          </div>

          {editor.mode === 'manual' ? (
            <>
              <label className="tp-product-field">
                Nome do produto
                <input
                  autoFocus
                  value={editor.manualLabel}
                  maxLength={160}
                  placeholder="Ex.: Fertilizante foliar próprio"
                  onKeyDown={keepEnterInside}
                  onChange={(event) =>
                    setEditor((current) => (current ? { ...current, manualLabel: event.target.value } : current))
                  }
                />
                <small>Fica só no painel desta empresa; não entra na tabela de Produtos.</small>
              </label>
              <div className="tp-ncm-picker">
                <span className="tp-picker-title">NCM do catálogo oficial</span>
                <div className="tp-ncm-search-box">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Pesquisar NCM oficial"
                    value={ncmSearch}
                    placeholder="Código ou descrição do NCM"
                    onKeyDown={keepEnterInside}
                    onChange={(event) => setNcmSearch(event.target.value)}
                  />
                </div>
                {ncmSearch.trim().length > 0 && ncmSearch.trim().length < 2 && (
                  <small>Digite pelo menos 2 caracteres para pesquisar.</small>
                )}
                {ncmSearchQuery.isFetching && <small>Pesquisando no catálogo oficial…</small>}
                {ncmSearchQuery.isError && (
                  <p className="auth-error" role="alert">Não foi possível pesquisar o catálogo NCM.</p>
                )}
                {(ncmSearchQuery.data?.items.length ?? 0) > 0 && (
                  <div className="tp-ncm-search-results" role="group" aria-label="NCMs encontrados">
                    {ncmSearchQuery.data!.items.map((item) => {
                      const selected = editor.ncms.some((candidate) => candidate.code === item.code)
                      return (
                        <label className={selected ? 'tp-ncm-option is-selected' : 'tp-ncm-option'} key={item.entryId}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => toggleNcm(item, event.target.checked)}
                          />
                          <span>
                            <b>{item.officialCode || item.code}</b>
                            <small>{item.description}</small>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
          <>
          <div className="tp-product-picker">
            <span className="tp-picker-title">Produto da tabela de Produtos</span>
            {selectedProduct ? (
              <div className="tp-product-selected">
                <span>
                  <strong>{selectedProduct.label}</strong>
                  {selectedProduct.groupLabel && <small>{selectedProduct.groupLabel}</small>}
                </span>
                <button
                  type="button"
                  onClick={() => setEditor((current) => (current ? { ...current, productCode: null } : current))}
                >
                  Trocar produto
                </button>
              </div>
            ) : products.length === 0 ? (
              <p className="tp-parameter-empty">
                A tabela de Produtos ainda não tem itens publicados para o perfil.
              </p>
            ) : (
              <>
                <div className="tp-ncm-search-box">
                  <Search size={16} aria-hidden="true" />
                  <input
                    autoFocus
                    id="tp-product-search"
                    aria-label="Pesquisar produto"
                    value={productSearch}
                    placeholder="Nome, grupo ou NCM do produto"
                    onKeyDown={keepEnterInside}
                    onChange={(event) => setProductSearch(event.target.value)}
                  />
                </div>
                <div className="tp-product-options" role="listbox" aria-label="Produtos disponíveis">
                  {productSections.length === 0 && (
                    <p className="tp-parameter-empty">Nenhum produto encontrado na tabela.</p>
                  )}
                  {productSections.map((section) => (
                    <div className="tp-product-option-group" key={section.title}>
                      <small>{section.title}</small>
                      {section.items.slice(0, PRODUCT_LIST_LIMIT).map((item) => (
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          key={item.code}
                          onClick={() => chooseProduct(item)}
                        >
                          <span>
                            <b>{item.label}</b>
                            <small>
                              {[item.groupLabel, item.officialCodes.map((code) => formatOfficialCode('NCM', code)).join(', ')]
                                .filter(Boolean)
                                .join(' · ')}
                            </small>
                          </span>
                          <Plus size={15} />
                        </button>
                      ))}
                      {section.items.length > PRODUCT_LIST_LIMIT && (
                        <p className="tp-parameter-empty">
                          Mais {section.items.length - PRODUCT_LIST_LIMIT} produtos: refine a pesquisa.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {selectedProduct && (
            <div className="tp-ncm-picker">
              <span className="tp-picker-title">NCMs do produto</span>
              {selectedProduct.officialCodes.length === 0 ? (
                <p className="tp-parameter-empty">
                  Este produto não tem NCM na tabela de Produtos. Você pode salvar só o produto.
                </p>
              ) : productNcmQuery.isPending ? (
                <small>Carregando NCMs do produto…</small>
              ) : productNcmQuery.isError ? (
                <p className="auth-error" role="alert">
                  Não foi possível carregar os NCMs do produto.
                </p>
              ) : productNcms.length === 0 ? (
                <p className="tp-parameter-empty">
                  Nenhum NCM do catálogo oficial vigente sob {selectedProduct.officialCodes
                    .map((code) => formatOfficialCode('NCM', code))
                    .join(', ')}.
                </p>
              ) : (
                <>
                  {productNcms.length > 12 && (
                    <div className="tp-ncm-search-box">
                      <Search size={16} aria-hidden="true" />
                      <input
                        aria-label="Filtrar NCMs do produto"
                        value={ncmFilter}
                        placeholder="Filtrar por código ou descrição"
                        onKeyDown={keepEnterInside}
                        onChange={(event) => setNcmFilter(event.target.value)}
                      />
                    </div>
                  )}
                  <div className="tp-ncm-search-results" role="group" aria-label="NCMs disponíveis do produto">
                    {visibleProductNcms.map((item) => {
                      const selected = editor.ncms.some((candidate) => candidate.code === item.code)
                      return (
                        <label className={selected ? 'tp-ncm-option is-selected' : 'tp-ncm-option'} key={item.entryId}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => toggleNcm(item, event.target.checked)}
                          />
                          <span>
                            <b>{item.officialCode || item.code}</b>
                            <small>{item.description}</small>
                          </span>
                          {selected && <Check size={15} aria-hidden="true" />}
                        </label>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          </>
          )}

          <div className="tp-selected-ncms">
            <strong>NCMs selecionados</strong>
            {editor.ncms.length === 0 ? (
              <p>Nenhum NCM selecionado. Marque os NCMs acima ou salve só o produto.</p>
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
              {saveMutation.error.message === 'product_required'
                ? 'Escolha o produto na tabela de Produtos.'
                : saveMutation.error.message === 'product_label_required'
                  ? 'Informe o nome do produto.'
                  : profileErrorMessage(saveMutation.error)}
            </p>
          )}

          <div className="tp-product-ncm-editor-actions">
            <button
              className="btn"
              type="button"
              disabled={
                saveMutation.isPending ||
                (editor.mode === 'manual' ? !editor.manualLabel.trim() : !selectedProduct)
              }
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
              Cancelar
            </button>
          </div>
        </section>
        </div>
      )}
    </div>
  )
}
