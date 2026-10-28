import type {Establishment} from './product-api'
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingAssistant} from './onboarding-assistant'
import {segmentComplete,segmentChoice,initialStep,segmentSteps,type AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
const unit={id:'head',companyId:'company',cnpj:'10515785000199',name:'Matriz',isHeadOffice:true,cnaes:[]} as unknown as Establishment
const fixture=():AssistantData=>({version:7,release:{id:'release-19',version:'v1.9.0'},companyName:'Synthetic company',
 state:{completed:false,cards:{company:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]},establishments:{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]}},units:{}},
 concepts:[{code:'product.rice',label:'Arroz',dimensionCode:'product',ncmCodes:['1006']}],
 cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Cultivo de arroz',segmentCode:'sector.agro',segmentLabel:'Agropecuária',phraseSegment:'agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agropecuária'},{kind:'NCM',target:'1006',segment:'Agropecuária'}]}]})
it('groups multiple CNAEs in one segment with preselected published suggestions and no write',async()=>{
 const data=fixture();data.cards.push({...data.cards[0]!,cnaeCode:'0111302',description:'Milho'})
 expect(segmentSteps(data)).toHaveLength(1);expect(initialStep(data)).toBe(2)
 const api=vi.fn(async(url:RequestInfo|URL,_init?:RequestInit)=>Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 expect(await screen.findByRole('heading',{name:'Agropecuária: o que você compra, vende ou produz?'})).toBeInTheDocument()
 expect(screen.getByRole('checkbox',{name:/Arroz/})).toBeChecked()
 expect(screen.getByText('NCM 1006',{exact:true})).toBeInTheDocument()
 expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
 expect(api.mock.calls).toHaveLength(2)
})
it('an explicit row selection saves one segment atomically with its version and unit',async()=>{
 const data=fixture(),writes:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json({...data,version:8})}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('checkbox',{name:/Arroz/});fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(writes).toEqual([{selectionMode:'EFFECTIVE',expectedVersion:7,releaseId:'release-19',cardId:'segment:sector.agro',status:'CONFIRMED',conceptCodes:[],ncmCodes:[],units:[{establishmentId:'head',conceptCodes:['product.rice'],ncmCodes:['1006']}]}])
})
it('a stale save keeps the current choices and shows the friendly version message once',async()=>{
 const data=fixture()
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>init?.method==='PUT'?Response.json({error:'profile_version_conflict'},{status:409}):Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('checkbox',{name:/Arroz/});fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 expect(await screen.findByRole('alert')).toHaveTextContent('Há uma versão nova do TriFaros.')
 expect(screen.getByRole('checkbox',{name:/Arroz/})).toBeChecked()
 expect(api.mock.calls.filter(([,i])=>i?.method==='PUT')).toHaveLength(1)
})
it('animation uses mapped CSV phrases for six seconds',async()=>{
 vi.useFakeTimers();const random=vi.spyOn(Math,'random').mockReturnValue(0)
 try{const data=fixture();const api=vi.fn(async(url:RequestInfo|URL)=>Response.json(String(url).endsWith('/phrases')?{items:[{segment:'agro',phrases:['Contando os grãos.']}]}:data))
 const view=render(<OnboardingAssistant animate apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await act(async()=>{await Promise.resolve();await Promise.resolve()})
 expect(screen.getByRole('status')).toHaveTextContent('Contando os grãos.')
 await act(async()=>{await vi.advanceTimersByTimeAsync(6000)})
 expect(screen.getByRole('checkbox',{name:/Arroz/})).toBeChecked();view.unmount()
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

it('uses segmentCards while the legacy API field stays one row per CNAE',()=>{
 const data=fixture();
 data.segmentCards=[...data.cards,{...data.cards[0]!,segmentCode:'sector.food',segmentLabel:'Alimentos'}];
 expect(data.cards).toHaveLength(1);
 expect(segmentSteps(data)).toHaveLength(2);
});


it('preloads legacy effective choices, shows the complete summary and offers explicit correction without a migration',async()=>{
 const data=fixture();data.state.units.head={cards:{'segment:sector.agro':{status:'CONFIRMED',conceptCodes:[],ncmCodes:[]}}}
 data.effectiveProfiles=[{establishmentId:'head',name:'Matriz histórica',isHeadOffice:true,taxRegime:'LUCRO_REAL',conceptCodes:['product.retired','product.rice'],ncmCodes:['2716','1006'],legacyFields:{products:['Produto manual anterior'],operations:['Revenda']},cnaeSegments:[],historicalCodes:['product.retired']}]
 data.historicalConcepts=[{code:'product.retired',label:'Produto aposentado',dimensionCode:'product'}]
 const writes:Record<string,unknown>[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){const body=JSON.parse(String(init.body));writes.push(body);if(body.cardId==='profile'){data.effectiveProfiles![0]={...data.effectiveProfiles![0]!,conceptCodes:body.conceptCodes,ncmCodes:body.ncmCodes,legacyFields:body.legacyFields,historicalCodes:[]};data.version++}return Response.json(data)}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(screen.getByText(/Produto aposentado, Arroz, NCM 2716, NCM 1006/)).toBeInTheDocument()
 expect(screen.getByText('Produtos informados anteriormente: Produto manual anterior')).toBeInTheDocument();expect(writes).toHaveLength(0)
 fireEvent.click(screen.getByRole('button',{name:'Editar escolhas — Matriz histórica'}))
 expect(screen.getByRole('checkbox',{name:/Produto aposentado/})).toBeChecked()
 fireEvent.click(screen.getByRole('checkbox',{name:/Produto aposentado/}));fireEvent.click(screen.getByRole('checkbox',{name:/NCM 2716/}));fireEvent.click(screen.getByRole('checkbox',{name:/Produto manual anterior/}))
 fireEvent.click(screen.getByRole('button',{name:'Salvar escolhas deste estabelecimento'}))
 await waitFor(()=>expect(writes).toHaveLength(1))
 expect(writes[0]).toMatchObject({selectionMode:'EFFECTIVE',expectedVersion:7,cardId:'profile',establishmentId:'head',conceptCodes:['product.rice'],ncmCodes:['1006'],legacyFields:{products:[],operations:['Revenda']}})
})
it('preselects all suggestions for an unreviewed card without persisting them',async()=>{
 const data=fixture();data.concepts.push({code:'product.bran',label:'Farelo',dimensionCode:'product',ncmCodes:['2302']});data.cards[0]!.suggestions.push({kind:'PRODUCT',target:'product.bran',segment:'Agropecuária'},{kind:'NCM',target:'2302',segment:'Agropecuária'},{kind:'NCM',target:'2716',segment:'Agropecuária'})
 data.effectiveProfiles=[{establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'NAO_INFORMADO',conceptCodes:['product.rice'],ncmCodes:[],legacyFields:{},cnaeSegments:[],historicalCodes:[]}]
 const api=vi.fn(async(url:RequestInfo|URL,_init?:RequestInit)=>Response.json(String(url).endsWith('/phrases')?{items:[]}:data))
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 expect(await screen.findByRole('checkbox',{name:/Arroz/})).toBeChecked();expect(api.mock.calls.filter(([,init])=>init?.method==='PUT')).toHaveLength(0)
 expect(screen.getByRole('checkbox',{name:'NCM 2716'})).toBeChecked();expect(screen.getByRole('checkbox',{name:/Farelo/})).toBeChecked()
})

it('mark all selects only products and their own evidence, leaving independent CNAE NCMs explicit',async()=>{
 const data=fixture();data.concepts.push({code:'product.bran',label:'Farelo',dimensionCode:'product',ncmCodes:['2302']})
 data.cards[0]!.suggestions.push({kind:'PRODUCT',target:'product.bran',segment:'Agropecuária'},{kind:'NCM',target:'2302',segment:'Agropecuária'},{kind:'NCM',target:'2716',segment:'Agropecuária'})
 const writes:unknown[]=[]
 const api=vi.fn(async(url:RequestInfo|URL,init?:RequestInit)=>{if(init?.method==='PUT'){writes.push(JSON.parse(String(init.body)));return Response.json({...data,version:8})}return Response.json(String(url).endsWith('/phrases')?{items:[]}:data)})
 render(<OnboardingAssistant apiFetch={api} tenantId="tenant" companyId="company" units={[unit]} onClose={vi.fn()} onSaved={vi.fn()}/>)
 fireEvent.click(await screen.findByRole('button',{name:'Marcar todos'}))
 expect(screen.getByRole('checkbox',{name:/Arroz/})).toBeChecked()
 expect(screen.getByRole('checkbox',{name:/Farelo/})).toBeChecked()
 expect(screen.getByRole('checkbox',{name:'NCM 2716'})).toBeChecked()
 fireEvent.click(screen.getByRole('button',{name:'Salvar e continuar'}))
 await screen.findByRole('heading',{name:'Tudo pronto! Confira seu perfil'})
 expect(writes).toEqual([{selectionMode:'EFFECTIVE',expectedVersion:7,releaseId:'release-19',cardId:'segment:sector.agro',status:'CONFIRMED',conceptCodes:[],ncmCodes:[],units:[{establishmentId:'head',conceptCodes:['product.rice','product.bran'],ncmCodes:['1006','2302','2716']}]}])
})
