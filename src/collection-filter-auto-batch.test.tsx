import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CollectionFilterDirectDialog } from './collection-filter-direct-dialog'
import { CollectionFilterScopePurgeDialog } from './collection-filter-scope-purge-dialog'
import type { ProductApiFetch } from './product-api'

afterEach(() => cleanup())

function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })
}
function pendingResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>(done => { resolve=done })
  return {promise,resolve}
}
const preview = (count:number, token:string) => ({
  count, token, outOfScope:count, ruleDiscards:0, hiddenLegacy:0,
  blockedCompany:1, blockedOtherSource:2, byRule:[],
})
const rule = {sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'EXCLUDE_ALWAYS' as const}

it('F3 archive preview uses one total and shows samples by type without confirming',async()=>{
  const apiFetch=vi.fn(async()=>json({
    count:60,token:'a'.repeat(64),ruleDiscards:60,
    blockedCompany:2,blockedOtherSource:3,
    byRule:[{sourceCode:'dou',section:'DO3',canonicalType:'EXTRATO',mode:'EXCLUDE_ALWAYS',count:60}],
    samples:[{id:'sample',title:'EXTRATO DE CONTRATO 33/2026',sourceCode:'dou',section:'DO3',canonicalType:'EXTRATO'}],
  })) as ProductApiFetch
  render(<CollectionFilterScopePurgeDialog apiFetch={apiFetch}
    onClose={vi.fn()} onApplied={vi.fn(async()=>{})}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
  expect(await screen.findByText('60 não passam no filtro atual / 5 protegidas')).toBeInTheDocument()
  expect(screen.getByText('EXTRATO: EXTRATO DE CONTRATO 33/2026')).toBeInTheDocument()
  expect(screen.queryByText(/regra antiga|provavelmente errado/)).not.toBeInTheDocument()
  expect(apiFetch).toHaveBeenCalledTimes(1)
})

it('L17 auto: three separate 500-bounded requests finish the scope purge without another click',async()=>{
  const previews=[1050,550,50]
  const results=[{apagadas:500,restantes:550},{apagadas:500,restantes:50},
    {apagadas:50,restantes:0}]
  const confirmations:Array<{expectedCount:number;previewToken:string}>=[]
  const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input)
    if(path.endsWith('/out-of-scope/preview')){
      const index=3-previews.length
      const count=previews.shift()!
      return json(preview(count,'token-'+index))
    }
    if(path.endsWith('/out-of-scope/confirm')){
      confirmations.push(JSON.parse(String(init?.body)))
      return json({changed:false,...results.shift()})
    }
    throw new Error('unexpected: '+path)
  }) as ProductApiFetch
  const onClose=vi.fn(), onApplied=vi.fn(async()=>{})
  render(<CollectionFilterScopePurgeDialog apiFetch={apiFetch} onClose={onClose} onApplied={onApplied}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
  await screen.findByText(/1.050 não passam no filtro atual/)
  fireEvent.click(screen.getByRole('button',{name:'Confirmar exclusão'}))
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(confirmations.map(c=>c.expectedCount)).toEqual([1050,550,50])
  expect(confirmations.map(c=>c.previewToken)).toEqual(['token-0','token-1','token-2'])
})

it('L17 pause: completes only the in-flight batch and resumes from a fresh preview',async()=>{
  const pending=pendingResponse()
  let previews=0,confirms=0
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    const path=String(input)
    if(path.endsWith('/out-of-scope/preview'))return json(preview(++previews===1?650:150,'token-'+previews))
    if(path.endsWith('/out-of-scope/confirm')){
      confirms++
      return confirms===1?pending.promise:json({changed:false,apagadas:150,restantes:0})
    }
    throw new Error('unexpected: '+path)
  }) as ProductApiFetch
  const onClose=vi.fn(),onApplied=vi.fn(async()=>{})
  render(<CollectionFilterScopePurgeDialog apiFetch={apiFetch} onClose={onClose} onApplied={onApplied}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
  await screen.findByText(/650 não passam no filtro atual/)
  fireEvent.click(screen.getByRole('button',{name:'Confirmar exclusão'}))
  await waitFor(()=>expect(confirms).toBe(1))
  fireEvent.click(screen.getByRole('button',{name:'Pausar'}))
  pending.resolve(json({changed:false,apagadas:500,restantes:150}))
  await screen.findByRole('button',{name:'Continuar'})
  expect(screen.getByText(/500 de 650 apagadas/)).toBeInTheDocument()
  expect(confirms).toBe(1)
  expect(previews).toBe(1)
  fireEvent.click(screen.getByRole('button',{name:'Continuar'}))
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(previews).toBe(2)
  expect(confirms).toBe(2)
})

it('L17 HTTP error: reports stage and status; only Continue may restart after re-preview',async()=>{
  const counts=[800,800,300]
  const confirmations:number[]=[]
  const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input)
    if(path.endsWith('/out-of-scope/preview'))return json(preview(counts.shift()!,'fresh'))
    if(path.endsWith('/out-of-scope/confirm')){
      confirmations.push(JSON.parse(String(init?.body)).expectedCount)
      if(confirmations.length===1)return json({error:'l17_rule_cap'},503)
      return json({changed:false,apagadas:confirmations.length===2?500:300,
        restantes:confirmations.length===2?300:0})
    }
    throw new Error('unexpected: '+path)
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{})
  render(<CollectionFilterScopePurgeDialog apiFetch={apiFetch} onClose={vi.fn()} onApplied={onApplied}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar quantidade'}))
  await screen.findByText(/800 não passam no filtro atual/)
  fireEvent.click(screen.getByRole('button',{name:'Confirmar exclusão'}))
  await screen.findByRole('button',{name:'Continuar'})
  expect(screen.getByRole('alert')).toHaveTextContent('Etapa 1: HTTP 503')
  expect(confirmations).toEqual([800])
  fireEvent.click(screen.getByRole('button',{name:'Continuar'}))
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(confirmations).toEqual([800,800,300])
})

it('F3 safe save shows preview, protected samples and never calls purge',async()=>{
  const requests:string[]=[]
  const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input);requests.push(path)
    if(path.endsWith('/direct-rule/preview')) return json({
      count:12,token:'a'.repeat(64),confirmationToken:'b'.repeat(64),
      policyRevision:190,blockedCompany:1,blockedOtherSource:2,
      samples:[{id:'p1',title:'EXTRATO DE CONVÊNIO',sourceCode:'dou',
        section:'DO3',officialType:'EXTRATO DE CONVÊNIO',
        pattern:'EXTRATO DE TERMO ADITIVO',protection:null}],
    })
    if(path.endsWith('/direct-rule/save')){
      const payload=JSON.parse(String(init?.body))
      expect(payload.confirmationToken).toEqual('b'.repeat(64))
      expect(payload.policyRevision).toEqual(190)
      expect(payload.expectedCount).toEqual(12)
      return json({revision:191,deletedCount:0,historicalPurgeRequired:true})
    }
    throw new Error('unexpected and destructive endpoint: '+path)
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{}),onClose=vi.fn()
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={{...rule,mode:'KEEP_ALWAYS'}}
    onClose={onClose} onApplied={onApplied}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar prévia F3'}))
  expect(await screen.findByText(/12 publicações históricas correspondem à regra/)).toBeInTheDocument()
  expect(screen.getByText(/EXTRATO DE CONVÊNIO/)).toBeInTheDocument()
  expect(screen.getByText(/Nenhuma publicação será apagada ao salvar/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Salvar classificação sem excluir'}))
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(requests).toEqual([
    '/api/v1/admin/collection-filter/direct-rule/preview',
    '/api/v1/admin/collection-filter/direct-rule/save'])
  expect(requests.some(path=>path.endsWith('/direct-rule/confirm'))).toBe(false)
})

it('F3 rejects legacy preview lacking revision/token; never saves or purges',async()=>{
  const paths:string[]=[]
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    const path=String(input);paths.push(path)
    if(path.endsWith('/direct-rule/preview'))return json(preview(800,'legacy'))
    throw new Error('unexpected: '+path)
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{})
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={rule}
    onClose={vi.fn()} onApplied={onApplied}/>)
  fireEvent.click(screen.getByRole('button',{name:'Consultar prévia F3'}))
  expect(await screen.findByRole('alert')).toHaveTextContent(/prévia F3 segura/)
  expect(screen.queryByRole('button',{name:'Salvar classificação sem excluir'})).toBeNull()
  expect(paths).toHaveLength(1)
  expect(onApplied).not.toHaveBeenCalled()
})


