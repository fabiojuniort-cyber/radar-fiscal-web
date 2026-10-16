import { expect, test, type Page } from '@playwright/test'

const policyId='11111111-1111-4111-8111-111111111111'
const newTypeId='22222222-2222-4222-8222-222222222222'
const tokenA='a'.repeat(64)
const tokenB='b'.repeat(64)
const confirmationA='c'.repeat(64)
const confirmationB='d'.repeat(64)

async function setup(page:Page,drift=false) {
  let portariaMode='KEEP_IF_TAX_TERM'
  let resolved=false
  let previews=0
  let purgeAttempts=0
  const saveBodies:Record<string,unknown>[]=[]
  await page.route('**/auth/refresh',r=>r.fulfill({json:{accessToken:'admin-token',tokenType:'Bearer',expiresIn:900}}))
  await page.route('**/auth/me',r=>r.fulfill({json:{user:{id:'admin',email:'admin@example.test'},memberships:[]}}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v1/admin/collection-filter/**',async r=>{
    const url=new URL(r.request().url())
    const pathname=url.pathname
    const method=r.request().method()
    if(method==='POST'&&pathname.endsWith('/direct-rule/preview')){
      previews+=1
      return r.fulfill({json:{
        count:drift&&previews>1?3:2,blockedCompany:2,blockedOtherSource:1,
        token:drift&&previews>1?tokenB:tokenA,
        confirmationToken:drift&&previews>1?confirmationB:confirmationA,
        policyRevision:drift&&previews>1?6:5,
        samples:[{id:'publication-1',title:'EXTRATO DE CONVÊNIO',sourceCode:'dou',
          section:'DO1',officialType:'EXTRATO DE CONVÊNIO',
          pattern:'PORTARIA',protection:null}],
      }})
    }
    if(method==='POST'&&pathname.endsWith('/direct-rule/save')){
      const body=r.request().postDataJSON() as Record<string,unknown>
      saveBodies.push(body)
      if(drift&&saveBodies.length===1){
        return r.fulfill({status:409,json:{error:'f3_policy_revision_changed'}})
      }
      if(body.canonicalType==='PORTARIA')portariaMode=body.mode as string
      if(body.newTypeId===newTypeId)resolved=true
      return r.fulfill({json:{revision:drift?7:6,deletedCount:0,
        historicalPurgeRequired:true}})
    }
    if(method==='POST'&&pathname.endsWith('/direct-rule/confirm')){
      purgeAttempts+=1
      return r.fulfill({status:403,json:{error:'historical_purge_forbidden_in_save_test'}})
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
  await expect(page.getByRole('heading',{name:'Nomes de ato'})).toBeVisible()
  await expect(page.getByLabel('Modo PORTARIA')).toBeVisible()
  return {saveBodies,getPreviews:()=>previews,getPurgeAttempts:()=>purgeAttempts}
}

test('F3 Tipos: prévia mostra protegidas e salvar classificação não exclui histórico',async({page})=>{
  const {saveBodies,getPreviews,getPurgeAttempts}=await setup(page)
  await page.getByLabel('Modo PORTARIA').selectOption('EXCLUDE_ALWAYS')
  const dialog=page.getByRole('dialog',{name:'Classificar Nome do ato'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Fonte')).toHaveValue('dou')
  await expect(dialog.getByLabel('Seção')).toHaveValue('DO1')
  await expect(dialog.getByLabel('Nome do ato')).toHaveValue('PORTARIA')
  await dialog.getByRole('button',{name:'Consultar prévia F3'}).click()
  await expect(dialog.getByRole('status')).toContainText('2 publicações históricas correspondem à regra')
  await expect(dialog.getByRole('status')).toContainText('Não serão apagadas ao salvar')
  await expect(dialog.getByRole('status')).toContainText('3 protegidas')
  await expect(dialog.getByRole('status')).toContainText('2 com empresa cliente')
  await expect(dialog.getByRole('status')).toContainText('1 com outra origem oficial')
  await expect(dialog.getByRole('status')).toContainText('EXTRATO DE CONVÊNIO')
  expect(getPreviews()).toBe(1)
  expect(saveBodies).toHaveLength(0)
  await dialog.getByRole('button',{name:'Salvar classificação sem excluir'}).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Modo PORTARIA')).toHaveValue('EXCLUDE_ALWAYS')
  expect(saveBodies).toHaveLength(1)
  expect(saveBodies[0]).toMatchObject({sourceCode:'dou',section:'DO1',
    canonicalType:'PORTARIA',mode:'EXCLUDE_ALWAYS',expectedCount:2,
    previewToken:tokenA,confirmationToken:confirmationA,policyRevision:5})
  expect(getPurgeAttempts()).toBe(0)
})

test('F3 Novos tipos: prévia vencida bloqueia save e exige nova prévia/confirmação',async({page})=>{
  const {saveBodies,getPreviews,getPurgeAttempts}=await setup(page,true)
  await page.getByRole('button',{name:/Novos tipos/}).click()
  await expect(page.getByRole('heading',{name:'Novos tipos'})).toBeVisible()
  await page.getByRole('button',{name:'Classificar'}).click()
  await expect(page.getByRole('dialog',{name:'Classificar novo Nome do ato'})).toHaveCount(0)
  const dialog=page.getByRole('dialog',{name:'Classificar Nome do ato'})
  await expect(dialog.getByLabel('Nome do ato')).toHaveValue('Ato Novo')
  await dialog.getByLabel('Modo').selectOption('EXCLUDE_UNLESS_STRONG')
  await dialog.getByRole('button',{name:'Consultar prévia F3'}).click()
  await expect(dialog.getByRole('status')).toContainText('2 publicações históricas correspondem à regra')
  await dialog.getByRole('button',{name:'Salvar classificação sem excluir'}).click()
  await expect(dialog.getByRole('alert')).toContainText('f3_policy_revision_changed')
  await expect(dialog.getByRole('status')).toHaveCount(0)
  await expect(dialog.getByRole('button',{name:'Consultar prévia F3'})).toBeVisible()
  expect(getPreviews()).toBe(1)
  expect(saveBodies).toHaveLength(1)
  expect(saveBodies[0]).toMatchObject({newTypeId,expectedCount:2,
    previewToken:tokenA,confirmationToken:confirmationA,policyRevision:5})
  expect(getPurgeAttempts()).toBe(0)
  await dialog.getByRole('button',{name:'Consultar prévia F3'}).click()
  await expect(dialog.getByRole('status')).toContainText('3 publicações históricas correspondem à regra')
  await expect(dialog.getByRole('status')).toContainText('Revisão da política: 6')
  await dialog.getByRole('button',{name:'Salvar classificação sem excluir'}).click()
  await expect(dialog).toHaveCount(0)
  expect(getPreviews()).toBe(2)
  expect(saveBodies).toHaveLength(2)
  expect(saveBodies[1]).toMatchObject({newTypeId,expectedCount:3,
    previewToken:tokenB,confirmationToken:confirmationB,policyRevision:6,
    mode:'EXCLUDE_UNLESS_STRONG'})
  expect(getPurgeAttempts()).toBe(0)
  await expect(page.getByText('Nenhum tipo novo pendente.')).toBeVisible()
})
