import { useEffect, useState } from 'react'
import type { Establishment, ProductApiFetch } from './product-api'
import { fetchEstablishments } from './product-api'

type SavedIe = { establishmentId: string; stateRegistration: string | null; stateRegistrationSource: string | null }
export function OnboardingIeEditor({apiFetch, tenantId, companyId, unit, locked, onBusy, onDirty, onSaved}: {
  apiFetch: ProductApiFetch; tenantId: string; companyId: string; unit: Establishment; locked: boolean
  onBusy: (busy: boolean) => void; onDirty: (id: string, dirty: boolean) => void; onSaved: () => void
}) {
  const [baseline, setBaseline] = useState(unit.stateRegistration)
  const [value, setValue] = useState(unit.stateRegistration ?? '')
  const [source, setSource] = useState(unit.stateRegistrationSource)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false)
  const normalized = value.trim() || null
  const dirty = normalized !== baseline
  useEffect(() => { onDirty(unit.id, dirty) }, [unit.id, dirty, onDirty])
  const save = async () => {
    setBusy(true); onBusy(true); setError(''); setSaved(false)
    try {
      const response = await apiFetch('/api/v1/companies/' + companyId + '/establishments/' + unit.id + '/state-registration', {
        method: 'PATCH',
        headers: { 'X-Tenant-Id': tenantId, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ expectedStateRegistration: baseline, stateRegistration: normalized }),
      })
      const result = await response.json() as SavedIe & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'save_failed')
      if (result.establishmentId !== unit.id) throw new Error('unexpected_unit')
      setBaseline(result.stateRegistration); setValue(result.stateRegistration ?? '')
      setSource(result.stateRegistrationSource); setSaved(true); onDirty(unit.id, false); onSaved()
    } catch (e) {
      setError(e instanceof Error && e.message === 'state_registration_conflict'
        ? 'A IE mudou em outra tela. Recarregue a IE antes de tentar novamente.'
        : 'Não foi possível salvar a IE. Sua edição foi mantida.')
    } finally { setBusy(false); onBusy(false) }
  }
  const reload = async () => {
    setBusy(true); onBusy(true); setError(''); setSaved(false)
    try {
      const current = (await fetchEstablishments(apiFetch, tenantId, companyId)).find(item => item.id === unit.id)
      if (!current) throw new Error('unit_not_found')
      setBaseline(current.stateRegistration); setValue(current.stateRegistration ?? '')
      setSource(current.stateRegistrationSource); onDirty(unit.id, false)
    } catch { setError('Não foi possível recarregar a IE. Sua edição foi mantida.') }
    finally { setBusy(false); onBusy(false) }
  }
  return <fieldset disabled={busy || locked}>
    <legend>{unit.name} — {unit.uf}</legend>
    <label>Inscrição Estadual — {unit.name}
      <input aria-label={'Inscrição Estadual — ' + unit.name} maxLength={30} value={value}
        onChange={event => { setValue(event.target.value); setSaved(false) }} />
    </label>
    <p>Fonte: {source ?? 'Não informada'}. A edição salva será identificada como manual.</p>
    <button type="button" disabled={!dirty || busy} onClick={() => void save()}>{busy ? 'Salvando IE…' : 'Salvar IE'}</button>
    {dirty && <button type="button" onClick={() => {setValue(baseline ?? ''); setError(''); setSaved(false)}}>Descartar edição da IE</button>}
    {saved && <p role="status">IE salva para {unit.name}.</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => void reload()}>Recarregar IE</button></p>}
  </fieldset>
}
