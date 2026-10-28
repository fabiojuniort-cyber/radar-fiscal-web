import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import type {AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
it('opening a later branch targets only its own CNAE and never selects the matrix choices',async()=>{
 const data:AssistantData={version:9,release:{id:'v19',version:'v1.9.0'},companyName:'Synthetic',
 state:{completed:false,cards:{},units:{head:{cards:{'cnae:0111301':{status:'CONFIRMED',conceptCodes:['product.rice'],ncmCodes:['1006']}}}}},
 concepts:[{code:'product.rice',label:'Arroz',dimensionCode:'product',ncmCodes:['1006']}],
 cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Matriz arroz',segmentCode:'sector.agro',segmentLabel:'Agropecuária',phraseSegment:'agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agro'},{kind:'NCM',target:'1006',segment:'Agro'}]},
 {establishmentId:'branch',cnaeCode:'0111301',description:'Filial arroz',segmentCode:'sector.agro',segmentLabel:'Agropecuária',phraseSegment:'agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agro'},{kind:'NCM',target:'1006',segment:'Agro'}]}]}
 const writes:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{
  if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json({...data,version:10})}
  return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)
 })
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} initialEstablishmentId="branch" onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('heading',{name:'Agropecuária: o que você compra, vende ou produz?'})
 expect(screen.getByLabelText('Estabelecimento')).toHaveValue('branch')
 expect(screen.getByRole('checkbox',{name:/Arroz/})).not.toBeChecked()
 expect(screen.getByLabelText('0 conceitos e 0 NCMs selecionados')).toBeInTheDocument()
 fireEvent.click(screen.getByRole('checkbox',{name:/Arroz/}))
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(writes).toEqual([{selectionMode:'EFFECTIVE',expectedVersion:9,releaseId:'v19',cardId:'segment:sector.agro',status:'CONFIRMED',conceptCodes:[],ncmCodes:[],units:[{establishmentId:'head',conceptCodes:['product.rice'],ncmCodes:['1006']},{establishmentId:'branch',conceptCodes:['product.rice'],ncmCodes:['1006']}]}])
 expect(data.state.units.head.cards['cnae:0111301'].ncmCodes).toEqual(['1006'])
})

