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
 for(const [,label] of profileDimensions)expect(screen.getByRole('heading',{name:label})).toBeInTheDocument()
 fireEvent.click(screen.getByRole('button',{name:'Editar Tributos e regime'}));expect(onEdit).toHaveBeenLastCalledWith('dimension-group:tax_regime')
 fireEvent.click(screen.getByRole('button',{name:'Editar regime declarado'}));expect(onEdit).toHaveBeenLastCalledWith('profile')
})
