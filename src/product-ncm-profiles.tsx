import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Check, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  addCompanyCnaeNcms,
  createCompanyProductProfile,
  deleteCompanyCnaeNcm,
  deleteCompanyProductProfile,
  fetchCompanyCnaeNcms,
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

/** Product popup: an item of the Produtos table or a product typed by the user. */
type ProductDialog = {
  profileId: string | null
  cnae: Cnae
  mode: 'table' | 'manual'
  /** Editing: the product of the table. */
  productCode: string | null
  /** Editing: the manual name. Adding: the name being typed. */
  manualLabel: string
  /** Adding: products of the table picked at once. */
  picked: string[]
  /** Adding: manual products typed at once. */
  manualLabels: string[]
  /** NCMs already linked to the product (kept when it is edited). */
  ncmCodes: string[]
}

/** NCM popup: NCMs of the CNAE, optionally linked to one of its products. */
type NcmDialog = {
  cnae: Cnae
  selected: NcmCatalogItem[]
  linkProfileId: string
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
  /** Produtos table: products a company can pick for a CNAE. */
  products: TaxonomyProductOption[]
}

const PRODUCT_LIST_LIMIT = 60

function profileErrorMessage(error: Error) {
  if (error.message.startsWith('products_failed:')) {
    return `Não foi possível adicionar: ${error.message.slice('products_failed:'.length)}. Os demais foram salvos.`
  }
  switch (error.message) {
    case 'product_required':
      return 'Escolha o produto na tabela de Produtos.'
    case 'product_label_required':
      return 'Informe o nome do produto.'
    case 'ncm_required':
      return 'Marque pelo menos um NCM.'
    case 'product_profile_exists':
      return 'Este produto já está neste CNAE.'
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
      return 'Não foi possível salvar. Tente novamente.'
  }
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

const keepEnterInside = (event: React.KeyboardEvent<HTMLInputElement>) => {
  // The table lives inside the profile form: Enter must not submit it.
  if (event.key === 'Enter') event.preventDefault()
}

/** Popup over the page; closes with Escape, a click outside or "Fechar". */
function Popup({
  title,
  subtitle,
  busy,
  onClose,
  children,
}: {
  title: string
  subtitle: ReactNode
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  return (
    <div
      className="tp-product-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className="tp-product-ncm-editor tp-product-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="tp-product-ncm-editor-head">
          <div>
            <span className="tp-eyebrow">Perfil tributário</span>
            <h4>{title}</h4>
            <p>{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={16} />
            Fechar
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function NcmOption({
  item,
  checked,
  onChange,
}: {
  item: NcmCatalogItem
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={checked ? 'tp-ncm-option is-selected' : 'tp-ncm-option'}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <b>{item.officialCode || item.code}</b>
        <small>{item.description}</small>
      </span>
    </label>
  )
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
  const [productDialog, setProductDialog] = useState<ProductDialog | null>(null)
  const [ncmDialog, setNcmDialog] = useState<NcmDialog | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [ncmSearch, setNcmSearch] = useState('')

  const productByCode = useMemo(() => new Map(products.map((item) => [item.code, item])), [products])
  const segmentLabel = useMemo(
    () => new Map(segmentOptions.map((item) => [item.code, item.label])),
    [segmentOptions],
  )

  const profilesKey = ['product-ncm-profiles', tenantId, companyId]
  const cnaeNcmsKey = ['cnae-ncms', tenantId, companyId]
  const profilesQuery = useQuery({
    queryKey: profilesKey,
    queryFn: () => fetchCompanyProductProfiles(apiFetch, tenantId, companyId),
    retry: false,
  })
  const cnaeNcmsQuery = useQuery({
    queryKey: cnaeNcmsKey,
    queryFn: () => fetchCompanyCnaeNcms(apiFetch, tenantId, companyId),
    retry: false,
  })

  const profilesByCnae = useMemo(() => {
    const map = new Map<string, CompanyProductProfile[]>()
    for (const profile of profilesQuery.data ?? []) {
      if (!profile.cnaeCode) continue
      map.set(profile.cnaeCode, [...(map.get(profile.cnaeCode) ?? []), profile])
    }
    return map
  }, [profilesQuery.data])

  const cnaeNcmsByCnae = useMemo(() => {
    const map = new Map<string, NonNullable<typeof cnaeNcmsQuery.data>>()
    for (const item of cnaeNcmsQuery.data ?? []) {
      map.set(item.cnaeCode, [...(map.get(item.cnaeCode) ?? []), item])
    }
    return map
  }, [cnaeNcmsQuery.data])

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: profilesKey }),
      queryClient.invalidateQueries({ queryKey: cnaeNcmsKey }),
    ])
  }

  // ---------------------------------------------------------------- product

  const selectedProduct =
    productDialog?.mode === 'table' && productDialog.productCode
      ? productByCode.get(productDialog.productCode)
      : undefined

  function closeProductDialog() {
    setProductDialog(null)
    setProductSearch('')
  }

  // Products of the table already in the CNAE being edited.
  const addedCodes = new Set(
    productDialog
      ? (profilesByCnae.get(productDialog.cnae.code) ?? []).flatMap((profile) =>
          profile.productConceptCode ? [profile.productConceptCode] : [],
        )
      : [],
  )

  // Adding: everything picked or typed, saved at once.
  const pendingProducts = productDialog && !productDialog.profileId
    ? [
        ...productDialog.picked.flatMap((code) => {
          const product = productByCode.get(code)
          return product ? [{ productLabel: product.label, productConceptCode: product.code as string | null }] : []
        }),
        ...[...productDialog.manualLabels, productDialog.manualLabel]
          .map((label) => label.trim())
          .filter((label, index, all) => label && all.indexOf(label) === index)
          .map((label) => ({ productLabel: label, productConceptCode: null as string | null })),
      ]
    : []

  const saveProduct = useMutation({
    mutationFn: async () => {
      if (!productDialog) throw new Error('editor_required')
      if (!productDialog.profileId) {
        if (pendingProducts.length === 0) throw new Error('product_required')
        const failed: string[] = []
        for (const item of pendingProducts) {
          try {
            await createCompanyProductProfile(apiFetch, tenantId, companyId, {
              cnaeCode: productDialog.cnae.code,
              ...item,
              ncmCodes: [],
            })
          } catch (error) {
            // Already in this CNAE: nothing to add.
            if (!(error instanceof Error && error.message === 'product_profile_exists')) failed.push(item.productLabel)
          }
        }
        if (failed.length > 0) {
          await refresh()
          throw new Error(`products_failed:${failed.join(', ')}`)
        }
        return
      }
      let productLabel: string
      let productConceptCode: string | null = null
      if (productDialog.mode === 'manual') {
        productLabel = productDialog.manualLabel.trim()
        if (!productLabel) throw new Error('product_label_required')
      } else {
        const product = productDialog.productCode ? productByCode.get(productDialog.productCode) : undefined
        if (!product) throw new Error('product_required')
        productLabel = product.label
        productConceptCode = product.code
      }
      const input = {
        cnaeCode: productDialog.cnae.code,
        productLabel,
        productConceptCode,
        ncmCodes: productDialog.ncmCodes,
      }
      await updateCompanyProductProfile(apiFetch, tenantId, companyId, productDialog.profileId, input)
    },
    onSuccess: async () => {
      await refresh()
      closeProductDialog()
    },
  })

  const deleteProduct = useMutation({
    mutationFn: (profileId: string) => deleteCompanyProductProfile(apiFetch, tenantId, companyId, profileId),
    onSuccess: refresh,
  })

  const openProduct = (cnae: Cnae, profile?: CompanyProductProfile) => {
    saveProduct.reset()
    setProductSearch('')
    const linked =
      profile?.productConceptCode && productByCode.has(profile.productConceptCode)
        ? profile.productConceptCode
        : null
    setProductDialog({
      profileId: profile?.id ?? null,
      cnae,
      mode: linked || (!profile && products.length > 0) ? 'table' : 'manual',
      productCode: linked,
      manualLabel: profile && !linked ? profile.productLabel : '',
      picked: [],
      manualLabels: [],
      ncmCodes: profile?.ncms.map((ncm) => ncm.code) ?? [],
    })
  }

  const togglePicked = (code: string) =>
    setProductDialog((current) =>
      current
        ? {
            ...current,
            picked: current.picked.includes(code)
              ? current.picked.filter((item) => item !== code)
              : [...current.picked, code],
          }
        : current,
    )

  const addManualLabel = () =>
    setProductDialog((current) => {
      const label = current?.manualLabel.trim()
      if (!current || !label) return current
      return {
        ...current,
        manualLabel: '',
        manualLabels: current.manualLabels.includes(label) ? current.manualLabels : [...current.manualLabels, label],
      }
    })

  // Product list: the CNAE's segment first, then the rest of the table.
  const productSections = useMemo(() => {
    if (!productDialog) return []
    const needle = normalize(productSearch)
    const digits = needle.replace(/\D/g, '')
    const matches = products.filter(
      (item) =>
        !needle ||
        normalize(item.label).includes(needle) ||
        normalize(item.groupLabel ?? '').includes(needle) ||
        (digits.length > 0 && item.officialCodes.some((code) => code.includes(digits))),
    )
    const segmentCode = segmentFor(productDialog.cnae.code).code
    const inSegment = segmentCode ? matches.filter((item) => item.segmentCodes.includes(segmentCode)) : []
    const others = matches.filter((item) => !inSegment.includes(item))
    return [
      ...(inSegment.length
        ? [{ title: `Do segmento ${segmentLabel.get(segmentCode) ?? ''}`.trim(), items: inSegment }]
        : []),
      ...(others.length ? [{ title: inSegment.length ? 'Outros produtos' : 'Produtos', items: others }] : []),
    ]
  }, [productDialog, productSearch, products, segmentFor, segmentLabel])

  // -------------------------------------------------------------------- NCM

  const ncmCnaeProfiles = ncmDialog ? profilesByCnae.get(ncmDialog.cnae.code) ?? [] : []
  // NCMs suggested from the Produtos table: the codes of this CNAE's products.
  const suggestedPrefixes = [
    ...new Set(
      ncmCnaeProfiles.flatMap((profile) =>
        profile.productConceptCode ? productByCode.get(profile.productConceptCode)?.officialCodes ?? [] : [],
      ),
    ),
  ]
  const suggestedNcmQuery = useQuery({
    queryKey: ['ncm-by-product', suggestedPrefixes.join(',')],
    queryFn: () => searchNcmCatalog(apiFetch, '', 200, suggestedPrefixes),
    enabled: Boolean(ncmDialog) && suggestedPrefixes.length > 0,
    retry: false,
  })
  const ncmSearchQuery = useQuery({
    queryKey: ['ncm-catalog-search', ncmSearch.trim()],
    queryFn: () => searchNcmCatalog(apiFetch, ncmSearch.trim(), 20),
    enabled: Boolean(ncmDialog) && ncmSearch.trim().length >= 2,
    retry: false,
  })

  function closeNcmDialog() {
    setNcmDialog(null)
    setNcmSearch('')
  }

  const openNcm = (cnae: Cnae) => {
    saveNcm.reset()
    setNcmSearch('')
    setNcmDialog({ cnae, selected: [], linkProfileId: '' })
  }

  const toggleNcm = (item: NcmCatalogItem, checked: boolean) => {
    setNcmDialog((current) => {
      if (!current) return current
      const without = current.selected.filter((candidate) => candidate.code !== item.code)
      return { ...current, selected: checked ? [...without, item] : without }
    })
  }

  const saveNcm = useMutation({
    mutationFn: async () => {
      if (!ncmDialog) throw new Error('editor_required')
      const codes = ncmDialog.selected.map((item) => item.code)
      if (codes.length === 0) throw new Error('ncm_required')
      const profile = ncmCnaeProfiles.find((item) => item.id === ncmDialog.linkProfileId)
      if (profile) {
        // Linked to a product: added to that product's NCMs.
        await updateCompanyProductProfile(apiFetch, tenantId, companyId, profile.id, {
          cnaeCode: ncmDialog.cnae.code,
          productLabel: profile.productLabel,
          productConceptCode: profile.productConceptCode ?? null,
          ncmCodes: [...new Set([...profile.ncms.map((ncm) => ncm.code), ...codes])],
        })
        return
      }
      await addCompanyCnaeNcms(apiFetch, tenantId, companyId, { cnaeCode: ncmDialog.cnae.code, ncmCodes: codes })
    },
    onSuccess: async () => {
      await refresh()
      closeNcmDialog()
    },
  })

  const removeCnaeNcm = useMutation({
    mutationFn: (ncmId: string) => deleteCompanyCnaeNcm(apiFetch, tenantId, companyId, ncmId),
    onSuccess: refresh,
  })

  const removeProductNcm = useMutation({
    mutationFn: ({ profile, code }: { profile: CompanyProductProfile; code: string }) =>
      updateCompanyProductProfile(apiFetch, tenantId, companyId, profile.id, {
        cnaeCode: profile.cnaeCode,
        productLabel: profile.productLabel,
        productConceptCode: profile.productConceptCode ?? null,
        ncmCodes: profile.ncms.map((ncm) => ncm.code).filter((item) => item !== code),
      }),
    onSuccess: refresh,
  })

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

  const suggestedNcms = suggestedNcmQuery.data?.items ?? []
  const isSelected = (code: string) => ncmDialog?.selected.some((item) => item.code === code) ?? false

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
          const cnaeNcms = cnaeNcmsByCnae.get(cnae.code) ?? []
          const productNcms = profiles.filter((profile) => profile.ncms.length > 0)
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
                  <span className="tp-parameter-empty">Nenhum produto</span>
                ) : (
                  <div className="tp-ncm-chip-list">
                    {profiles.map((profile) => (
                      <span
                        className="tp-ncm-chip"
                        key={profile.id}
                        title={profile.productConceptCode ? 'Da tabela de Produtos' : 'Produto manual'}
                      >
                        {profile.productLabel}
                        <button
                          type="button"
                          aria-label={'Remover produto ' + profile.productLabel}
                          disabled={deleteProduct.isPending}
                          onClick={() => deleteProduct.mutate(profile.id)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <button className="tp-product-add-button" type="button" onClick={() => openProduct(cnae)}>
                  <Plus size={14} />
                  Adicionar produto
                </button>
              </div>

              <div className="tp-ncm-profile-cell">
                {cnaeNcms.length === 0 && productNcms.length === 0 && (
                  <span className="tp-parameter-empty">Nenhum NCM</span>
                )}
                {cnaeNcms.length > 0 && (
                  <div className="tp-ncm-chip-list">
                    {cnaeNcms.map((ncm) => (
                      <span className="tp-ncm-chip" key={ncm.id} title={ncm.description}>
                        {ncm.officialCode}
                        <button
                          type="button"
                          aria-label={'Remover NCM ' + ncm.officialCode}
                          disabled={removeCnaeNcm.isPending}
                          onClick={() => removeCnaeNcm.mutate(ncm.id)}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {productNcms.map((profile) => (
                  <div className="tp-ncm-product-group" key={profile.id}>
                    <small>{profile.productLabel}</small>
                    <div className="tp-ncm-chip-list">
                      {profile.ncms.map((ncm) => (
                        <span className="tp-ncm-chip" key={ncm.code} title={ncm.description}>
                          {ncm.officialCode || ncm.code}
                          <button
                            type="button"
                            aria-label={`Remover NCM ${ncm.officialCode || ncm.code} de ${profile.productLabel}`}
                            disabled={removeProductNcm.isPending}
                            onClick={() => removeProductNcm.mutate({ profile, code: ncm.code })}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <button className="tp-product-add-button" type="button" onClick={() => openNcm(cnae)}>
                  <Plus size={14} />
                  Adicionar NCM
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {(deleteProduct.isError || removeCnaeNcm.isError || removeProductNcm.isError) && (
        <p className="auth-error" role="alert">
          Não foi possível remover. Tente novamente.
        </p>
      )}

      {productDialog && (
        <Popup
          title={productDialog.profileId ? 'Editar produto' : 'Adicionar produto'}
          subtitle={
            <>
              CNAE <b>{productDialog.cnae.code}</b> · {productDialog.cnae.description || 'Atividade não informada'}
            </>
          }
          busy={saveProduct.isPending}
          onClose={closeProductDialog}
        >
          <div className="tp-product-mode" role="tablist" aria-label="Origem do produto">
            <button
              type="button"
              role="tab"
              aria-selected={productDialog.mode === 'table'}
              onClick={() => setProductDialog((current) => (current ? { ...current, mode: 'table' } : current))}
            >
              Da tabela de Produtos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={productDialog.mode === 'manual'}
              onClick={() => setProductDialog((current) => (current ? { ...current, mode: 'manual' } : current))}
            >
              Produto novo (manual)
            </button>
          </div>

          {productDialog.mode === 'manual' ? (
            <label className="tp-product-field">
              Nome do produto
              <span className="tp-manual-product-row">
                <input
                  autoFocus
                  value={productDialog.manualLabel}
                  maxLength={160}
                  placeholder="Ex.: Fertilizante foliar próprio"
                  onKeyDown={(event) => {
                    keepEnterInside(event)
                    if (event.key === 'Enter' && !productDialog.profileId) addManualLabel()
                  }}
                  onChange={(event) =>
                    setProductDialog((current) => (current ? { ...current, manualLabel: event.target.value } : current))
                  }
                />
                {!productDialog.profileId && (
                  <button type="button" disabled={!productDialog.manualLabel.trim()} onClick={addManualLabel}>
                    <Plus size={14} /> Incluir
                  </button>
                )}
              </span>
              <small>
                {productDialog.profileId
                  ? 'Fica só no painel desta empresa; não entra na tabela de Produtos.'
                  : 'Inclua um ou mais nomes. Ficam só no painel desta empresa; não entram na tabela de Produtos.'}
              </small>
            </label>
          ) : (
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
                    onClick={() => setProductDialog((current) => (current ? { ...current, productCode: null } : current))}
                  >
                    Trocar produto
                  </button>
                </div>
              ) : products.length === 0 ? (
                <p className="tp-parameter-empty">
                  A tabela de Produtos ainda não tem itens publicados. Use “Produto novo (manual)”.
                </p>
              ) : (
                <>
                  <div className="tp-ncm-search-box">
                    <Search size={16} aria-hidden="true" />
                    <input
                      autoFocus
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
                        {section.items.slice(0, PRODUCT_LIST_LIMIT).map((item) => {
                          const already = !productDialog.profileId && addedCodes.has(item.code)
                          const picked = productDialog.picked.includes(item.code)
                          return (
                          <button
                            type="button"
                            role="option"
                            aria-selected={picked}
                            className={picked ? 'is-picked' : undefined}
                            disabled={already}
                            key={item.code}
                            onClick={() =>
                              productDialog.profileId
                                ? setProductDialog((current) =>
                                    current ? { ...current, productCode: item.code } : current,
                                  )
                                : togglePicked(item.code)
                            }
                          >
                            <span>
                              <b>{item.label}</b>
                              <small>
                                {[
                                  item.groupLabel,
                                  item.officialCodes.map((code) => formatOfficialCode('NCM', code)).join(', '),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </small>
                            </span>
                            {already ? <small>Já adicionado</small> : picked ? <Check size={15} /> : <Plus size={15} />}
                          </button>
                          )
                        })}
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
          )}

          {!productDialog.profileId && (
            <div className="tp-selected-ncms">
              <strong>Produtos a adicionar ({pendingProducts.length})</strong>
              {pendingProducts.length === 0 ? (
                <p>Marque um ou mais produtos da tabela e/ou inclua produtos manuais.</p>
              ) : (
                <div className="tp-selected-ncm-list">
                  {productDialog.picked.map((code) => (
                    <span key={code}>
                      <b>{productByCode.get(code)?.label ?? code}</b>
                      <button type="button" aria-label={'Desmarcar ' + (productByCode.get(code)?.label ?? code)} onClick={() => togglePicked(code)}>
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {productDialog.manualLabels.map((label) => (
                    <span key={'manual:' + label}>
                      <b>{label}</b> (manual)
                      <button
                        type="button"
                        aria-label={'Retirar ' + label}
                        onClick={() =>
                          setProductDialog((current) =>
                            current ? { ...current, manualLabels: current.manualLabels.filter((item) => item !== label) } : current,
                          )
                        }
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {saveProduct.isError && (
            <p className="auth-error" role="alert">
              {profileErrorMessage(saveProduct.error)}
            </p>
          )}

          <div className="tp-product-ncm-editor-actions">
            <button
              className="btn"
              type="button"
              disabled={
                saveProduct.isPending ||
                (productDialog.profileId
                  ? productDialog.mode === 'manual'
                    ? !productDialog.manualLabel.trim()
                    : !selectedProduct
                  : pendingProducts.length === 0)
              }
              onClick={() => saveProduct.mutate()}
            >
              {saveProduct.isPending
                ? 'Salvando…'
                : productDialog.profileId
                  ? 'Salvar produto'
                  : `Salvar ${pendingProducts.length > 1 ? `${pendingProducts.length} produtos` : 'produto'}`}
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              disabled={saveProduct.isPending}
              onClick={closeProductDialog}
            >
              Cancelar
            </button>
          </div>
        </Popup>
      )}

      {ncmDialog && (
        <Popup
          title="Adicionar NCM"
          subtitle={
            <>
              CNAE <b>{ncmDialog.cnae.code}</b> · {ncmDialog.cnae.description || 'Atividade não informada'}
            </>
          }
          busy={saveNcm.isPending}
          onClose={closeNcmDialog}
        >
          {suggestedPrefixes.length > 0 && (
            <div className="tp-ncm-picker">
              <span className="tp-picker-title">NCMs dos produtos deste CNAE</span>
              {suggestedNcmQuery.isPending ? (
                <small>Carregando NCMs dos produtos…</small>
              ) : suggestedNcms.length === 0 ? (
                <p className="tp-parameter-empty">Nenhum NCM do catálogo vigente sob os códigos dos produtos.</p>
              ) : (
                <div className="tp-ncm-search-results" role="group" aria-label="NCMs dos produtos">
                  {suggestedNcms.map((item) => (
                    <NcmOption
                      key={item.entryId}
                      item={item}
                      checked={isSelected(item.code)}
                      onChange={(checked) => toggleNcm(item, checked)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="tp-ncm-picker">
            <span className="tp-picker-title">Pesquisar no catálogo oficial de NCM</span>
            <div className="tp-ncm-search-box">
              <Search size={16} aria-hidden="true" />
              <input
                autoFocus={suggestedPrefixes.length === 0}
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
                {ncmSearchQuery.data!.items.map((item) => (
                  <NcmOption
                    key={item.entryId}
                    item={item}
                    checked={isSelected(item.code)}
                    onChange={(checked) => toggleNcm(item, checked)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="tp-selected-ncms">
            <strong>NCMs selecionados</strong>
            {ncmDialog.selected.length === 0 ? (
              <p>Nenhum NCM selecionado.</p>
            ) : (
              <div className="tp-selected-ncm-list">
                {ncmDialog.selected.map((item) => (
                  <span key={item.code} title={item.description}>
                    <b>{item.officialCode || item.code}</b>
                    <button
                      type="button"
                      aria-label={'Desmarcar NCM ' + (item.officialCode || item.code)}
                      onClick={() => toggleNcm(item, false)}
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {ncmCnaeProfiles.length > 0 && (
            <label className="tp-product-field">
              Vincular a um produto (opcional)
              <select
                value={ncmDialog.linkProfileId}
                onChange={(event) =>
                  setNcmDialog((current) => (current ? { ...current, linkProfileId: event.target.value } : current))
                }
              >
                <option value="">Não vincular: só ao CNAE</option>
                {ncmCnaeProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.productLabel}
                  </option>
                ))}
              </select>
            </label>
          )}

          {saveNcm.isError && (
            <p className="auth-error" role="alert">
              {profileErrorMessage(saveNcm.error)}
            </p>
          )}

          <div className="tp-product-ncm-editor-actions">
            <button
              className="btn"
              type="button"
              disabled={saveNcm.isPending || ncmDialog.selected.length === 0}
              onClick={() => saveNcm.mutate()}
            >
              {saveNcm.isPending ? 'Salvando…' : 'Salvar NCM'}
            </button>
            <button
              className="launch-secondary-button"
              type="button"
              disabled={saveNcm.isPending}
              onClick={closeNcmDialog}
            >
              Cancelar
            </button>
          </div>
        </Popup>
      )}
    </div>
  )
}
