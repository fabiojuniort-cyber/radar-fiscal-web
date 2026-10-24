import { fireEvent, render, screen, cleanup, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CompanySection, DangerConfirmDialog } from './authenticated-product-panel'
import { deleteCompany } from './product-api'

afterEach(cleanup)
describe('ONB-02 R9 permanent company deletion', () => {
  it('confirms without typing a name and allows cancellation', () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    render(<DangerConfirmDialog title="Excluir definitivamente?"
      description="Excluir definitivamente. Esta ação não pode ser desfeita."
      confirmLabel="Excluir" pending={false} onCancel={cancel} onConfirm={confirm} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByText('Excluir definitivamente. Esta ação não pode ser desfeita.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(confirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(confirm).toHaveBeenCalledTimes(1)
  })

  it('blocks confirmation and cancellation while deletion is pending', () => {
    const confirm = vi.fn()
    const cancel = vi.fn()
    render(<DangerConfirmDialog title="Excluir definitivamente?"
      description="Excluir definitivamente. Esta ação não pode ser desfeita."
      confirmLabel="Excluir" pending={true} onCancel={cancel} onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'Excluindo…' })
    expect(button).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(confirm).not.toHaveBeenCalled()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('sends the explicit permanent-delete protocol without a name payload', async () => {
    const api = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
    await deleteCompany(api, 'synthetic-tenant', 'synthetic-company')
    const headers = new Headers(api.mock.calls[0]?.[1]?.headers)
    expect(headers.get('X-Company-Delete-Intent')).toBe('permanent-v1')
    expect(headers.get('X-Tenant-Id')).toBe('synthetic-tenant')
    expect(api.mock.calls[0]?.[1]?.body).toBeUndefined()
  })

  it('opens the real company popup, cancels safely, deletes once, and never requests audit history', async () => {
    const api = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))
    const changed = vi.fn()
    render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
      <CompanySection apiFetch={api} tenantId="synthetic-tenant"
        account={{tenant:{id:'synthetic-tenant',name:'Synthetic',slug:'synthetic',status:'ACTIVE'},onboarding:null,
          companies:[{id:'synthetic-company',legalName:'Synthetic company',tradeName:null,cnpj:'11222333000181',
            isActive:true,establishmentCount:1,businessLocationCode:null}]}}
        selectedCompanyId="synthetic-company" onSelect={vi.fn()} onOpenEstablishments={vi.fn()}
        onOpenProfile={vi.fn()} onChanged={changed} />
    </QueryClientProvider>)
    expect(screen.queryByRole('region', { name: 'Histórico de auditoria' })).not.toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir empresa' }))
    const dialog = screen.getByRole('dialog', { name: 'Excluir definitivamente?' })
    expect(within(dialog).getByText('Excluir definitivamente. Esta ação não pode ser desfeita.')).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Excluir empresa' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api).toHaveBeenCalledTimes(1)
    expect(api.mock.calls[0]?.[0]).toBe('/api/v1/companies/synthetic-company')
    expect(api.mock.calls[0]?.[1]?.method).toBe('DELETE')
    expect(new Headers(api.mock.calls[0]?.[1]?.headers).get('X-Company-Delete-Intent')).toBe('permanent-v1')
    expect(api.mock.calls.some(([url]) => String(url).includes('company-audit-history'))).toBe(false)
  })
})
