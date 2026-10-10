import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CollectionFilterAdminPage } from './collection-filter-admin'
import type { ProductApiFetch } from './product-api'

afterEach(() => cleanup())
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})
const currentId = '11111111-1111-4111-8111-111111111111'
const typeId = '22222222-2222-4222-8222-222222222222'
const state = {
  policies: [{ id: currentId, version: 1, revision: 2, status: 'APPROVED' }],
  documents: { [currentId]: {
    id:currentId,version:1,revision:2,status:'APPROVED',
    rules:[{sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'KEEP_ALWAYS',helpText:null}],
    terms:[{text:'ICMS',strength:'STRONG'}],aliases:[],
  } },
  newTypesOpen:1,
}
const newTypes = {items:[{
  id:typeId,source_code:'dou',section:'DO1',
  normalized_type:'EXTRATO DE CONTRATO',sample_raw_type:'Extrato de contrato',
  occurrence_count:7,first_seen_at:'2026-10-10T00:00:00Z',
  last_seen_at:'2026-10-10T00:00:00Z',examples:[],
}]}

function mount(apiFetch:ProductApiFetch) {
  const client = new QueryClient({ defaultOptions:{queries:{retry:false}} })
  render(<QueryClientProvider client={client}><MemoryRouter>
    <CollectionFilterAdminPage apiFetch={apiFetch}/>
  </MemoryRouter></QueryClientProvider>)
}

describe('L-11 filtro direto DOU',()=>{
  it('mostra contagem nova e exige nova confirmação antes de aplicar',async()=>{
    let confirmations=0
    const calls:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
      const path=String(input)
      calls.push(path)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview'))return json({
        count:2,blockedCompany:1,token:'a'.repeat(64),
      })
      if(path.endsWith('/direct-rule/confirm'))return json(
        ++confirmations===1
          ? {changed:true,count:3,blockedCompany:1,token:'b'.repeat(64),deletedCount:0}
          : {changed:false,deletedCount:3,revision:3},
      )
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/2 publicações serão apagadas/)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await screen.findByText(/3 publicações serão apagadas/)
    expect(screen.getByRole('alert')).toHaveTextContent('A quantidade mudou para 3')
    expect(confirmations).toBe(1)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await waitFor(()=>expect(confirmations).toBe(2))
    expect(calls.some(path=>path.includes('/simulations'))).toBe(false)
    expect(screen.queryByRole('button',{name:'Salvar rascunho'})).not.toBeInTheDocument()
  })
  it('a edição de Modo em Tipos abre prévia, sem salvar rascunho',async()=>{
    const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json({items:[]})
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    const select=await screen.findByRole('combobox',{name:'Modo PORTARIA'})
    fireEvent.change(select,{target:{value:'EXCLUDE_UNLESS_STRONG'}})
    expect(await screen.findByText('Classificar tipo de publicação')).toBeInTheDocument()
    expect(screen.queryByText('Simulações')).not.toBeInTheDocument()
  })
  it('não consulta filtros protegidos quando usuário não é PLATFORM_ADMIN',async()=>{
    const paths:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
      paths.push(String(input))
      return json({platformAdmin:false})
    }) as ProductApiFetch
    mount(apiFetch)
    await screen.findByText('Acesso restrito')
    expect(paths.some(path=>path.includes('/collection-filter/'))).toBe(false)
  })
})
