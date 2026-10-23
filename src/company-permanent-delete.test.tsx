import { fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DangerConfirmDialog } from './authenticated-product-panel'
import { deleteCompany } from './product-api'

afterEach(cleanup)
describe('ONB-02 R6 permanent company deletion', () => {
  it('requires the full company name, accepts canonical Unicode, and explains irreversibility', () => {
    const confirm = vi.fn()
    render(<DangerConfirmDialog title="Excluir definitivamente?"
      description="Excluir definitivamente. Esta ação não pode ser desfeita."
      confirmLabel="Excluir definitivamente" confirmationText="Empresa Árvore"
      pending={false} onCancel={vi.fn()} onConfirm={confirm} />)
    const button = screen.getByRole('button', { name: 'Excluir definitivamente' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(confirm).not.toHaveBeenCalled()
    const input=screen.getByRole('textbox', {name:'Nome da empresa para confirmar exclusão'})
    fireEvent.change(input,{target:{value:'Empresa'}})
    expect(button).toBeDisabled()
    fireEvent.change(input,{target:{value:'Empresa Errada'}})
    expect(button).toBeDisabled()
    fireEvent.change(input,{target:{value:'Empresa Árvore'.normalize('NFD')}})
    expect(button).toBeEnabled()
    expect(screen.getByText(/Esta ação não pode ser desfeita/)).toBeInTheDocument()
    fireEvent.click(button)
    expect(confirm).toHaveBeenCalledTimes(1)
  })
  it('sends the explicit permanent-delete protocol required by the new backend',async()=>{
    const api=vi.fn(async (_input:RequestInfo | URL,_init?:RequestInit)=>new Response(null,{status:204}))
    await deleteCompany(api,'synthetic-tenant','synthetic-company')
    const headers=new Headers(api.mock.calls[0]?.[1]?.headers)
    expect(headers.get('X-Company-Delete-Intent')).toBe('permanent-v1')
  })
})
