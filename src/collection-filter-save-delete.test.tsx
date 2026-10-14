import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {CollectionFilterDirectDialog} from './collection-filter-direct-dialog'
import type {ProductApiFetch} from './product-api'

afterEach(cleanup)
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status})
const rule={sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'EXCLUDE_ALWAYS' as const}
const preview=(count:number,revision=200)=>({count,policyRevision:revision,
  token:'a'.repeat(64),confirmationToken:'b'.repeat(64),blockedCompany:2,blockedOtherSource:1})
async function begin(count:number){
  fireEvent.click(screen.getByRole('button',{name:'Consultar prévia F3'}))
  await screen.findByText(`${count.toLocaleString('pt-BR')} publicações serão apagadas ao salvar.`)
  fireEvent.click(screen.getByRole('button',{name:`Salvar e excluir ${count.toLocaleString('pt-BR')} publicações`}))
}

it.each(['EXCLUDE_ALWAYS','EXCLUDE_UNLESS_STRONG'] as const)('%s saves and deletes with F3 capability, then resumes all batches',async mode=>{
  const bodies:Array<Record<string,unknown>>=[]
  let previews=0
  const apiFetch=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const path=String(input)
    if(path.endsWith('/preview'))return json(preview(previews++===0?650:150,previews===1?200:201))
    if(path.endsWith('/confirm')){
      bodies.push(JSON.parse(String(init?.body)))
      return json({changed:false,deletedCount:bodies.length===1?500:150,
        restantes:bodies.length===1?150:0,revision:201})
    }
    throw new Error('Unexpected path '+path)
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{}),onClose=vi.fn()
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={{...rule,mode}}
    onApplied={onApplied} onClose={onClose}/> )
  await begin(650)
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(bodies).toEqual([
    {...rule,mode,expectedCount:650,previewToken:'a'.repeat(64),confirmationToken:'b'.repeat(64),policyRevision:200,resume:false},
    {...rule,mode,expectedCount:150,previewToken:'a'.repeat(64),confirmationToken:'b'.repeat(64),policyRevision:201,resume:true},
  ])
  expect(screen.getByText('3 protegidas.')).toBeInTheDocument()
})

it.each(['count','revision','token','http','zero'] as const)('stops on %s without automatic retry',async scenario=>{
  let previews=0,confirms=0
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input).endsWith('/preview')){
      previews++
      return json(preview(previews===1?650:scenario==='count'?151:150,
        previews===1?200:scenario==='revision'?202:201))
    }
    confirms++
    if(scenario==='token')return json({error:'f3_confirmation_token_stale_or_policy_revision_changed'},409)
    if(scenario==='http')throw new TypeError('resposta perdida')
    return json({changed:false,deletedCount:scenario==='zero'?0:500,restantes:150,revision:201})
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{})
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={rule}
    onApplied={onApplied} onClose={vi.fn()}/> )
  await begin(650)
  await screen.findByRole('alert')
  expect(confirms).toBe(1)
  expect(onApplied).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Consultar prévia F3'})).toBeEnabled()
})

it('zero eligible still saves the exclusion rule once',async()=>{
  let confirms=0
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input).endsWith('/preview'))return json(preview(0))
    confirms++;return json({changed:false,deletedCount:0,restantes:0,revision:201})
  }) as ProductApiFetch
  const onApplied=vi.fn(async()=>{})
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={rule}
    onApplied={onApplied} onClose={vi.fn()}/> )
  await begin(0)
  await waitFor(()=>expect(onApplied).toHaveBeenCalledTimes(1))
  expect(confirms).toBe(1)
})

it('cancel during a batch prevents subsequent destructive requests',async()=>{
  let resolve!:(r:Response)=>void
  const pending=new Promise<Response>(done=>{resolve=done})
  let confirms=0
  const apiFetch=vi.fn(async(input:RequestInfo|URL)=>{
    if(String(input).endsWith('/preview'))return json(preview(650))
    confirms++;return pending
  }) as ProductApiFetch
  render(<CollectionFilterDirectDialog apiFetch={apiFetch} initial={rule}
    onApplied={vi.fn(async()=>{})} onClose={vi.fn()}/> )
  await begin(650)
  await waitFor(()=>expect(confirms).toBe(1))
  fireEvent.click(screen.getByRole('button',{name:'Parar após o lote atual'}))
  resolve(json({changed:false,deletedCount:500,restantes:150,revision:201}))
  await screen.findByText('500 publicações apagadas.')
  expect(confirms).toBe(1)
  expect(apiFetch).toHaveBeenCalledTimes(2)
})
