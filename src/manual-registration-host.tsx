import {
  FormEvent,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import {
  getPendingManualRegistration,
  rejectManualRegistration,
  resolveManualRegistration,
  subscribeManualRegistration,
  type ManualCompanyForm,
  type ManualEstablishmentForm,
  type ManualCnae,
  type ManualCnaeOption,
} from './manual-registration-bridge'
import './manual-registration.css'

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5
    ? digits.slice(0, 5) + '-' + digits.slice(5)
    : digits
}

const EMPTY_COMMON = {
  uf: '',
  municipalityName: '',
  postalCode: '',
  street: '',
  streetNumber: '',
  district: '',
  stateRegistration: '',
}

export function ManualRegistrationHost() {
  const pending = useSyncExternalStore(
    subscribeManualRegistration,
    getPendingManualRegistration,
    getPendingManualRegistration,
  )
  const [legalName, setLegalName] = useState('')
  const [establishmentName, setEstablishmentName] = useState('')
  const [common, setCommon] = useState(EMPTY_COMMON)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'details' | 'cnaes'>('details')
  const [manualInput, setManualInput] = useState<ManualCompanyForm | ManualEstablishmentForm | null>(null)
  const [cnaeSearch, setCnaeSearch] = useState('')
  const [availableCnaes, setAvailableCnaes] = useState<ManualCnaeOption[]>([])
  const [selectedCode, setSelectedCode] = useState('')
  const [selectedCnaes, setSelectedCnaes] = useState<ManualCnae[]>([])
  const [cnaesLoading, setCnaesLoading] = useState(false)
  const [cnaesError, setCnaesError] = useState<string | null>(null)
  const [reactivationPending, setReactivationPending] = useState(false)


  useEffect(() => {
    if (!pending) return

    setLegalName('')
    setEstablishmentName('')
    setCommon(EMPTY_COMMON)
    setSubmitting(false)
    setError(null)
    setStep('details')
    setManualInput(null)
    setCnaeSearch('')
    setAvailableCnaes([])
    setSelectedCode('')
    setSelectedCnaes([])
    setCnaesLoading(false)
    setCnaesError(null)
    setReactivationPending(false)
  }, [pending])

  useEffect(() => {
    if (!pending || step !== 'cnaes') return
    const lookup = pending.request.searchCnaes
    if (!lookup) {
      setCnaesError('Catálogo oficial de CNAEs não disponível para esta sessão.')
      return
    }
    let active = true
    setCnaesLoading(true)
    setCnaesError(null)
    void lookup(cnaeSearch).then((options) => {
      if (!active) return
      setAvailableCnaes(options)
      setSelectedCode((current) => options.some((option) => option.code === current) ? current : '')
    }).catch(() => {
      if (active) {
        setAvailableCnaes([])
        setCnaesError('Não foi possível consultar o catálogo oficial de CNAEs. Tente novamente.')
      }
    }).finally(() => {
      if (active) setCnaesLoading(false)
    })
    return () => { active = false }
  }, [pending, step, cnaeSearch])

  if (!pending) return null

  const { request } = pending
  const isCompany = request.kind === 'company'

  const patchCommon = (
    patch: Partial<typeof EMPTY_COMMON>,
  ) => {
    setCommon((current) => ({
      ...current,
      ...patch,
    }))
  }

  const optional = (value: string) =>
    value.trim() || undefined

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const postalDigits = common.postalCode.replace(/\D/g, '')
    if (postalDigits && postalDigits.length !== 8) {
      setError('CEP inválido. Informe os 8 dígitos do CEP.')
      return
    }

    const postalCode = postalDigits || undefined
    const input = {
      ...(request.kind === 'company'
        ? { legalName: legalName.trim() }
        : { name: establishmentName.trim() }),
      uf: common.uf,
      municipalityName: optional(common.municipalityName),
      postalCode,
      street: optional(common.street),
      streetNumber: optional(common.streetNumber),
      district: optional(common.district),
      stateRegistration: optional(common.stateRegistration),
    }
    setManualInput(input)
    setStep('cnaes')
  }

  const submitCnaes = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!manualInput || selectedCnaes.length === 0) {
      setError('Selecione ao menos um CNAE oficial e defina o principal.')
      return
    }
    setSubmitting(true)
    try {
      const result = request.kind === 'company'
        ? await request.submit({ ...(manualInput as ManualCompanyForm), cnaes: selectedCnaes, reactivateInactive: reactivationPending })
        : await request.submit({ ...(manualInput as ManualEstablishmentForm), cnaes: selectedCnaes, reactivateInactive: reactivationPending })
      resolveManualRegistration(result)
    } catch (cause) {
      const code =
        cause instanceof Error
          ? cause.message
          : 'manual_registration_failed'

      if (code === 'reactivation_required') {
        setReactivationPending(true)
        setError('O cadastro está inativo. Confirme a reativação para preservar os dados existentes sem sobrescrevê-los.')
      } else if (code === 'cnae_catalog_unavailable') {
        setError('O catálogo oficial de CNAEs está indisponível. Nenhum dado foi gravado.')
      } else if (code === 'invalid_cnae') {
        setError('CNAE não validado na edição oficial vigente. Atualize sua seleção.')
      } else if (code === 'establishment_cnpj_root_mismatch' || code === 'head_office_cnpj_required') {
        setError('Este CNPJ não pertence à matriz selecionada ou não corresponde a uma matriz.')
      } else if (code === 'business_location_code_exists') {
        setError(
          'Este Local Negócio já está sendo usado por outro estabelecimento.',
        )
      } else if (
        code === 'company_cnpj_exists' ||
        code === 'establishment_conflict'
      ) {
        setError('Este CNPJ já está cadastrado.')
      } else if (code === 'invalid_cnpj') {
        setError('O CNPJ informado é inválido.')
      } else if (
        code === 'invalid_postal_code' ||
        code.includes('postalCode')
      ) {
        setError('CEP inválido. Informe os 8 dígitos do CEP.')
      } else if (code === 'admin_required') {
        setError('Seu usuário não possui permissão para concluir este cadastro.')
      } else {
        setError(
          'Não foi possível concluir o cadastro. Confira os campos destacados e tente novamente.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'cnaes') {
    const addCnae = () => {
      const candidate = availableCnaes.find((option) => option.code === selectedCode)
      if (!candidate || selectedCnaes.some((item) => item.code === candidate.code)) return
      setSelectedCnaes((items) => [...items, {
        ...candidate,
        isPrimary: items.length === 0,
      }])
      setSelectedCode('')
      setError(null)
    }
    const cancel = () => rejectManualRegistration(new Error('manual_registration_cancelled'))
    return (
      <div className="tp-manual-overlay" role="presentation">
        <section className="tp-manual-dialog" role="dialog" aria-modal="true" aria-labelledby="tp-cnae-title">
          <div className="tp-manual-heading">
            <button type="button" aria-label="Fechar seleção de CNAEs" disabled={submitting} onClick={cancel}>×</button>
            <h2 id="tp-cnae-title">Selecionar CNAEs da {isCompany ? 'empresa' : 'unidade'}</h2>
            <p>Escolha as atividades oficiais do IBGE/CONCLA. O primeiro CNAE será principal, mas pode ser alterado.</p>
          </div>
          <form onSubmit={submitCnaes}>
            <label className="tp-manual-wide">
              Pesquisar CNAE oficial
              <input value={cnaeSearch} onChange={(event) => setCnaeSearch(event.target.value)}
                maxLength={80} placeholder="Digite código ou atividade" />
            </label>
            <label className="tp-manual-wide">
              Lista suspensa de CNAEs oficiais
              <select value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}
                disabled={cnaesLoading || !!cnaesError}>
                <option value="">Selecione uma atividade</option>
                {availableCnaes.map((option) =>
                  <option key={option.code} value={option.code}>{option.code} — {option.description}</option>
                )}
              </select>
            </label>
            {cnaesLoading && <p role="status">Consultando catálogo oficial…</p>}
            {cnaesError && <p role="alert">{cnaesError}</p>}
            {!cnaesLoading && !cnaesError && availableCnaes.length === 0 &&
              <p>Nenhum CNAE encontrado. Ajuste a pesquisa.</p>}
            <button type="button" className="launch-secondary-button" disabled={!selectedCode || submitting}
              onClick={addCnae}>Adicionar CNAE selecionado</button>
            <div className="tp-manual-cnae-list" aria-label="CNAEs selecionados">
              {selectedCnaes.map((cnae) => <div key={cnae.code} className="tp-manual-cnae-row">
                <span>{cnae.code} — {cnae.description}{cnae.isPrimary ? ' · Principal' : ''}</span>
                {!cnae.isPrimary && <button type="button" onClick={() => setSelectedCnaes((items) =>
                  items.map((item) => ({ ...item, isPrimary: item.code === cnae.code }))
                )}>Tornar principal</button>}
                <button type="button" onClick={() => setSelectedCnaes((items) => {
                  const remaining = items.filter((item) => item.code !== cnae.code)
                  if (cnae.isPrimary && remaining[0]) remaining[0] = { ...remaining[0], isPrimary: true }
                  return remaining
                })}>Remover</button>
              </div>)}
            </div>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="tp-manual-actions">
              <button type="button" className="launch-secondary-button" disabled={submitting}
                onClick={() => setStep('details')}>Voltar aos dados</button>
              <button type="submit" className="btn" disabled={submitting || !selectedCnaes.length}>
                {submitting ? 'Cadastrando…' : reactivationPending ? 'Confirmar reativação' : 'Concluir cadastro'}
              </button>
            </div>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div
      className="tp-manual-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          rejectManualRegistration(
            new Error('cnpj_provider_unavailable'),
          )
        }
      }}
    >
      <section
        className="tp-manual-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-manual-title"
      >
        <div className="tp-manual-heading">
          <h2 id="tp-manual-title">
            Continuar manualmente
          </h2>
          <p>
            A consulta automática do CNPJ não respondeu. Você pode concluir o cadastro
            agora e atualizar os dados cadastrais por uma nova consulta depois.
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="tp-manual-grid">
            <label>
              CNPJ
              <input
                value={formatCnpj(request.cnpj)}
                readOnly
                aria-readonly="true"
              />
            </label>

            <label>
              Local Negócio
              <input
                value={request.businessLocationCode ?? ''}
                readOnly
                aria-readonly="true"
                placeholder="Não informado"
              />
            </label>

            {isCompany ? (
              <label className="tp-manual-wide">
                Razão social
                <input
                  value={legalName}
                  onChange={(event) =>
                    setLegalName(event.target.value)
                  }
                  required
                  autoFocus
                  maxLength={200}
                />
              </label>
            ) : (
              <label className="tp-manual-wide">
                Nome da unidade
                <input
                  value={establishmentName}
                  onChange={(event) =>
                    setEstablishmentName(event.target.value)
                  }
                  required
                  autoFocus
                  maxLength={200}
                />
              </label>
            )}

            <label>
              UF
              <select
                value={common.uf}
                onChange={(event) =>
                  patchCommon({ uf: event.target.value })
                }
                required
              >
                <option value="">Selecione</option>
                {[
                  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES',
                  'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
                  'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
                  'SP', 'SE', 'TO',
                ].map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Município
              <input
                value={common.municipalityName}
                onChange={(event) =>
                  patchCommon({ municipalityName: event.target.value })
                }
                maxLength={160}
              />
            </label>

            <label>
              CEP
              <input
                value={common.postalCode}
                onChange={(event) =>
                  patchCommon({
                    postalCode: formatCep(event.target.value),
                  })
                }
                inputMode="numeric"
                maxLength={9}
                placeholder="00000-000"
                aria-describedby="tp-manual-cep-help"
              />
              <small id="tp-manual-cep-help">8 dígitos</small>
            </label>

            <label>
              Inscrição Estadual
              <input
                value={common.stateRegistration}
                onChange={(event) =>
                  patchCommon({ stateRegistration: event.target.value })
                }
                maxLength={30}
                placeholder="Opcional"
              />
            </label>

            <label className="tp-manual-wide">
              Logradouro
              <input
                value={common.street}
                onChange={(event) =>
                  patchCommon({ street: event.target.value })
                }
                maxLength={200}
              />
            </label>

            <label>
              Número
              <input
                value={common.streetNumber}
                onChange={(event) =>
                  patchCommon({ streetNumber: event.target.value })
                }
                maxLength={30}
              />
            </label>

            <label>
              Bairro
              <input
                value={common.district}
                onChange={(event) =>
                  patchCommon({ district: event.target.value })
                }
                maxLength={160}
              />
            </label>
          </div>

          <p className="tp-manual-note">
            O CNPJ permanece como identidade cadastral. O Local Negócio é um código
            interno e não será alterado por consultas cadastrais futuras.
          </p>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="tp-manual-actions">
            <button
              type="button"
              className="launch-secondary-button"
              disabled={submitting}
              onClick={() =>
                rejectManualRegistration(
                  new Error('cnpj_provider_unavailable'),
                )
              }
            >
              Cancelar cadastro
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting}
            >
              {submitting
                ? 'Cadastrando…'
                : 'Continuar para CNAEs'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
