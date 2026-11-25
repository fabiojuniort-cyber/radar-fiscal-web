import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DouDownloadLimitsCard } from './dou-download-limits-card'
import type { ProductApiFetch } from './product-api'
import { validateDouLimits } from './dou-download-limits-api'

afterEach(cleanup)
const limits = { pdfMiB: 20, zipMiB: 64, expandedZipMiB: 128, xmlEntryMiB: 8 }
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json' },
})
function mount(apiFetch: ProductApiFetch) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <DouDownloadLimitsCard apiFetch={apiFetch} />
    </QueryClientProvider>,
  )
}

describe('Limites DOU em Administradores', () => {
  it('mostra limites seguros e impede alteração antes do gate do banco', async () => {
    const api = vi.fn(async () => response({
      limits, editable: false, configured: false, updatedAt: null,
      limitsNotice: 'Gravação depende de autorização independente.',
    })) as unknown as ProductApiFetch
    mount(api)
    expect(await screen.findByText('Limites de arquivos do DOU')).toBeInTheDocument()
    expect(((await screen.findByLabelText(/Arquivo ZIP INLABS/)) as HTMLInputElement).value).toBe('64')
    expect(screen.getByRole('button', { name: 'Salvar limites' })).toBeDisabled()
    expect(api).toHaveBeenCalledTimes(1)
  })

  it('salva somente valores válidos e preserva limite independente do PDF', async () => {
    let saved = { ...limits }
    const api = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') saved = JSON.parse(String(init.body))
      return response({
        limits: saved, editable: true, configured: true,
        updatedAt: '2026-10-10T12:00:00Z',
        limitsNotice: 'Evidência PDF continua seletiva.',
      })
    }) as unknown as ProductApiFetch

    mount(api)
    await screen.findByLabelText(/Arquivo ZIP INLABS/)
    fireEvent.change(screen.getByLabelText(/Arquivo ZIP INLABS/), {
      target: { value: '32' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }))
    await waitFor(() => expect(saved.zipMiB).toBe(32))
    expect(saved.pdfMiB).toBe(20)
    expect(await screen.findByText('Limites salvos para as próximas execuções.')).toBeInTheDocument()
  })

  it('valida teto e evita números fracionários/expansão menor que ZIP', () => {
    expect(validateDouLimits({ ...limits, zipMiB: 65 })).toBeTruthy()
    expect(validateDouLimits({ ...limits, zipMiB: 64, expandedZipMiB: 32 })).toBeTruthy()
    expect(validateDouLimits({ ...limits, pdfMiB: 1.5 })).toBeTruthy()
    expect(validateDouLimits({ ...limits, zipMiB: 32 })).toBeNull()
  })

  it.each([
    [503, { error: 'dou_limits_store_not_ready', detail: 'marker-internal-gateway' }, 'A gravação está indisponível no momento. Tente novamente mais tarde.'],
    [500, { error: 'marker-internal-rejection' }, 'Não foi possível confirmar a gravação dos limites. Tente novamente.'],
    [200, { limits, editable: true, configured: false, updatedAt: null, limitsNotice: 'Valores de referência.' }, 'Não foi possível confirmar a gravação dos limites. Tente novamente.'],
  ])('exibe falha segura de gravação com HTTP %s sem confirmação falsa', async (status, body, message) => {
    const api = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => init?.method === 'PUT'
      ? response(body, status)
      : response({ limits, editable: true, configured: false, updatedAt: null, limitsNotice: 'Valores de referência.' }),
    ) as unknown as ProductApiFetch

    mount(api)
    fireEvent.change(await screen.findByLabelText(/Arquivo ZIP INLABS/), { target: { value: '32' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar limites' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.queryByText(/marker-internal/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Limites salvos/)).not.toBeInTheDocument()
  })
})
