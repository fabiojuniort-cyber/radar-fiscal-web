import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileArchive, FileCheck2, Save, ShieldAlert } from 'lucide-react'
import type { ProductApiFetch } from './product-api'
import { PlatformAdminApiError } from './platform-admin-api'
import {
  DOU_LIMIT_CEILINGS, fetchDouDownloadLimits, updateDouDownloadLimits,
  validateDouLimits, type DouDownloadLimits,
} from './dou-download-limits-api'

const FIELDS: { key: keyof DouDownloadLimits; label: string; description: string }[] = [
  { key: 'pdfMiB', label: 'PDF oficial (MiB)', description: 'Evidência complementar, não exigida na coleta XML.' },
  { key: 'zipMiB', label: 'Arquivo ZIP INLABS (MiB)', description: 'Limite por pacote ZIP baixado.' },
  { key: 'expandedZipMiB', label: 'ZIP descompactado (MiB)', description: 'Proteção contra expansão exagerada (ZIP bombs).' },
  { key: 'xmlEntryMiB', label: 'XML individual (MiB)', description: 'Limite de cada XML dentro do ZIP.' },
]

function errorText(error: unknown): string {
  if (error instanceof PlatformAdminApiError) {
    if (error.code === 'dou_limits_store_not_ready')
      return 'A gravação aguarda a liberação segura no banco de dados.'
    if (error.code === 'platform_admin_required')
      return 'Somente administradores globais podem alterar estes valores.'
    if (error.code === 'invalid_dou_limits') return 'Confira os limites informados.'
  }
  return error instanceof Error ? error.message : 'Não foi possível salvar.'
}

export function DouDownloadLimitsCard({ apiFetch }: { apiFetch: ProductApiFetch }) {
  const client = useQueryClient()
  const settings = useQuery({
    queryKey: ['platform', 'dou-download-limits'],
    queryFn: () => fetchDouDownloadLimits(apiFetch),
    retry: false,
  })
  const [values, setValues] = useState<DouDownloadLimits | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings.data) setValues(settings.data.limits)
  }, [settings.data])

  const save = useMutation({
    mutationFn: (next: DouDownloadLimits) => updateDouDownloadLimits(apiFetch, next),
    onSuccess: async () => {
      setSaved(true)
      await client.invalidateQueries({ queryKey: ['platform', 'dou-download-limits'] })
    },
  })

  const validationError = values ? validateDouLimits(values) : null
  const changed = Boolean(values && settings.data && FIELDS.some(field =>
    values[field.key] !== settings.data.limits[field.key]))

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaved(false)
    if (values && !validationError && changed && settings.data?.editable) save.mutate(values)
  }

  return (
    <section className="pa-card pa-limits" aria-label="Limites de arquivos do DOU">
      <div className="pa-card-heading">
        <div>
          <h2>Limites de arquivos do DOU</h2>
          <p>Configuração global do INLABS. Valores em MiB (1 MiB = 1.048.576 bytes).</p>
        </div>
      </div>
      {settings.isPending ? (
        <p className="pa-muted">Carregando limites de coleta…</p>
      ) : settings.isError ? (
        <p className="pa-error" role="alert">Não foi possível carregar os limites do DOU.</p>
      ) : values ? (
        <form className="pa-limit-form" onSubmit={submit}>
          <div className="pa-limit-status">
            <ShieldAlert size={18} aria-hidden="true" />
            <p>{settings.data.limitsNotice}</p>
          </div>
          <div className="pa-limit-grid">
            {FIELDS.map(field => (
              <label className="pa-limit-field" key={field.key}>
                <span className="pa-limit-label">
                  {field.key === 'pdfMiB' ? <FileCheck2 size={17} /> : <FileArchive size={17} />}
                  {field.label}
                </span>
                <input type="number" inputMode="numeric" min={1}
                  max={DOU_LIMIT_CEILINGS[field.key]} step={1}
                  disabled={!settings.data.editable || save.isPending}
                  value={values[field.key]}
                  onChange={event => {
                    setSaved(false)
                    setValues(current => current ? {
                      ...current,
                      [field.key]: event.target.value === '' ? 0 : Number(event.target.value),
                    } : current)
                  }}
                />
                <small>{field.description} Máximo homologado: {DOU_LIMIT_CEILINGS[field.key]} MiB.</small>
              </label>
            ))}
          </div>
          <p className="pa-muted">
            Ultrapassar esses limites exige novos testes de capacidade e segurança.
            Arquivo rejeitado gera falha de coleta, não “nenhuma publicação”.
          </p>
          {validationError && <p className="pa-error" role="alert">{validationError}</p>}
          {save.isError && <p className="pa-error" role="alert">{errorText(save.error)}</p>}
          {saved && <p className="pa-limit-success" role="status">Limites salvos para as próximas execuções.</p>}
          <div className="pa-limit-actions">
            <button type="button" disabled={!changed || save.isPending} onClick={() => {
              if (settings.data) setValues(settings.data.limits)
              setSaved(false)
            }}>Descartar alterações</button>
            <button type="submit" disabled={!settings.data.editable || !changed || Boolean(validationError) || save.isPending}>
              <Save size={16} aria-hidden="true" />
              {save.isPending ? 'Salvando…' : 'Salvar limites'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
