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
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/2 publicações serão apagadas/)
    expect(screen.getByText(/1 protegidas \(não serão apagadas\)/)).toBeInTheDocument()
    expect(screen.getByText(/1 com vínculo a empresa cliente/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await screen.findByText(/3 publicações serão apagadas/)
    expect(screen.getByRole('alert')).toHaveTextContent('A quantidade mudou para 3')
    expect(confirmations).toBe(1)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await waitFor(()=>expect(confirmations).toBe(2))
    expect(calls.some(path=>path.includes('/simulations'))).toBe(false)
    expect(screen.queryByRole('button',{name:'Salvar rascunho'})).not.toBeInTheDocument()
  })
  it('faz 3 etapas de até 500 e exibe progresso sem repetir regras',async()=>{
    const results=[
      {changed:false,apagadas:500,restantes:700,deletedCount:500,revision:3},
      {changed:false,apagadas:500,restantes:200,deletedCount:500,revision:3},
      {changed:false,apagadas:200,restantes:0,deletedCount:200,revision:3},
    ]
    const requests:Array<{resume?:boolean;expectedCount:number}>=[]
    let previewCalls=0
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview'))return json({
        count:[1200,700,200][previewCalls++] ?? 0,
        blockedCompany:1,blockedOtherSource:1,token:'a'.repeat(64),
      })
      if(path.endsWith('/direct-rule/confirm')){
        requests.push(JSON.parse(String(init?.body)))
        return json(results[requests.length-1])
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/1200 publicações serão apagadas/)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await waitFor(()=>expect(requests).toHaveLength(3))
    expect(requests.map(v=>v.expectedCount)).toEqual([1200,700,200])
    expect(requests.map(v=>v.resume)).toEqual([false,true,true])
  })

  it('mostra etapa e HTTP real após falha, sem retry, e continua após nova contagem',async()=>{
    const seen:number[]=[]
    let previewCalls=0
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview'))return json({
        count:[1100,600,600,100][previewCalls++] ?? 0,
        blockedCompany:1,blockedOtherSource:0,token:'b'.repeat(64),
      })
      if(path.endsWith('/direct-rule/confirm')){
        const body=JSON.parse(String(init?.body)) as {expectedCount:number}
        seen.push(body.expectedCount)
        if(seen.length===2)return json({error:'stage_unavailable'},503)
        return json(seen.length===1
          ? {changed:false,apagadas:500,restantes:600,deletedCount:500,revision:3}
          : seen.length===3
            ? {changed:false,apagadas:500,restantes:100,deletedCount:500,revision:3}
            : {changed:false,apagadas:100,restantes:0,deletedCount:100,revision:3})
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/1100 publicações serão apagadas/)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await screen.findByRole('button',{name:'Continuar'})
    expect(screen.getByRole('alert')).toHaveTextContent('Etapa 2: HTTP 503')
    expect(seen).toHaveLength(2)
    expect(screen.getByText(/500 de 1.100 apagadas/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Continuar'}))
    await waitFor(()=>expect(seen).toHaveLength(4))
    expect(seen).toEqual([1100,600,600,100])
  })

  it('reconcilia resposta perdida pelo novo restante sem repetir automaticamente',async()=>{
    let previewCount=0
    const confirms:Array<{expectedCount:number;resume?:boolean}>=[]
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview')){
        previewCount++
        if(previewCount===3)return json({error:'preview_failed'},503)
        return json({count:previewCount===1?1000:500,blockedCompany:0,
          blockedOtherSource:0,token:'d'.repeat(64)})
      }
      if(path.endsWith('/direct-rule/confirm')){
        confirms.push(JSON.parse(String(init?.body)))
        if(confirms.length===1)throw new TypeError('resposta perdida após commit')
        return json({changed:false,apagadas:100,restantes:400,deletedCount:100,revision:3})
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/1000 publicações serão apagadas/)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await screen.findByRole('button',{name:'Continuar'})
    expect(confirms).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:'Continuar'}))
    await waitFor(()=>expect(confirms).toHaveLength(2))
    expect(confirms.map(x=>x.expectedCount)).toEqual([1000,500])
    expect(confirms.map(x=>x.resume)).toEqual([false,true])
    expect((await screen.findByText(/600 de 1.000 apagadas/)).textContent).toBe('600 de 1.000 apagadas')
  })

  it('atualiza total ao divergir a contagem entre etapas, sem perder acumulado',async()=>{
    const confirms:Array<{expectedCount:number}>=[]
    let previews=0
    const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
      const path=String(input)
      if(path.includes('/admin/me'))return json({platformAdmin:true})
      if(path.endsWith('/state'))return json(state)
      if(path.includes('/new-types'))return json(newTypes)
      if(path.endsWith('/direct-rule/preview')){
        previews++
        if(previews===4)return json({error:'preview_unavailable'},503)
        return json({count:previews===1?800:340,blockedCompany:0,
          blockedOtherSource:0,token:'e'.repeat(64)})
      }
      if(path.endsWith('/direct-rule/confirm')){
        confirms.push(JSON.parse(String(init?.body)))
        return json(confirms.length===1
          ? {changed:false,apagadas:500,restantes:300,deletedCount:500,revision:3}
          : {changed:false,apagadas:200,restantes:140,deletedCount:200,revision:3})
      }
      return json({items:[]})
    }) as ProductApiFetch
    mount(apiFetch)
    fireEvent.click(await screen.findByRole('button',{name:/Novos tipos/}))
    fireEvent.click(await screen.findByRole('button',{name:'Classificar'}))
    fireEvent.click(await screen.findByRole('button',{name:'Confirmar classificação'}))
    fireEvent.change(screen.getByLabelText('Modo'),{target:{value:'EXCLUDE_ALWAYS'}})
    fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
    await screen.findByText(/800 publicações serão apagadas/)
    fireEvent.click(screen.getByRole('button',{name:'Confirmar classificação e exclusão'}))
    await screen.findByRole('button',{name:'Continuar'})
    expect(screen.getByRole('alert')).toHaveTextContent('a contagem passou de 300 para 340')
    expect(screen.getByText(/500 de 840 apagadas/)).toBeInTheDocument()
    expect(confirms).toHaveLength(1)
    fireEvent.click(screen.getByRole('button',{name:'Continuar'}))
    await waitFor(()=>expect(confirms).toHaveLength(2))
    expect(confirms.map(x=>x.expectedCount)).toEqual([800,340])
    expect(await screen.findByText(/700 de 840 apagadas/)).toBeInTheDocument()
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
  expect(screen.getByRole('button',{name:'Consultar quantidade'})).toBeDisabled()
  fireEvent.change(mode,{target:{value:'EXCLUDE_ALWAYS'}})
  expect(screen.getByRole('button',{name:'Consultar quantidade'})).not.toBeDisabled()
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
