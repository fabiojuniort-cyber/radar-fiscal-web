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

  useEffect(() => {
    if (!pending) return

    setLegalName('')
    setEstablishmentName('')
    setCommon(EMPTY_COMMON)
    setSubmitting(false)
    setError(null)
  }, [pending])

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

    setSubmitting(true)

    try {
      let result: unknown
      const postalCode = postalDigits || undefined

      if (request.kind === 'company') {
        const input: ManualCompanyForm = {
          legalName: legalName.trim(),
          uf: common.uf,
          municipalityName: optional(common.municipalityName),
          postalCode,
          street: optional(common.street),
          streetNumber: optional(common.streetNumber),
          district: optional(common.district),
          stateRegistration: optional(common.stateRegistration),
        }
        result = await request.submit(input)
      } else {
        const input: ManualEstablishmentForm = {
          name: establishmentName.trim(),
          uf: common.uf,
          municipalityName: optional(common.municipalityName),
          postalCode,
          street: optional(common.street),
          streetNumber: optional(common.streetNumber),
          district: optional(common.district),
          stateRegistration: optional(common.stateRegistration),
        }
        result = await request.submit(input)
      }

      resolveManualRegistration(result)
    } catch (cause) {
      const code =
        cause instanceof Error
          ? cause.message
          : 'manual_registration_failed'

      if (code === 'business_location_code_exists') {
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
                : 'Cadastrar empresa'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
