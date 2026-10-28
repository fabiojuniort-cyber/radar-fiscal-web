import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import type {AssistantData} from './onboarding-assistant-api'
import type {Establishment} from './product-api'
afterEach(cleanup)
const branch={id:'branch',companyId:'company',name:'Filial',uf:'GO',stateRegistration:null,stateRegistrationSource:null} as Establishment
const head={...branch,id:'head',name:'Matriz',stateRegistration:'123'} as Establishment
const fixture=():AssistantData=>({version:7,release:{id:'release-19',version:'v1.9.0'},companyName:'Synthetic',
 state:{completed:false,cards:{company:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]}},units:{}},cards:[],concepts:[]})
function mount(patch:(body:Record<string,unknown>)=>Promise<Response>,reloadUnits=[head,branch]){
 const data=fixture(),close=vi.fn(),saved=vi.fn()
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
  if(init?.method==='PATCH')return patch(JSON.parse(String(init.body)))
  if(String(url).endsWith('/establishments'))return Response.json({items:reloadUnits})
  return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)
 })
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[head,branch]} initialEstablishmentId="branch" initialCardId="establishments" onClose={close} onSaved={saved}/>)
 return {api,close,saved}
}
it('saves only the selected unit IE inside the popup, preserving card version and other fields',async()=>{
 const patch=vi.fn(async()=>Response.json({establishmentId:'branch',stateRegistration:'456',stateRegistrationSource:'MANUAL'}))
 const {api,close,saved}=mount(patch)
 const input=await screen.findByLabelText('Inscrição Estadual — Filial')
 fireEvent.change(input,{target:{value:' 456 '}})
 expect(screen.getByRole('button',{name:'Salvar e continuar'})).toBeEnabled()
 expect(screen.queryByRole('button',{name:'Salvar IE'})).not.toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(patch).toHaveBeenCalledWith({expectedStateRegistration:null,stateRegistration:'456'})
 expect(screen.getByRole('dialog')).toBeInTheDocument();expect(close).not.toHaveBeenCalled()
 expect(saved).toHaveBeenCalledTimes(2)
 const call=api.mock.calls.find(([,init])=>init?.method==='PATCH')!
 expect(call[0]).toBe('/api/v1/companies/company/establishments/branch/state-registration')
 expect(call[1]?.headers).toMatchObject({'X-Tenant-Id':'tenant'})
 expect(JSON.parse(String(call[1]?.body))).toEqual({expectedStateRegistration:null,stateRegistration:'456'})
 expect(api.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(1)
 expect(screen.getByRole('button',{name:'Concluir perfil'})).toBeEnabled()
})
it('retains failed edits, prevents navigation and does not retry or close automatically',async()=>{
 const patch=vi.fn(async()=>Response.json({error:'unavailable'},{status:503}))
 const {close}=mount(patch)
 const input=await screen.findByLabelText('Inscrição Estadual — Filial')
 fireEvent.change(input,{target:{value:'456'}})
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('alert')
 expect(input).toHaveValue('456');expect(patch).toHaveBeenCalledTimes(1)
 expect(screen.getByRole('button',{name:'Pular'})).toBeDisabled();expect(close).not.toHaveBeenCalled()
 fireEvent.click(screen.getByRole('button',{name:'Descartar edição da IE'}))
 expect(input).toHaveValue('');expect(screen.getByRole('button',{name:'Salvar e continuar'})).toBeEnabled()
})
it('a conflict keeps the draft until explicit reload of that unit',async()=>{
 const patch=vi.fn(async()=>Response.json({error:'state_registration_conflict'},{status:409}))
 mount(patch,[head,{...branch,stateRegistration:'999'}])
 const input=await screen.findByLabelText('Inscrição Estadual — Filial')
 fireEvent.change(input,{target:{value:'456'}});fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('A IE mudou em outra tela')
 expect(input).toHaveValue('456');expect(patch).toHaveBeenCalledTimes(1)
 fireEvent.click(screen.getByRole('button',{name:'Recarregar IE'}))
 await waitFor(()=>expect(input).toHaveValue('999'))
 expect(screen.queryByLabelText('Inscrição Estadual — Matriz')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Salvar e continuar'})).toBeEnabled()
})
it('saving one IE locks the other unit and card navigation until readback completes',async()=>{
 let resolve!:(value:Response)=>void
 mount(()=>new Promise(r=>{resolve=r}))
 const input=await screen.findByLabelText('Inscrição Estadual — Filial')
 fireEvent.change(input,{target:{value:'456'}});fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 expect(screen.queryByLabelText('Inscrição Estadual — Matriz')).not.toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Fechar assistente'})).toBeDisabled()
 resolve(Response.json({establishmentId:'branch',stateRegistration:'456',stateRegistrationSource:'MANUAL'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(screen.getByRole('button',{name:'Concluir perfil'})).toBeEnabled()
})

it('late establishment readback initializes IE CAS without overwriting a draft',async()=>{
 const data=fixture(),patches:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PATCH'){patches.push(JSON.parse(String(init.body)));return Response.json({establishmentId:'head',stateRegistration:'456',stateRegistrationSource:'MANUAL'})}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 const props={apiFetch:api,tenantId:'tenant',companyId:'company',onClose:vi.fn(),onSaved:vi.fn()}
 const view=render(<OnboardingAssistant {...props} units={[]}/>)
 expect(screen.getByRole('status')).toHaveTextContent('Carregando seu perfil')
 view.rerender(<OnboardingAssistant {...props} units={[head]}/>)
 const input=await screen.findByLabelText('Inscrição Estadual — Matriz');expect(input).toHaveValue('123')
 fireEvent.change(input,{target:{value:'456'}})
 view.rerender(<OnboardingAssistant {...props} units={[{...head,name:'Matriz'}]}/>)
 expect(input).toHaveValue('456')
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(patches).toEqual([{expectedStateRegistration:'123',stateRegistration:'456'}])
})
