import {expect,test,type Page} from '@playwright/test'

/** F2-TAB-01: frontend-only e2e; all API calls mocked, zero DB writes. */
async function setup(page:Page,largeProduct=false){
  await page.route('**/auth/refresh',r=>r.fulfill({json:{accessToken:'admin-token',tokenType:'Bearer',expiresIn:900}}))
  await page.route('**/auth/me',r=>r.fulfill({json:{user:{id:'admin',email:'admin@example.test'},memberships:[]}}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true,taxonomyCurator:true,licenseBypass:true,curatorDatabase:true}}))
  const release={id:'52791d3b-afdc-496f-8ada-c6cd5c819dff',version:'v1.7.0',status:'DRAFT',createdAt:'2026-10-15T01:00:00Z',publishedAt:null}
  const state={published:{...release,id:'published',version:'v1.6.0',status:'PUBLISHED'},draft:release,
    curatorDatabase:true,settings:{classificationEnabled:false,classificationExcludedSources:[]},
    progress:{total:0,classified:0,pending:0,withoutTags:0,failed:0,excluded:0},catalogs:[]}
  const dimensions=[
    {id:'d-sector',code:'sector',name:'Segmento',profileVisible:true,profileOrder:1,
      officialCodeType:'CNAE',usesGroups:true,detailSection:'Segmentos',detailOrder:1,conceptCount:3,
      helpText:'',description:null,revisionNo:1,configured:true},
    {id:'d-treatment',code:'treatment',name:'Tratamento',profileVisible:false,profileOrder:5,
      officialCodeType:null,usesGroups:false,detailSection:'Benefícios',detailOrder:1,conceptCount:1,
      helpText:'',description:null,revisionNo:1,configured:true},
  ]
  if(largeProduct)dimensions.push({id:'d-product',code:'product',name:'Produto',
    profileVisible:true,profileOrder:3,officialCodeType:'NCM',usesGroups:true,
    detailSection:'Produtos',detailOrder:3,conceptCount:4208,helpText:'',description:null,
    revisionNo:1,configured:true})
  const base={membershipStatus:'INCLUDED',aliases:[],groupId:null,profileVisible:true,classifyByLabel:true,
    displayOrder:1,definition:'',governanceStatus:'APPROVED',evidenceStatus:'DOCUMENTED',officialCodes:[]}
  const concepts=[
    {...base,releaseConceptId:'rc-agro',code:'sector.agro',dimensionCode:'sector',
      label:'Agropecuária',officialCodes:[]},
    {...base,releaseConceptId:'rc-ind',code:'sector.industria',dimensionCode:'sector',
      label:'Indústria',officialCodes:[]},
    {...base,releaseConceptId:'rc-cnae',code:'sector.cnae_0111301',dimensionCode:'sector',
      label:'Cultivo de arroz',groupId:'g1',groupCode:'graos',officialCodes:['0111301'],
      aliases:[{text:'plantação de arroz',aliasType:'EXACT_LEXICAL'}],
      f2Source:{atuacao:'Produtor rural',suggestedProducts:'Arroz;Milho',suggestedNcms:'1006;100590'}},
    {...base,releaseConceptId:'rc-trt',code:'treatment.example',dimensionCode:'treatment',label:'Antigo'},
  ]
  if(largeProduct)for(let i=0;i<4208;i++)concepts.push({
    ...base,releaseConceptId:`rc-product-${i}`,code:`product.item_${i}`,
    dimensionCode:'product',label:`Produto ${String(i).padStart(4,'0')}`,
    groupId:null,groupCode:null,aliases:[],officialCodes:[String(10000000+i)],
  })
  const groups=[{id:'g1',code:'graos',dimensionCode:'sector',label:'Grãos',displayOrder:1,
    officialCodes:[],segmentCodes:['sector.agro'],helpText:null,detailSection:null}]
  const view={release,dimensions,concepts,groups}
  await page.route('**/api/v1/admin/taxonomy/**',r=>{
    const url=new URL(r.request().url())
    if(url.pathname.endsWith('/state'))return r.fulfill({json:state})
    if(url.pathname.endsWith('/releases/'+release.id))return r.fulfill({json:view})
    return r.fulfill({status:403,json:{error:'readonly_playwright_test'}})
  })
  await page.goto('/admin/taxonomia')
  await expect(page.getByRole('heading',{name:'Curadoria da Taxonomia'})).toBeVisible()
  await expect(page.getByRole('table',{name:'Itens de Segmento'})).toBeVisible()
  return page.locator('table.tc-grid tbody tr').filter({has:page.getByLabel('Descrição do CNAE')}).first()
}

test('F2-TAB-01: chips permitem adicionar/remover CNAE, sinônimo e segmento sem salvar',async({page})=>{
  const row=await setup(page)
  const code=row.getByRole('textbox',{name:'Adicionar CNAE'})
  await code.fill('0211201')
  await code.press('Enter')
  await expect(row.getByRole('button',{name:'Remover CNAE 0211201'})).toBeVisible()
  await row.getByRole('button',{name:'Remover CNAE 0211201'}).click()
  await expect(row.getByRole('button',{name:'Remover CNAE 0211201'})).toHaveCount(0)

  const synonym=row.getByRole('textbox',{name:'Adicionar sinônimo'})
  await synonym.fill('rizicultura')
  await synonym.press('Enter')
  await expect(row.getByRole('button',{name:'Remover sinônimo rizicultura'})).toBeVisible()
  await row.getByRole('button',{name:'Remover sinônimo rizicultura'}).click()
  await expect(row.getByRole('button',{name:'Remover sinônimo rizicultura'})).toHaveCount(0)

  const segment=row.getByRole('combobox',{name:'Adicionar segmento'})
  await row.getByRole('button',{name:'Remover segmento sector.agro'}).click()
  await segment.fill('Indústria')
  await segment.press('Enter')
  await expect(row.getByRole('button',{name:'Remover segmento sector.industria'})).toBeVisible()
  await row.getByRole('button',{name:'Remover segmento sector.industria'}).click()
  await expect(row.getByRole('button',{name:'Remover segmento sector.industria'})).toHaveCount(0)

  await expect(row.getByText('Arroz',{exact:true})).toBeVisible()
  await expect(row.getByText('100590',{exact:true})).toBeVisible()
  await expect(row.getByRole('button',{name:/Remover NCM sugerida/})).toHaveCount(0)
  await expect(page.getByRole('button',{name:/Tratamento/})).toHaveCount(0)
  await expect(page.getByText('Vínculos CNAE da fonte aprovada')).toHaveCount(0)
})

test('F2-TAB-02 B1: edição de chips Produtos/NCM sugeridos, sem mexer no staging',async({page})=>{
  const row=await setup(page)
  const addProduct=row.getByRole('textbox',{name:'Adicionar produto sugerido'})
  await addProduct.fill('Soja')
  await addProduct.press('Enter')
  await expect(row.getByRole('button',{name:'Remover produto sugerido Soja'})).toBeVisible()
  await row.getByRole('button',{name:'Remover produto sugerido Soja'}).click()
  await expect(row.getByRole('button',{name:'Remover produto sugerido Soja'})).toHaveCount(0)
  const addNcm=row.getByRole('textbox',{name:'Adicionar NCM sugerida'})
  await addNcm.fill('01234567')
  await addNcm.press('Enter')
  await expect(row.getByRole('button',{name:'Remover NCM sugerida 01234567'})).toBeVisible()
  await row.getByRole('button',{name:'Remover NCM sugerida 01234567'}).click()
  await expect(row.getByRole('button',{name:'Remover NCM sugerida 01234567'})).toHaveCount(0)
})

test('F2-TAB-02 B1/B3: Produto Item chips + página com 4208 conceitos abre até 2s',async({page})=>{
  await setup(page,true)
  const start=Date.now()
  await page.getByRole('button',{name:/Produto.*4208 itens/}).click()
  await expect(page.getByRole('table',{name:'Itens de Produto'})).toBeVisible()
  const grid=page.getByRole('table',{name:'Itens de Produto'})
  await expect(grid.locator('tbody tr')).toHaveCount(50)
  expect(Date.now()-start).toBeLessThan(2000)
  const row=grid.locator('tbody tr').first()
  const addItem=row.getByRole('textbox',{name:'Adicionar item'})
  await addItem.fill('Produto equivalente')
  await addItem.press('Enter')
  await expect(row.getByRole('button',{name:'Remover item Produto equivalente'})).toBeVisible()
  await row.getByRole('button',{name:'Remover item Produto equivalente'}).click()
  await expect(row.getByRole('button',{name:'Remover item Produto equivalente'})).toHaveCount(0)
})
