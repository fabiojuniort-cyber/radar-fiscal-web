import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingSummary} from './onboarding-summary'
import type {AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
it('shows effective products and NCMs separately, eight chips per row, expands and routes edits without writes',()=>{
 const concepts=Array.from({length:10},(_,i)=>({code:'product.p'+i,label:'Produto '+i,dimensionCode:'product',ncmCodes:['10063021']}))
 const data={concepts:[...concepts,{code:'tax.icms',label:'ICMS',dimensionCode:'tax'}],cards:[{establishmentId:'unit',cnaeCode:'0111301',segmentCode:'sector.agro',segmentLabel:'Agropecuária',suggestions:concepts.map(c=>({kind:'PRODUCT',target:c.code,segment:'Agropecuária'}))}],state:{units:{},cards:{},completed:false},effectiveProfiles:[{establishmentId:'unit',name:'Unidade teste',isHeadOffice:true,taxRegime:'LUCRO_REAL',conceptCodes:[...concepts.slice(0,9).map(c=>c.code),'tax.icms'],ncmCodes:['10063021','2716'],legacyFields:{products:['Produto legado']},cnaeSegments:[],historicalCodes:[]}]} as unknown as AssistantData
 const snapshot=JSON.stringify(data),onEditCard=vi.fn(),onEditProfile=vi.fn();render(<OnboardingSummary data={data} onEditCard={onEditCard} onEditProfile={onEditProfile}/>);
 const agro=within(screen.getByRole('region',{name:'Agropecuária'})),products=within(agro.getByRole('group',{name:'Produtos'}))
 expect(agro.getByRole('heading',{name:'Agropecuária · 9 produtos · 1 NCM'})).toBeInTheDocument();expect(products.getAllByText(/^Produto \d$/)).toHaveLength(8);expect(screen.queryByText('Produto 9',{exact:true})).toBeNull()
 fireEvent.click(products.getByRole('button',{name:'+1 ver todos'}));expect(products.getAllByText(/^Produto \d$/)).toHaveLength(9)
 expect([...screen.getByRole('region',{name:'Agropecuária'}).querySelectorAll('.onb-summary-chip-row')].every(row=>row.children.length<=8)).toBe(true)
 expect(agro.getByText('1006.30.21',{exact:true})).toBeInTheDocument();expect(within(screen.getByRole('region',{name:'Outros produtos e NCMs salvos'})).getByText('2716')).toBeInTheDocument();expect(screen.getByText('Produto legado')).toBeInTheDocument()
 fireEvent.click(agro.getByRole('button',{name:'Editar Agropecuária'}));expect(onEditCard).toHaveBeenCalledWith('segment:sector.agro')
 fireEvent.click(within(screen.getByRole('region',{name:'Tributo'})).getByRole('button',{name:'Editar Tributo'}));expect(onEditCard).toHaveBeenCalledWith('dimension-group:tax_regime')
 fireEvent.click(within(screen.getByRole('region',{name:'Regime'})).getByRole('button',{name:'Editar Regime'}));expect(onEditProfile).toHaveBeenCalledWith('unit');
 fireEvent.click(screen.getByRole('button',{name:'Editar escolhas - Unidade teste'}));expect(onEditProfile).toHaveBeenCalledWith('unit');expect(JSON.stringify(data)).toBe(snapshot)
})
