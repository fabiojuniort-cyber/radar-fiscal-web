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
  it('mostra prévia F3 e salva regra sem excluir, uma única chamada safe-save',async()=>{
    const calls:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input);calls.push(path)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview'))return json({
        count:12,blockedCompany:1,blockedOtherSource:2,
        token:'a'.repeat(64),confirmationToken:'b'.repeat(64),policyRevision:2,
        samples:[{id:'item-1',title:'Extrato de contrato',sourceCode:'dou',
          section:'DO3',officialType:'EXTRATO DE CONTRATO',pattern:'EXTRATO DE TERMO ADITIVO',protection:null}],
      })
      if(path.endsWith('/direct-rule/save')){
        const payload=JSON.parse(String(init?.body)) as {confirmationToken:string;policyRevision:number}
        expect(payload.confirmationToken).toBe('b'.repeat(64))
        expect(payload.policyRevision).toBe(2)
        return json({revision:3,deletedCount:0,historicalPurgeRequired:true})
      }
      throw new Error('Unsafe/unexpected API path '+path)
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'KEEP_IF_TAX_TERM'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar prévia F3'}))
    await screen.findByText(/12 publicações históricas correspondem à regra/)
    expect(screen.getByText(/Nenhuma publicação será apagada ao salvar/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Salvar classificação sem excluir'}))
    await waitFor(()=>expect(calls.some(v=>v.endsWith('/direct-rule/save'))).toBe(true))
    expect(calls.some(v=>v.endsWith('/direct-rule/confirm'))).toBe(false)
  })

  it('sem token F3 no backend antigo não oferece botão salvar',async()=>{
    const paths:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
      const path=String(input);paths.push(path)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview'))return json({
        count:13,blockedCompany:0,blockedOtherSource:0,token:'a'.repeat(64),
      })
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar prévia F3'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(/prévia F3 segura/)
    expect(paths.some(p=>p.endsWith('/direct-rule/save')||p.endsWith('/direct-rule/confirm'))).toBe(false)
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
  it('excluir uma regra usa edição direta, sem purgar publicações',async()=>{
    const actions:string[]=[]
    const paths:string[]=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      paths.push(path)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-admin-edit')) {
        const data=JSON.parse(String(init?.body)) as {action:string}
        actions.push(data.action)
        return json({revision:3})
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:'Remover PORTARIA'}))
    await waitFor(()=>expect(actions).toEqual(['RULE_DELETE']))
    expect(paths.some(path=>path.includes('direct-rule/confirm'))).toBe(false)
  })

  it('cadastrar termo grava diretamente na política aprovada',async()=>{
    const payloads:Array<{action:string;payload:{term:{normalizedTerm:string}}}>=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-admin-edit')) {
        payloads.push(JSON.parse(String(init?.body)))
        return json({revision:3})
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:'Termos'}))
    fireEvent.change(await screen.findByRole('textbox',{name:'Texto do termo'}),{
      target:{value:'Crédito presumido'},
    })
    fireEvent.click(screen.getByRole('button',{name:'Adicionar'}))
    await waitFor(()=>expect(payloads).toHaveLength(1))
    expect(payloads[0]?.action).toBe('TERM_PUT')
    expect(payloads[0]?.payload.term.normalizedTerm).toBe('CREDITO PRESUMIDO')
  })

})


it('L-11: modo em branco exige seleção após classificar novo tipo',async()=>{
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    const path=String(input)
    if(path.includes('/admin/me'))return json({platformAdmin:true})
    if(path.endsWith('/state'))return json(state)
    if(path.includes('/new-types'))return json(newTypes)
    return json({items:[]})
  }) as ProductApiFetch
  mount(apiFetch)
  fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
  fireEvent.click(screen.getByRole('button',{name:'Classificar'}))
  fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação'}))
  const mode=screen.getByLabelText('Modo') as HTMLSelectElement
  expect(mode.value).toBe('')
  expect(screen.getByRole('option',{name:'Selecione o modo'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Consultar prévia F3'})).toBeDisabled()
  fireEvent.change(mode,{target:{value:'EXCLUDE_ALWAYS'}})
  expect(screen.getByRole('button',{name:'Consultar prévia F3'})).not.toBeDisabled()
})

describe('L-15 new scoped purge button',()=>{
  it('adds exactly one out-of-scope button and previews without deleting',async()=>{
    let confirmed=0
    const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
      const url=String(input)
      if(url.includes('/admin/me'))return json({platformAdmin:true})
      if(url.endsWith('/state'))return json(state)
      if(url.includes('/new-types'))return json(newTypes)
      if(url.endsWith('/out-of-scope/preview'))return json({
        count:23000,outOfScope:0,hiddenLegacy:23000,
        blockedCompany:2,blockedOtherSource:3,token:'a'.repeat(64),
      })
      if(url.endsWith('/out-of-scope/confirm')){confirmed++;return json({
        changed:false,apagadas:500,restantes:22500,deletedCount:500,
      })}
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    const button=await screen.findByRole('button',{name:'Apagar fora do escopo'})
    expect(screen.getAllByRole('button',{name:'Apagar fora do escopo'})).toHaveLength(1)
    fireEvent.click(button)
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    expect(await screen.findByText('0 fora do escopo + 0 pelas regras + 23.000 ocultas pela regra antiga + 0 tipo provavelmente errado / 5 protegidas')).toBeInTheDocument()
    expect(confirmed).toBe(0)
  })
})

