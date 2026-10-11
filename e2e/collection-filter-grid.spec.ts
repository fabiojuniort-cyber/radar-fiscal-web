import { expect, test, type Page } from '@playwright/test'

const policyId='11111111-1111-4111-8111-111111111111'
const newTypeId='22222222-2222-4222-8222-222222222222'
const tokenA='a'.repeat(64)
const tokenB='b'.repeat(64)

async function setup(page:Page, drift=false) {
  let portariaMode='KEEP_IF_TAX_TERM'
  let resolved=false
  const confirmationBodies:Record<string,unknown>[]=[]
  await page.route('**/auth/refresh',r=>r.fulfill({json:{accessToken:'admin-token',tokenType:'Bearer',expiresIn:900}}))
  await page.route('**/auth/me',r=>r.fulfill({json:{user:{id:'admin',email:'admin@example.test'},memberships:[]}}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v1/admin/collection-filter/**',async r=>{
    const url=new URL(r.request().url())
    const pathname=url.pathname
    const method=r.request().method()
    if(method==='POST'&&pathname.endsWith('/direct-rule/preview')){
      return r.fulfill({json:{count:2,blockedCompany:2,blockedOtherSource:1,token:tokenA}})
    }
    if(method==='POST'&&pathname.endsWith('/direct-rule/confirm')){
      const body=r.request().postDataJSON() as Record<string,unknown>
      confirmationBodies.push(body)
      if(drift&&confirmationBodies.length===1){
        return r.fulfill({json:{changed:true,count:3,blockedCompany:2,blockedOtherSource:1,token:tokenB,deletedCount:0}})
      }
      if(body.canonicalType==='PORTARIA')portariaMode=body.mode as string
      if(body.newTypeId===newTypeId)resolved=true
      return r.fulfill({json:{changed:false,apagadas:drift?3:2,restantes:0,deletedCount:drift?3:2,revision:6}})
    }
    if(method==='GET'&&pathname.endsWith('/state')){
      const policy={
        id:policyId,version:1,revision:5,status:'APPROVED',
        rules:[
          {sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:portariaMode,helpText:null},
          {sourceCode:'dou',section:'DO1',canonicalType:'DECRETO',mode:'KEEP_ALWAYS',helpText:null},
        ],
        aliases:[],terms:[{text:'ICMS',strength:'STRONG',locationScope:'ANY'}],
      }
      return r.fulfill({json:{policies:[policy],documents:{[policyId]:policy},newTypesOpen:resolved?0:1}})
    }
    if(method==='GET'&&pathname.endsWith('/new-types')){
      return r.fulfill({json:{items:resolved?[]:[{
        id:newTypeId,source_code:'dou',section:'DO1',normalized_type:'ATO NOVO',
        sample_raw_type:'Ato Novo',occurrence_count:7,status:'OPEN',
      }]}})
    }
    return r.fulfill({json:{items:[]}})
  })
  await page.goto('/admin/filtro-coleta')
  await expect(page.getByRole('heading',{name:'Filtro de coleta'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Tipos de ato'})).toBeVisible()
  await expect(page.getByLabel('Modo PORTARIA')).toBeVisible()
  return {confirmationBodies}
}

test('L-11 Tipos: editar modo somente após prévia, mostrando X e Y protegidas e motivos',async({page})=>{
  const {confirmationBodies}=await setup(page)
  await page.getByLabel('Modo PORTARIA').selectOption('EXCLUDE_ALWAYS')
  const dialog=page.getByRole('dialog',{name:'Classificar tipo de publicação'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Fonte')).toHaveValue('dou')
  await expect(dialog.getByLabel('Seção')).toHaveValue('DO1')
  await expect(dialog.getByLabel('Tipo')).toHaveValue('PORTARIA')
  await dialog.getByRole('button',{name:'Consultar quantidade'}).click()
  await expect(dialog.getByRole('status')).toContainText('2 publicações serão apagadas')
  await expect(dialog.getByRole('status')).toContainText('3 protegidas (não serão apagadas)')
  await expect(dialog.getByRole('status')).toContainText('2 com vínculo a empresa cliente')
  await expect(dialog.getByRole('status')).toContainText('1 também possuem origem em outra fonte oficial')
  expect(confirmationBodies).toHaveLength(0)
  await dialog.getByRole('button',{name:'Confirmar classificação e exclusão'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Modo PORTARIA')).toHaveValue('EXCLUDE_ALWAYS')
  expect(confirmationBodies).toHaveLength(1)
  expect(confirmationBodies[0]).toMatchObject({sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'EXCLUDE_ALWAYS',expectedCount:2,previewToken:tokenA})
})

test('L-11 Novos tipos: divergência de contagem exige segunda confirmação',async({page})=>{
  const {confirmationBodies}=await setup(page,true)
  await page.getByRole('button',{name:/Novos tipos/}).click()
  await expect(page.getByRole('heading',{name:'Novos tipos'})).toBeVisible()
  await page.getByRole('button',{name:'Classificar'}).click()
  const choose=page.getByRole('dialog',{name:'Classificar novo tipo'})
  await expect(choose).toBeVisible()
  await choose.getByRole('button',{name:'Confirmar classificação'}).click()
  const dialog=page.getByRole('dialog',{name:'Classificar tipo de publicação'})
  await expect(dialog.getByLabel('Tipo')).toHaveValue('ATO NOVO')
  await dialog.getByLabel('Modo').selectOption('EXCLUDE_UNLESS_STRONG')
  await dialog.getByRole('button',{name:'Consultar quantidade'}).click()
  await expect(dialog.getByRole('status')).toContainText('2 publicações serão apagadas')
  await dialog.getByRole('button',{name:'Confirmar classificação e exclusão'}).click()
  await expect(dialog.getByRole('alert')).toContainText('A quantidade mudou para 3')
  await expect(dialog.getByRole('status')).toContainText('3 publicações serão apagadas')
  expect(confirmationBodies).toHaveLength(1)
  await dialog.getByRole('button',{name:'Confirmar classificação e exclusão'}).click()
  await expect(dialog).toHaveCount(0)
  expect(confirmationBodies).toHaveLength(2)
  expect(confirmationBodies[1]).toMatchObject({newTypeId,expectedCount:3,previewToken:tokenB,mode:'EXCLUDE_UNLESS_STRONG'})
  await expect(page.getByText('Nenhum tipo novo pendente.')).toBeVisible()
})
