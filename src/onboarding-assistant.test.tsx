import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {initialStep,type AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
const fixture=():AssistantData=>({version:7,release:{id:'release-19',version:'v1.9.0'},companyName:'Synthetic company',
 state:{completed:false,cards:{company:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]},establishments:{status:'SKIPPED',conceptCodes:[],ncmCodes:[]}},units:{}},
 concepts:[{code:'product.rice',label:'Arroz',dimensionCode:'product'},{code:'sector.agro',label:'Agro',dimensionCode:'sector'}],
 cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Cultivo de arroz',phraseSegment:'agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agro'},{kind:'NCM',target:'1213',segment:'Agro'}]},
 {establishmentId:'branch',cnaeCode:'6201501',description:'Software',phraseSegment:'generico',suggestions:[]}]})
it('resume selects the first unsaved unit card, without copying suggestions or matrix choices',()=>{
 const data=fixture();expect(initialStep(data)).toBe(2)
 data.state.units.head={cards:{'cnae:0111301':{status:'CONFIRMED',conceptCodes:['product.rice'],ncmCodes:['1213']}}}
 expect(initialStep(data)).toBe(3)
})
it('only an explicit save writes one card, with the version and unpadded NCM',async()=>{
 const data=fixture(),writes:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json({version:8,release:data.release,state:data.state})}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('heading',{name:'Cultivo de arroz'})
 expect(writes).toHaveLength(0);expect(screen.getByLabelText('NCMs (separadas por vírgula)')).toHaveValue('')
 fireEvent.click(screen.getByRole('button',{name:'Selecionar sugestões para conferir'}))
 fireEvent.click(screen.getByRole('button',{name:'Salvar e próximo'}))
 await screen.findByRole('heading',{name:'Software'})
 expect(writes).toEqual([{expectedVersion:7,releaseId:'release-19',cardId:'cnae:0111301',establishmentId:'head',status:'CONFIRMED',conceptCodes:['product.rice','sector.agro'],ncmCodes:['1213']}])
 expect(screen.getByLabelText('NCMs (separadas por vírgula)')).toHaveValue('')
 expect(screen.getByText(/Sem vínculos publicados/)).toBeInTheDocument()
})
it('stale save is visible and never advances or retries automatically',async()=>{
 const data=fixture();const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>init?.method==='PUT'?Response.json({error:'profile_version_conflict'},{status:409}):Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('heading',{name:'Cultivo de arroz'});fireEvent.click(screen.getByRole('button',{name:'Pular'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('O perfil mudou em outra tela'))
 expect(screen.getByRole('heading',{name:'Cultivo de arroz'})).toBeInTheDocument()
 expect(api.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1)
})
import {act} from '@testing-library/react'
it('import animation uses the mapped phrases and lasts six seconds',async()=>{
 vi.useFakeTimers();const random=vi.spyOn(Math,'random').mockReturnValue(0)
 try{
  const data=fixture();data.cards[0]!.phraseSegments=['agro','pecuaria']
  const api=vi.fn(async(url:RequestInfo|URL)=>Response.json(String(url).endsWith('/phrases')?{items:[{segment:'agro',phrases:['Frase agro.'],version_no:1},{segment:'generico',phrases:['Frase genérica.'],version_no:1}]}:data))
  const view=render(<OnboardingAssistant animate apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
  await act(async()=>{await Promise.resolve();await Promise.resolve()})
  expect(screen.getByRole('status')).toHaveTextContent('Frase agro.')
  await act(async()=>{await vi.advanceTimersByTimeAsync(5999)})
  expect(screen.getByRole('status')).toHaveTextContent('Frase agro.')
  await act(async()=>{await vi.advanceTimersByTimeAsync(1)})
  expect(screen.getByRole('heading',{name:'Cultivo de arroz'})).toBeInTheDocument()
  view.unmount()
 }finally{random.mockRestore();vi.useRealTimers()}
})
