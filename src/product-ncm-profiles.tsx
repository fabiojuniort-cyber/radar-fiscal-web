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
  productCode: string | null
  /** Label of a legacy profile not linked to the Produtos table. */
  legacyLabel: string | null
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

  const productByCode = useMemo(() => new Map(products.map((item) => [item.code, item])), [products])
  const segmentLabel = useMemo(
    () => new Map(segmentOptions.map((item) => [item.code, item.label])),
    [segmentOptions],
  )
  const selectedProduct = editor?.productCode ? productByCode.get(editor.productCode) : undefined

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

  const closeEditor = () => {
    setEditor(null)
    setProductSearch('')
    setNcmFilter('')
  }

  const refreshProfiles = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['product-ncm-profiles', tenantId, companyId],
    })
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error('editor_required')
      const product = editor.productCode ? productByCode.get(editor.productCode) : undefined
      if (!product) throw new Error('product_required')
      const input = {
        cnaeCode: editor.cnaeCode,
        productLabel: product.label,
        productConceptCode: product.code,
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
    setEditor({
      profileId: null,
      cnaeCode: cnae.code,
      cnaeDescription: cnae.description,
      productCode: null,
      legacyLabel: null,
      ncms: [],
    })
  }

  const beginEdit = (profile: CompanyProductProfile) => {
    saveMutation.reset()
    setProductSearch('')
    setNcmFilter('')
    // Older profiles kept a free label: link them when the name matches.
    const linked =
      profile.productConceptCode && productByCode.has(profile.productConceptCode)
        ? profile.productConceptCode
        : products.find((item) => normalize(item.label) === normalize(profile.productLabel))?.code ?? null
    setEditor({
      profileId: profile.id,
      cnaeCode: profile.cnaeCode ?? '',
      cnaeDescription: profile.cnaeDescription ?? '',
      productCode: linked,
      legacyLabel: linked ? null : profile.productLabel,
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
            legacyLabel: null,
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

          <div className="tp-product-picker">
            <span className="tp-picker-title">Produto da tabela de Produtos</span>
            {editor.legacyLabel && (
              <p className="tp-product-legacy" role="note">
                “{editor.legacyLabel}” não está vinculado à tabela de Produtos. Escolha o produto correspondente.
              </p>
            )}
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

          <div className="tp-selected-ncms">
            <strong>NCMs selecionados</strong>
            {editor.ncms.length === 0 ? (
              <p>Nenhum NCM selecionado. Marque os NCMs do produto acima ou salve só o produto.</p>
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
                : profileErrorMessage(saveMutation.error)}
            </p>
          )}

          <div className="tp-product-ncm-editor-actions">
            <button
              className="btn"
              type="button"
              disabled={saveMutation.isPending || !selectedProduct}
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
