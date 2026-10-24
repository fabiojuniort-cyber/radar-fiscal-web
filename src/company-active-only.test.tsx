import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { CompanySection } from './authenticated-product-panel'
import { ManualRegistrationHost } from './manual-registration-host'
import { rejectManualRegistration, requestManualRegistration } from './manual-registration-bridge'

const message = 'Este CNPJ está bloqueado por um cadastro antigo. Contate o suporte.'
afterEach(() => { cleanup(); rejectManualRegistration() })

it('shows support guidance for a legacy company conflict without retrying or deleting', async () => {
  const api = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(
    JSON.stringify({ error: 'company_inactive_requires_deletion' }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  ))
  const changed = vi.fn()
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}>
    <CompanySection apiFetch={api} tenantId="synthetic-tenant"
      account={{tenant:{id:'synthetic-tenant',name:'Synthetic',slug:'synthetic',status:'ACTIVE'},onboarding:null,companies:[]}}
      selectedCompanyId="" onSelect={vi.fn()} onOpenEstablishments={vi.fn()}
      onOpenProfile={vi.fn()} onChanged={changed} />
  </QueryClientProvider>)
  fireEvent.change(screen.getByLabelText('CNPJ da matriz'), { target: { value: '11222333000181' } })
  fireEvent.click(screen.getByRole('button', { name: 'Consultar CNPJ e cadastrar' }))
  expect(await screen.findByText(message)).toBeInTheDocument()
  expect(api.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1)
  expect(api.mock.calls.some((call) => call[1]?.method === 'DELETE')).toBe(false)
  expect(changed).not.toHaveBeenCalled()
})

it('shows the same support guidance after a rejected manual company registration', async () => {
  const submit = vi.fn(async () => { throw new Error('company_inactive_requires_deletion') })
  let pending: Promise<unknown>
  await act(async () => {
    pending = requestManualRegistration({kind:'company',cnpj:'11222333000181',submit,
      searchCnaes:async()=>[{code:'6201501',description:'Synthetic CNAE'}]})
    void pending.catch(() => {})
  })
  render(<ManualRegistrationHost />)
  fireEvent.change(screen.getByLabelText('Razão social'),{target:{value:'Synthetic company'}})
  fireEvent.change(screen.getByLabelText('UF'),{target:{value:'GO'}})
  fireEvent.click(screen.getByRole('button',{name:'Continuar para CNAEs'}))
  await screen.findByRole('option',{name:'6201501 — Synthetic CNAE'})
  fireEvent.change(screen.getByLabelText('Lista suspensa de CNAEs oficiais'),{target:{value:'6201501'}})
  fireEvent.click(screen.getByRole('button',{name:'Adicionar CNAE selecionado'}))
  fireEvent.click(screen.getByRole('button',{name:'Concluir cadastro'}))
  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(submit).toHaveBeenCalledTimes(1)
})
