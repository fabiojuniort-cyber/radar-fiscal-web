import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {profileDimensionGroups,profileDimensions} from './onboarding-dimensions'
import type {AssistantData} from './onboarding-assistant-api'
import type {Establishment} from './product-api'
afterEach(cleanup)
it.each(profileDimensionGroups)('filters every dimension and collapsed group in $title without saving',async group=>{
 const data={version:8,release:{id:'published',version:'v1'},companyName:'Teste',state:{completed:false,cards:{},units:{}},cards:[],dimensions:profileDimensions.map(([code,name])=>({code,name})),taxonomyGroups:group.dimensions.map(code=>({code:code+'.g',dimensionCode:code,label:'Grupo '+code,displayOrder:1})),concepts:group.dimensions.flatMap(code=>[{code:code+'.a',label:'Comum '+code,dimensionCode:code,groupCode:code+'.g'},{code:code+'.b',label:'Outro '+code,dimensionCode:code,groupCode:code+'.g'}]),effectiveProfiles:[{establishmentId:'head',isHeadOffice:true,name:'Matriz',taxRegime:'NAO_INFORMADO',conceptCodes:[],ncmCodes:[],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]} as AssistantData
 const api=vi.fn(async(url:RequestInfo|URL,_init?:RequestInit)=>Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="t" companyId="c" initialEstablishmentId="head" initialCardId={'dimension-group:'+group.code} units={[{id:'head'} as Establishment]} onClose={vi.fn()} onSaved={vi.fn()}/>);
 await screen.findByRole('heading',{name:group.title})
 expect(screen.getAllByRole('textbox')).toHaveLength(1)
 for(const toggle of screen.getAllByRole('button',{name:/Grupo .* · 2/}))fireEvent.click(toggle)
 expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'comum'}})
 expect(screen.getAllByRole('checkbox')).toHaveLength(group.dimensions.length)
 for(const code of group.dimensions){const region=within(screen.getByRole('region',{name:profileDimensions.find(([c])=>c===code)![1]}));expect(region.getByRole('button',{name:'▾ Grupo '+code+' · 1'})).toHaveAttribute('aria-expanded','true');expect(region.getByText('1 opção encontrada')).toBeVisible()}
 fireEvent.click(screen.getAllByRole('checkbox')[0]);expect(api.mock.calls.every(([,init])=>!init?.method||init.method==='GET')).toBe(true)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'inexistente'}});expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
 fireEvent.change(screen.getByRole('textbox'),{target:{value:''}});expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
 for(const toggle of screen.getAllByRole('button',{name:/Grupo .* · 2/}))fireEvent.click(toggle)
 expect(screen.getAllByRole('checkbox')).toHaveLength(2*group.dimensions.length);expect(screen.getAllByRole('checkbox')[0]).toBeChecked()
})
