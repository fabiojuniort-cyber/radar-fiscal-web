import {expect,test,type Page} from '@playwright/test'
import {mkdir} from 'node:fs/promises'

/** F2-TAB-04: readonly API fixture. The very same test captures genuine
 * before (base-commit CSS/TSX) and after (PR-commit CSS/TSX) screenshots.
 * Runs automatically at all four configured Playwright viewport projects. */
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
      label:'Agropecuária, produção agrícola e comercialização de grãos e cereais com descrição extensa para teste responsivo',officialCodes:[]},
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
  const groups=[{id:'g1',code:'graos',dimensionCode:'sector',label:'Agropecuária, produção agrícola e comercialização de grãos e cereais com descrição extensa para teste responsivo / Grãos e cereais',displayOrder:1,
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

test('F2-TAB-04: CNAE subsegment and segment chip never overlap at any viewport', async({page},testInfo)=>{
  const row=await setup(page)
  const baseline=process.env.F2_TAB_04_BASELINE==='1'
  const file=`playwright-artifacts/f2-tab-04/${baseline?'before':'after'}/${testInfo.project.name}.png`
  await mkdir(file.slice(0,file.lastIndexOf('/')),{recursive:true})
  await page.screenshot({path:file,fullPage:true})
  if(baseline)return // baseline is expected to fail the new visual requirements

  const segmentLabel='Agropecuária, produção agrícola e comercialização de grãos e cereais com descrição extensa para teste responsivo'
  const subsegment=row.getByLabel('Subsegmento',{exact:true})
  await expect(subsegment).toHaveValue('Grãos e cereais')
  await expect(subsegment).toHaveAttribute('title','Grãos e cereais')
  await expect(row.locator('.tc-subsegment-context')).toHaveCount(0)
  await expect(row.getByText(segmentLabel+' – Grãos e cereais',{exact:true})).toHaveCount(0)
  const segmentCell=row.locator('td.is-segment')
  const chip=segmentCell.locator('.tc-chip').first()
  const label=chip.locator('.tc-chip-label')
  await expect(label).toHaveAttribute('title',segmentLabel)
  await expect(row.getByRole('button',{name:'Remover segmento sector.agro'})).toBeVisible()
  const dimensions=await segmentCell.evaluate((cell)=>{
    const chip=cell.querySelector<HTMLElement>('.tc-chip')!
    const label=chip.querySelector<HTMLElement>('.tc-chip-label')!
    const button=chip.querySelector<HTMLElement>('button')!
    const next=cell.nextElementSibling as HTMLElement
    const c=cell.getBoundingClientRect(),h=chip.getBoundingClientRect(),l=label.getBoundingClientRect(),b=button.getBoundingClientRect(),n=next.getBoundingClientRect()
    return {cellRight:c.right,chipRight:h.right,chipLeft:h.left,cellLeft:c.left,
      buttonRight:b.right,labelRight:l.right,nextLeft:n.left,
      chipWidth:h.width,labelWidth:l.width,labelScroll:label.scrollWidth}
  })
  expect(dimensions.chipLeft).toBeGreaterThanOrEqual(dimensions.cellLeft-2)
  expect(dimensions.chipRight).toBeLessThanOrEqual(dimensions.cellRight+2)
  expect(dimensions.buttonRight).toBeLessThanOrEqual(dimensions.chipRight+1)
  expect(dimensions.labelRight).toBeLessThanOrEqual(dimensions.buttonRight+1)
  expect(dimensions.cellRight).toBeLessThanOrEqual(dimensions.nextLeft+2)
  expect(dimensions.labelScroll).toBeGreaterThanOrEqual(dimensions.labelWidth)
})
