import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingSummary,SummaryChips} from './onboarding-summary'
import type {AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
it('deduplicates by code, preserves equal labels and expands after eight identities',()=>{
 const items=Array.from({length:9},(_,i)=>({code:'product.'+i,label:'Mesmo nome'}));items.push(items[0]);
 render(<SummaryChips title="Produtos" items={items}/>);
 expect(screen.getByRole('heading',{name:'Produtos · 9'})).toBeVisible();expect(screen.getAllByText('Mesmo nome')).toHaveLength(8)
 fireEvent.click(screen.getByRole('button',{name:'+1 ver todos'}));expect(screen.getAllByText('Mesmo nome')).toHaveLength(9)
 expect(new Set([...document.querySelectorAll('[data-code]')].map(el=>el.getAttribute('data-code'))).size).toBe(9)
})
it('keeps block counts equal to unique codes for suggested and extra products and dimensions',()=>{
 const concepts=['p1','p2','p3','p4'].map(code=>({code,label:'Produto igual',dimensionCode:'product'}));
 const data={concepts:[...concepts,{code:'t1',label:'Tributo igual',dimensionCode:'tax'},{code:'t2',label:'Tributo igual',dimensionCode:'tax'}],cards:[{establishmentId:'u',cnaeCode:'0111301',segmentCode:'sector.agro',segmentLabel:'Agro',suggestions:concepts.slice(0,2).map(c=>({kind:'PRODUCT',target:c.code}))}],state:{completed:false,cards:{},units:{}},effectiveProfiles:[{establishmentId:'u',name:'Teste',isHeadOffice:true,taxRegime:'NAO_INFORMADO',conceptCodes:['p1','p1','p2','p3','p4','t1','t2','t1'],ncmCodes:[],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]} as unknown as AssistantData;
 const before=JSON.stringify(data);render(<OnboardingSummary data={data} onEditCard={vi.fn()} onEditProfile={vi.fn()}/>);
 for(const title of ['Agro','Outros produtos e NCMs salvos']){const region=within(screen.getByRole('region',{name:title}));expect(region.getByRole('heading',{name:title+' · 2 produtos · 0 NCMs'})).toBeVisible();expect(region.getAllByText('Produto igual')).toHaveLength(2)}
 const tax=within(screen.getByRole('region',{name:'Tributo'}));expect(tax.getByRole('heading',{name:'Tributo · 2 itens'})).toBeVisible();expect(tax.getAllByText('Tributo igual')).toHaveLength(2);expect(JSON.stringify(data)).toBe(before)
})
