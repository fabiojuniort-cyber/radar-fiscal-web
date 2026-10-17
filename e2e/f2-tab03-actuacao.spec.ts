import {expect,test,type Page} from '@playwright/test';

/** F2-TAB-03: all requests mocked; published v1.7.0 is not written. */
async function setup(page:Page){
 const draft={id:'draft-v18',version:'v1.8.0',status:'DRAFT',createdAt:'2026-10-15T01:00:00Z',publishedAt:null};
 const published={...draft,id:'published-v17',version:'v1.7.0',status:'PUBLISHED'};
 const state={published,draft,curatorDatabase:true,
  settings:{classificationEnabled:false,classificationExcludedSources:[]},
  progress:{total:0,classified:0,pending:0,withoutTags:0,failed:0,excluded:0},catalogs:[]};
 const dimensions=[
  {id:'d-sector',code:'sector',name:'Segmento',profileVisible:true,profileOrder:1,
   officialCodeType:'CNAE',usesGroups:true,detailSection:'Segmentos',detailOrder:1,
   conceptCount:2,helpText:'',description:null,revisionNo:1,configured:true},
  {id:'d-atuacao',code:'actuacao',name:'Atuação',profileVisible:false,profileOrder:2,
   officialCodeType:null,usesGroups:false,detailSection:'Atuação',detailOrder:1,
   conceptCount:2,helpText:'',description:null,revisionNo:1,configured:true},
 ];
 const base={membershipStatus:'INCLUDED',aliases:[],groupId:null,profileVisible:true,
  classifyByLabel:true,displayOrder:1,definition:'',governanceStatus:'APPROVED',
  evidenceStatus:'DOCUMENTED',officialCodes:[]};
 let actuacaoCodes=['actuacao.produtor_rural'];
 const concepts=[
  {...base,releaseConceptId:'rc-sector',code:'sector.agro',dimensionCode:'sector',label:'Agropecuária'},
  {...base,releaseConceptId:'rc-cnae',code:'sector.cnae_0111301',dimensionCode:'sector',
   label:'Cultivo de arroz',groupId:'g1',officialCodes:['0111301']},
  {...base,releaseConceptId:'rc-act-a',code:'actuacao.produtor_rural',dimensionCode:'actuacao',label:'Produtor rural'},
  {...base,releaseConceptId:'rc-act-b',code:'actuacao.servico',dimensionCode:'actuacao',label:'Serviço'},
 ];
 const groups=[{id:'g1',code:'graos',dimensionCode:'sector',label:'Grãos e cereais',
  displayOrder:1,officialCodes:[],segmentCodes:['sector.agro'],helpText:null,detailSection:null}];
 const changed:Array<{cnae:string;actuacaoCodes:string[]}>=[];
 let publishedWrites=0;
 await page.route('**/auth/refresh',r=>r.fulfill({json:{accessToken:'admin-token',tokenType:'Bearer',expiresIn:900}}));
 await page.route('**/auth/me',r=>r.fulfill({json:{user:{id:'admin',email:'admin@example.test'},memberships:[]}}));
 await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true,taxonomyCurator:true,licenseBypass:true,curatorDatabase:true}}));
 await page.route('**/api/v1/admin/taxonomy/**',r=>{
  const url=new URL(r.request().url());
  if(r.request().method()!=='GET'&&url.pathname.includes('published-v17'))publishedWrites++;
  if(url.pathname.endsWith('/state'))return r.fulfill({json:state});
  if(url.pathname.endsWith('/releases/draft-v18'))return r.fulfill({json:{
   release:draft,dimensions,groups,
   concepts:concepts.map(c=>c.code==='sector.cnae_0111301'?{
    ...c,f2Source:{atuacao:'Produtor rural',actuacaoCodes,
     suggestedProducts:'Arroz',suggestedNcms:'1006'},
   }:c),
  }});
  if(url.pathname.endsWith('/rows'))return r.fulfill({json:{
   created:[],updated:0,retired:0,groupsCreated:0,
  }});
  if(url.pathname.endsWith('/cnaes/0111301/actuacoes')&&r.request().method()==='PATCH'){
   const body=r.request().postDataJSON() as {actuacaoCodes:string[]};
   actuacaoCodes=body.actuacaoCodes;
   changed.push({cnae:'0111301',actuacaoCodes});
   return r.fulfill({json:{draftId:'draft-v18',cnaeCode:'0111301',actuacaoCodes,published:false}});
  }
  return r.fulfill({status:403,json:{error:'unexpected_f2_tab03_request'}});
 });
 await page.goto('/admin/taxonomia');
 await expect(page.getByRole('table',{name:'Itens de Segmento'})).toBeVisible();
 return {changed,getPublishedWrites:()=>publishedWrites};
}

test('F2-TAB-03: CNAE accepts many Atuacoes, last chip protected, saves to v1.8 draft only',async({page})=>{
 const ctx=await setup(page);
 const grid=page.getByRole('table',{name:'Itens de Segmento'});
 const row=grid.locator('tbody tr').filter({has:grid.getByLabel('Descrição do CNAE')}).first();
 const initial=row.getByRole('button',{name:'Remover Atuação actuacao.produtor_rural'});
 await expect(initial).toBeVisible();
 await expect(initial).toBeDisabled();
 const input=row.getByLabel('Adicionar Atuação');
 await input.fill('Serviço');
 await input.press('Enter');
 await expect(row.getByRole('button',{name:'Remover Atuação actuacao.servico'})).toBeVisible();
 await expect(initial).toBeEnabled();
 await initial.click();
 await expect(row.getByRole('button',{name:'Remover Atuação actuacao.produtor_rural'})).toHaveCount(0);
 await expect(row.getByRole('button',{name:'Remover Atuação actuacao.servico'})).toBeDisabled();
 await expect(row.getByLabel('Subsegmento')).toHaveValue('Grãos e cereais');
 await expect(row.getByLabel('Segmento e subsegmento')).toHaveCount(0);
 await page.getByRole('button',{name:/Salvar alterações/}).click();
 await expect.poll(()=>ctx.changed.length).toBe(1);
 expect(ctx.changed[0]).toEqual({cnae:'0111301',actuacaoCodes:['actuacao.servico']});
 expect(ctx.getPublishedWrites()).toBe(0);
});
