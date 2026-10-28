import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {assistantSteps,dimensionSteps,type AssistantData} from './onboarding-assistant-api'
import {profileDimensions} from './onboarding-dimensions'
import type {Establishment} from './product-api'
afterEach(cleanup)
const fixture=():AssistantData=>({version:4,release:{id:'release',version:'v1'},companyName:'Agrex',state:{completed:false,cards:{},units:{}},cards:[],dimensions:profileDimensions.map(([code,name])=>({code,name})),concepts:[{code:'tax.icms',label:'ICMS',dimensionCode:'tax'},{code:'regime.real',label:'Lucro real',dimensionCode:'regime'},{code:'operation.venda',label:'Venda',dimensionCode:'operation'}],effectiveProfiles:[{establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'NAO_INFORMADO',conceptCodes:['tax.icms','regime.real','operation.venda'],ncmCodes:['1006'],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]})
it('uses exactly three ordered cards, with independent searches and one versioned save for the whole group',async()=>{
 const data=fixture(),writes:Record<string,unknown>[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json(data)}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 expect(dimensionSteps(data).map(s=>[s.title,s.dimensions.length])).toEqual([['Tributos e regime',2],['Operações e documentos',3],['Obrigações e contexto',4]])
 expect(assistantSteps(data).filter(s=>s.id.startsWith('dimension:'))).toHaveLength(0)
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" initialEstablishmentId="head" initialCardId="dimension-group:tax_regime" units={[{id:'head'} as Establishment]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('heading',{name:'Tributos e regime'})
 const tax=within(screen.getByRole('region',{name:'Tributo'})),regime=within(screen.getByRole('region',{name:'Regime'}))
 expect(tax.getByRole('checkbox',{name:'ICMS'})).toBeChecked();expect(regime.getByRole('checkbox',{name:'Lucro real'})).toBeChecked()
 fireEvent.change(tax.getByRole('textbox'),{target:{value:'ICMS'}});fireEvent.change(regime.getByRole('textbox'),{target:{value:'Lucro'}});expect(tax.getByRole('textbox')).toHaveValue('ICMS')
 fireEvent.click(tax.getByRole('checkbox',{name:'ICMS'}));expect(writes).toHaveLength(0)
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await waitFor(()=>expect(writes).toHaveLength(1));expect(writes[0]).toMatchObject({expectedVersion:4,releaseId:'release',cardId:'dimension-group:tax_regime',establishmentId:'head',conceptCodes:['regime.real'],ncmCodes:[]})
 await screen.findByRole('heading',{name:'Operações e documentos'})
})
