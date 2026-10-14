import {expect,test} from '@playwright/test'

// MON/L18: screenshot uses mocked preview only; never calls the destructive endpoint.
test('F3 archive reapply renders one filter total and type samples without confirming',async({page},testInfo)=>{
  const policyId='11111111-1111-4111-8111-111111111111'
  await page.route('**/auth/refresh',r=>r.fulfill({json:{
    accessToken:'admin-token',tokenType:'Bearer',expiresIn:900,
  }}))
  await page.route('**/auth/me',r=>r.fulfill({json:{
    user:{id:'admin',email:'admin@example.test'},memberships:[],
  }}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v1/admin/collection-filter/**',r=>{
    const path=new URL(r.request().url()).pathname
    if(path.endsWith('/state')){
      const policy={
        id:policyId,status:'APPROVED',version:1,revision:5,
        rules:[{sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',
          mode:'KEEP_ALWAYS',helpText:null}],aliases:[],terms:[],
      }
      return r.fulfill({json:{policies:[policy],documents:{[policyId]:policy},newTypesOpen:0}})
    }
    if(path.endsWith('/new-types'))return r.fulfill({json:{items:[]}})
    if(path.endsWith('/out-of-scope/preview'))return r.fulfill({json:{
      count:60,token:'a'.repeat(64),outOfScope:0,
      hiddenLegacy:0,suspectDoe:0,ruleDiscards:60,byRule:[{sourceCode:"dou",section:"DO3",canonicalType:"EXTRATO",mode:"EXCLUDE_ALWAYS",count:60}],samples:[{id:"sample",title:"EXTRATO DE CONTRATO 33/2026",sourceCode:"dou",section:"DO3",canonicalType:"EXTRATO"}],
      blockedCompany:2,blockedOtherSource:3,
    }})
    if(path.endsWith('/out-of-scope/confirm'))throw new Error('L18 screenshot MUST NOT confirm a deletion')
    return r.fulfill({json:{items:[]}})
  })
  await page.goto('/admin/filtro-coleta')
  await page.getByRole('button',{name:'Reaplicar filtro ao acervo'}).click()
  const dialog=page.getByRole('dialog',{name:'Reaplicar filtro ao acervo'})
  await dialog.getByRole('button',{name:'Consultar quantidade'}).click()
  await expect(dialog.getByText('60 não passam no filtro atual / 5 protegidas')).toBeVisible()
  await expect(dialog.getByText('EXTRATO: EXTRATO DE CONTRATO 33/2026')).toBeVisible()
  await expect(dialog.getByText(/5 protegidas/)).toBeVisible()
  await page.screenshot({path:testInfo.outputPath('l18-preview.png'),fullPage:true})
})

