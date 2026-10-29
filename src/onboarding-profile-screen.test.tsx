import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingProfileScreen} from './onboarding-profile-screen'
import {profileDimensions} from './onboarding-dimensions'
import type {Establishment} from './product-api'
afterEach(cleanup)
it('groups all dimensions and permits correcting a legacy regime even without any legacy free-text field',async()=>{
 const onEdit=vi.fn(),api=vi.fn(async()=>Response.json({version:1,release:{id:'release',version:'v1'},companyName:'Agrex',cards:[],concepts:[{code:'tax.icms',label:'ICMS',dimensionCode:'tax'}],dimensions:profileDimensions.map(([code,name])=>({code,name})),state:{completed:true,cards:{},units:{}},effectiveProfiles:[{establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'LUCRO_REAL',conceptCodes:['tax.icms'],ncmCodes:[],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]}))
 render(<OnboardingProfileScreen apiFetch={api} tenantId="tenant" companyId="company" unit={{id:'head',name:'Matriz',cnpj:'10515785000199',isHeadOffice:true} as Establishment} onEdit={onEdit} onBack={vi.fn()}/>)
 await screen.findByText('Regime declarado: Lucro Real')
 for(const [,label] of profileDimensions)expect(screen.getByRole('heading',{name:new RegExp('^'+label+' ')})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Editar Tributo'}));expect(onEdit).toHaveBeenLastCalledWith('dimension-group:tax_regime')
 fireEvent.click(screen.getByRole('button',{name:'Editar regime declarado'}));expect(onEdit).toHaveBeenLastCalledWith('profile')
})


it('shows separate chip blocks, CNPJ format, CNAE segments, 12-item expansion and empty Add',async()=>{
 const products=Array.from({length:15},(_,i)=>({code:'product.p'+i,label:'Produto '+i,dimensionCode:'product'}))
 const api=vi.fn(async()=>Response.json({version:1,release:{id:'r',version:'v1'},companyName:'Agrex',cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Arroz',segmentCode:'sector.agro',segmentLabel:'Agro',phraseSegment:'agro',suggestions:[]}],concepts:products,state:{completed:true,cards:{},units:{}},effectiveProfiles:[{establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'NAO_INFORMADO',conceptCodes:products.map(p=>p.code),ncmCodes:['1006'],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]}))
 const edit=vi.fn();render(<OnboardingProfileScreen apiFetch={api} tenantId="t" companyId="c" unit={{id:'head',name:'Matriz',cnpj:'10515785000199',isHeadOffice:true,uf:'GO',stateRegistration:'123'} as Establishment} onEdit={edit} onBack={vi.fn()}/>)
 await screen.findByText('CNPJ 10.515.785/0001-99 · Matriz · Tipo não informado · GO · IE 123')
 const block=screen.getByRole('region',{name:'Produtos'});expect(block.querySelectorAll('.onb-profile-chip')).toHaveLength(12)
 fireEvent.click(screen.getByRole('button',{name:'ver todos (15)'}));expect(block.querySelectorAll('.onb-profile-chip')).toHaveLength(15)
 fireEvent.click(screen.getByRole('button',{name:'ver menos'}));expect(block.querySelectorAll('.onb-profile-chip')).toHaveLength(12)
 expect(screen.getByRole('region',{name:'Segmento'})).toHaveTextContent('Agro')
 fireEvent.click(screen.getByRole('button',{name:'Adicionar Tributo'}));expect(edit).toHaveBeenLastCalledWith('dimension-group:tax_regime')
 expect(document.querySelectorAll('.onb-profile-block')).toHaveLength(12)
})
