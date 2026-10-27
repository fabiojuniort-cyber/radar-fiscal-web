import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {segmentComplete,segmentChoice,initialStep,segmentSteps,type AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
const fixture=():AssistantData=>({version:7,release:{id:'release-19',version:'v1.9.0'},companyName:'Synthetic company',
 state:{completed:false,cards:{company:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]},establishments:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]}},units:{}},
 concepts:[{code:'product.rice',label:'Arroz',dimensionCode:'product'}],
 cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Cultivo de arroz',segmentCode:'sector.agro',segmentLabel:'Agropecuária',phraseSegment:'agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agropecuária'},{kind:'NCM',target:'1006',segment:'Agropecuária'}]}]})
it('groups multiple CNAEs in one segment without preselecting published suggestions',async()=>{
 const data=fixture();data.cards.push({...data.cards[0]!,cnaeCode:'0111302',description:'Milho'})
 expect(segmentSteps(data)).toHaveLength(1);expect(initialStep(data)).toBe(2)
 const api=vi.fn(async(url:RequestInfo|URL)=>Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 expect(await screen.findByRole('heading',{name:'Agropecuária: o que você compra, vende ou produz?'})).toBeInTheDocument()
 expect(screen.getByRole('checkbox',{name:/Arroz/})).not.toBeChecked()
 expect(screen.getByText('NCM 1006',{exact:true})).toBeInTheDocument()
 expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
 expect(api.mock.calls).toHaveLength(2)
})
it('an explicit row selection saves one segment atomically with its version and unit',async()=>{
 const data=fixture(),writes:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json({...data,version:8})}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('checkbox',{name:/Arroz/}));fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(writes).toEqual([{expectedVersion:7,releaseId:'release-19',cardId:'segment:sector.agro',status:'CONFIRMED',conceptCodes:[],ncmCodes:[],units:[{establishmentId:'head',conceptCodes:['product.rice'],ncmCodes:['1006']}]}])
})
it('a stale save keeps the current choices and shows the friendly version message once',async()=>{
 const data=fixture()
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>init?.method==='PUT'?Response.json({error:'profile_version_conflict'},{status:409}):Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('checkbox',{name:/Arroz/}));fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Há uma versão nova do TriFaros.')
 expect(screen.getByRole('checkbox',{name:/Arroz/})).toBeChecked()
 expect(api.mock.calls.filter(([,i])=>i?.method==='PUT')).toHaveLength(1)
})
it('animation uses mapped CSV phrases for six seconds',async()=>{
 vi.useFakeTimers();const random=vi.spyOn(Math,'random').mockReturnValue(0)
 try{const data=fixture();const api=vi.fn(async(url:RequestInfo|URL)=>Response.json(String(url).endsWith('/phrases')?{items:[{segment:'agro',phrases:['Contando os grãos.']}]}:data))
 const view=render(<OnboardingAssistant animate apiFetch={api} tenantId="tenant" companyId="company" units={[]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await act(async()=>{await Promise.resolve();await Promise.resolve()})
 expect(screen.getByRole('status')).toHaveTextContent('Contando os grãos.')
 await act(async()=>{await vi.advanceTimersByTimeAsync(6000)})
 expect(screen.getByRole('checkbox',{name:/Arroz/})).not.toBeChecked();view.unmount()
 }finally{random.mockRestore();vi.useRealTimers()}
})

it('one CNAE in two segments shows only each segment legacy selections',()=>{
 const data=fixture();
 data.cards.push({...data.cards[0]!,segmentCode:'sector.energy',segmentLabel:'Energia',suggestions:[{kind:'PRODUCT',target:'product.energy',segment:'Energia'},{kind:'NCM',target:'2716',segment:'Energia'}]});
 data.state.units.head={cards:{'cnae:0111301':{status:'CONFIRMED',conceptCodes:['product.rice','product.energy','product.manual'],ncmCodes:['1006','2716','999']}}};
 const groups=segmentSteps(data);expect(groups).toHaveLength(2);
 expect(segmentChoice(data,groups[0]!,'head')).toEqual({status:'CONFIRMED',conceptCodes:['product.rice'],ncmCodes:['1006']});
 expect(segmentChoice(data,groups[1]!,'head')).toEqual({status:'CONFIRMED',conceptCodes:['product.energy'],ncmCodes:['2716']});
});

it('resumes a partly completed old segment with prior choices and remaining activity still pending',()=>{
 const data=fixture();data.cards.push({...data.cards[0]!,cnaeCode:'0111302'});
 data.state.units.head={cards:{'cnae:0111301':{status:'CONFIRMED',conceptCodes:['product.rice'],ncmCodes:['1006']}}};
 const group=segmentSteps(data)[0]!;
 expect(segmentChoice(data,group,'head')?.conceptCodes).toEqual(['product.rice']);
 expect(segmentComplete(data,group,'head')).toBe(false);
 expect(initialStep(data)).toBe(2);
});
