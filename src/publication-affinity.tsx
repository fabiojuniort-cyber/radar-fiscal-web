import { useQuery } from '@tanstack/react-query'
import { Building2, ChevronDown, Target } from 'lucide-react'
import { useState } from 'react'

import {
  fetchAccountSummary,
  fetchPublicationAffinity,
  type AffinityLevel,
  type ProductApiFetch,
  type PublicationAffinity,
} from './product-api'

/**
 * TAX-11: how close the act is to the tax profile of the company selected
 * in the panel. The company can be switched here; the choice is shared with
 * the panel (same session state).
 */

const PANEL_STATE_KEY = 'tribusca.panel.state'

export const AFFINITY_LABELS: Record<AffinityLevel, string> = {
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
  NONE: 'Sem afinidade',
}

const DIMENSION_LABELS: Record<string, string> = {
  product: 'Produto',
  sector: 'Segmento',
  tax: 'Tributo',
  regime: 'Regime',
  operation: 'Operação',
  operation_purpose: 'Finalidade',
  treatment: 'Tratamento',
  tax_species: 'Espécie tributária',
  document: 'Documento',
  obligation: 'Obrigação',
  theme: 'Tema',
  ncm: 'NCM',
  product_text: 'Produto',
  keyword: 'Palavra-chave',
}

function readPanelCompanyId(): string {
  try {
    const raw = sessionStorage.getItem(PANEL_STATE_KEY)
    const state = raw ? (JSON.parse(raw) as { selectedCompanyId?: unknown }) : null
    return typeof state?.selectedCompanyId === 'string' ? state.selectedCompanyId : ''
  } catch {
    return ''
  }
}

function writePanelCompanyId(companyId: string) {
  try {
    const raw = sessionStorage.getItem(PANEL_STATE_KEY)
    const state = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    sessionStorage.setItem(PANEL_STATE_KEY, JSON.stringify({ ...state, selectedCompanyId: companyId }))
  } catch {
    // Session storage unavailable: the choice lasts while the page is open.
  }
}

function summary(affinity: PublicationAffinity): string {
  if (affinity.status === 'NO_PROFILE') return 'Perfil tributário não preenchido'
  if (affinity.status === 'NOT_CLASSIFIED') return 'Legislação ainda não classificada'
  return AFFINITY_LABELS[affinity.level ?? 'NONE']
}

export function PublicationAffinityBadge({
  apiFetch,
  tenantId,
  publicationId,
}: {
  apiFetch: ProductApiFetch
  tenantId: string
  publicationId: string
}) {
  const [chosenCompanyId, setChosenCompanyId] = useState(readPanelCompanyId)
  const [open, setOpen] = useState(false)

  const accountQuery = useQuery({
    queryKey: ['launch', 'account', tenantId],
    queryFn: () => fetchAccountSummary(apiFetch, tenantId),
    retry: false,
  })
  const companies = accountQuery.data?.companies ?? []
  const company = companies.find((item) => item.id === chosenCompanyId) ?? companies[0]

  const affinityQuery = useQuery({
    queryKey: ['publication-affinity', tenantId, company?.id, publicationId],
    queryFn: () => fetchPublicationAffinity(apiFetch, tenantId, company!.id, publicationId),
    enabled: Boolean(company),
    retry: false,
  })

  if (accountQuery.isError || affinityQuery.isError) return null
  if (accountQuery.isSuccess && companies.length === 0) return null

  const affinity = affinityQuery.data
  const level = affinity?.status === 'OK' ? (affinity.level ?? 'NONE') : 'UNKNOWN'
  const companyName = company ? company.tradeName || company.legalName : ''

  return (
    <div className="publication-affinity" data-level={affinity ? level : 'LOADING'}>
      <div className="publication-affinity-row">
        <span className="publication-affinity-pill">
          <Target size={15} aria-hidden="true" />
          Afinidade:{' '}
          <strong>{affinity ? summary(affinity) : 'calculando…'}</strong>
        </span>

        {companies.length > 1 ? (
          <label className="publication-affinity-company">
            <Building2 size={15} aria-hidden="true" />
            <select
              aria-label="Empresa"
              value={company?.id ?? ''}
              onChange={(event) => {
                setChosenCompanyId(event.target.value)
                writePanelCompanyId(event.target.value)
                setOpen(false)
              }}
            >
              {companies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tradeName || item.legalName}
                </option>
              ))}
            </select>
          </label>
        ) : (
          companyName && (
            <span className="publication-affinity-company">
              <Building2 size={15} aria-hidden="true" />
              {companyName}
            </span>
          )
        )}

        {affinity?.status === 'OK' && affinity.matches.length > 0 && (
          <button
            type="button"
            className="publication-affinity-why"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Por quê?
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {affinity?.status === 'NO_PROFILE' && (
        <p className="publication-affinity-note">
          Complete o perfil tributário de {companyName} no painel (Empresas → Perfil tributário) para ver a
          afinidade.
        </p>
      )}
      {affinity?.status === 'OK' && affinity.matches.length === 0 && (
        <p className="publication-affinity-note">
          Nenhuma tag desta legislação coincide com o perfil tributário de {companyName}.
        </p>
      )}

      {open && affinity?.status === 'OK' && (
        <ul className="publication-affinity-matches" aria-label="Tags em comum com o perfil">
          {affinity.matches.map((match) => (
            <li key={match.code}>
              <span className="publication-affinity-dimension">
                {DIMENSION_LABELS[match.dimensionCode] ?? match.dimensionCode}
              </span>
              <span>
                {match.label}
                {match.via === 'PRODUCT_GROUP' && (
                  <small> (grupo de um produto do perfil)</small>
                )}
                {match.via === 'TEXT' && <small> (citado no texto do ato)</small>}
              </span>
              <span className="publication-affinity-weight" title="Peso na afinidade">
                +{match.weight}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
