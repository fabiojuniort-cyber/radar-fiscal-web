import { expect, test, type Page } from '@playwright/test'

type Kind = 'scope' | 'direct'
type Scenario = 'auto' | 'pause' | 'error'
const id='11111111-1111-4111-8111-111111111111'

async function prepare(page:Page,kind:Kind,scenario:Scenario) {
  let remaining=1050
  let confirms=0
  let releaseFirst!:()=>void
  const firstPending=new Promise<void>(resolve=>{releaseFirst=resolve})
  await page.route('**/auth/refresh',r=>r.fulfill({json:{
    accessToken:'admin-token',tokenType:'Bearer',expiresIn:900,
  }}))
  await page.route('**/auth/me',r=>r.fulfill({json:{
    user:{id:'admin',email:'admin@example.test'},memberships:[],
  }}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v1/admin/collection-filter/**',async r=>{
    const path=new URL(r.request().url()).pathname
    if(path.endsWith('/state')) {
      const policy={
        id,status:'APPROVED',version:1,revision:5,
        rules:[{sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',
          mode:'KEEP_ALWAYS',helpText:null}],
        aliases:[],terms:[],
      }
      return r.fulfill({json:{policies:[policy],documents:{[id]:policy},newTypesOpen:0}})
    }
    if(path.endsWith('/new-types'))return r.fulfill({json:{items:[]}})
    if(path.endsWith('/out-of-scope/preview')||path.endsWith('/direct-rule/preview')){
      return r.fulfill({json:{
        count:remaining,token:'token-'+confirms,
        outOfScope:remaining,hiddenLegacy:0,ruleDiscards:0,byRule:[],
        blockedCompany:2,blockedOtherSource:1,
      }})
    }
    if(path.endsWith('/out-of-scope/confirm')||path.endsWith('/direct-rule/confirm')){
      confirms+=1
      if(scenario==='pause'&&confirms===1)await firstPending
      if(scenario==='error'&&confirms===2){
        return r.fulfill({status:503,json:{error:'temporary_unavailable'}})
      }
      const amount=Math.min(500,remaining)
      remaining-=amount
      return r.fulfill({json:{changed:false,apagadas:amount,restantes:remaining,deletedCount:amount}})
    }
    return r.fulfill({json:{items:[]}})
  })
  await page.goto('/admin/filtro-coleta')
  await expect(page.getByRole('heading',{name:'Tipos de ato'})).toBeVisible()
  if(kind==='scope'){
    await page.getByRole('button',{name:'Apagar fora do escopo'}).click()
  } else {
    await page.getByLabel('Modo PORTARIA').selectOption('EXCLUDE_ALWAYS')
  }
  const dialog=page.getByRole('dialog',{name:kind==='scope'?'Apagar fora do escopo':'Classificar tipo de publicação'})
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button',{name:'Consultar quantidade'}).click()
  await expect(dialog.getByText(kind==='scope'?/1.050 fora do escopo/:/1050 publicações serão apagadas/)).toBeVisible()
  return {
    dialog,
    confirmLabel:kind==='scope'?'Confirmar exclusão':'Confirmar classificação e exclusão',
    getConfirms:()=>confirms,
    releaseFirst,
  }
}

for(const kind of ['scope'] as const){
  test('L11/L17 '+kind+' advances separate 500-item batches automatically to zero',async({page})=>{
    const {dialog,confirmLabel,getConfirms}=await prepare(page,kind,'auto')
    await dialog.getByRole('button',{name:confirmLabel}).click()
    await expect(dialog).toHaveCount(0)
    expect(getConfirms()).toBe(3)
  })

  test('L11/L17 '+kind+' Pausar stops after active batch, Continue resumes',async({page})=>{
    const {dialog,confirmLabel,getConfirms,releaseFirst}=await prepare(page,kind,'pause')
    await dialog.getByRole('button',{name:confirmLabel}).click()
    await expect.poll(getConfirms).toBe(1)
    await dialog.getByRole('button',{name:'Pausar'}).click()
    releaseFirst()
    await expect(dialog.getByRole('button',{name:'Continuar'})).toBeVisible()
    await expect(dialog.getByText(/500 de 1.050 apagadas/)).toBeVisible()
    expect(getConfirms()).toBe(1)
    await dialog.getByRole('button',{name:'Continuar'}).click()
    await expect(dialog).toHaveCount(0)
    expect(getConfirms()).toBe(3)
  })

  test('L11/L17 '+kind+' stops on HTTP 503 with step and explicitly Continues',async({page})=>{
    const {dialog,confirmLabel,getConfirms}=await prepare(page,kind,'error')
    await dialog.getByRole('button',{name:confirmLabel}).click()
    await expect(dialog.getByRole('alert')).toContainText('Etapa 2: HTTP 503')
    expect(getConfirms()).toBe(2)
    await dialog.getByRole('button',{name:'Continuar'}).click()
    await expect(dialog).toHaveCount(0)
    expect(getConfirms()).toBe(4)
  })
}
