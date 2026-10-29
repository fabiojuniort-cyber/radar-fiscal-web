import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {correctionValues} from './onboarding-company-data'
import type {AssistantData} from './onboarding-assistant-api'
import type {Establishment} from './product-api'
afterEach(cleanup)
const unit={id:'branch',companyId:'company',name:'Filial',cnpj:'10515785000270',cnaes:[],uf:'GO',stateRegistration:null,stateRegistrationSource:null,businessLocationCode:null,street:null,streetNumber:null,district:null,complement:null,municipalityName:null,municipalityIbgeCode:null,postalCode:null} as unknown as Establishment
function mount(patch:(body:Record<string,unknown>)=>Promise<Response>){
 const data:AssistantData={version:7,release:{id:'release',version:'v1.9'},companyName:'Synthetic',state:{completed:false,cards:{},units:{}},cards:[],concepts:[]}
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>init?.method==='PATCH'?patch(JSON.parse(String(init.body))):Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 const close=vi.fn();render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} initialEstablishmentId="branch" initialCardId="establishments" onClose={close} onSaved={vi.fn()}/>);return {api,close}
}
it('unifies IE in card one and atomically saves registration + IE with a displayed baseline',async()=>{
 const patch=vi.fn(async body=>Response.json({establishmentId:'branch',...body.values,stateRegistrationSource:'MANUAL'}));const {api}=mount(patch)
 await screen.findByRole('heading',{name:'Estes são os dados da sua unidade?'})
 expect(screen.queryByText('Confira seus estabelecimentos')).not.toBeInTheDocument();expect(screen.getByText('Inscrição Estadual')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Corrigir algum dado'}));fireEvent.change(screen.getByLabelText('Inscrição Estadual'),{target:{value:'456'}});fireEvent.change(screen.getByLabelText('Logradouro'),{target:{value:'Rua nova'}})
 expect(api.mock.calls.filter(([,i])=>i?.method==='PATCH')).toHaveLength(0)
 fireEvent.click(screen.getByRole('button',{name:'Salvar correção'}));await waitFor(()=>expect(screen.queryByLabelText('Inscrição Estadual')).not.toBeInTheDocument())
 expect(patch).toHaveBeenCalledWith({expected:correctionValues(unit,'Synthetic'),values:{...correctionValues(unit,'Synthetic'),stateRegistration:'456',street:'Rua nova'}})
 expect(api.mock.calls.find(([,i])=>i?.method==='PATCH')?.[0]).toContain('/branch/onboarding-data')
 expect(screen.getByText('456')).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Salvar IE'})).not.toBeInTheDocument()
})
it('retains all fields on a CAS conflict and never retries the mutation',async()=>{
 const patch=vi.fn(async()=>Response.json({error:'registration_data_conflict'},{status:409}));mount(patch)
 fireEvent.click(await screen.findByRole('button',{name:'Corrigir algum dado'}));fireEvent.change(screen.getByLabelText('Inscrição Estadual'),{target:{value:'456'}});fireEvent.click(screen.getByRole('button',{name:'Salvar correção'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Os dados mudaram');expect(screen.getByLabelText('Inscrição Estadual')).toHaveValue('456');expect(patch).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Salvar e continuar'})).toBeDisabled()
})
it('cancel correction never persists IE or address',async()=>{
 const patch=vi.fn();mount(patch);fireEvent.click(await screen.findByRole('button',{name:'Corrigir algum dado'}));fireEvent.change(screen.getByLabelText('Inscrição Estadual'),{target:{value:'456'}});fireEvent.click(screen.getByRole('button',{name:'Cancelar correção'}));expect(patch).not.toHaveBeenCalled();expect(screen.getByText('Não informada')).toBeInTheDocument()
})
