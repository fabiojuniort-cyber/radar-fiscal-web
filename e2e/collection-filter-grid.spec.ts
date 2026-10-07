import { expect, test, type Page } from '@playwright/test'

const policy = {
  id:'11111111-1111-4111-8111-111111111111',version:1,revision:5,status:'APPROVED',
  contextWindowWords:27,weakScoreThreshold:8,locationWeights:{title:7,summary:5,body:2},changeNotes:'Atual',aliases:[],
  rules:[{sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'KEEP_IF_TAX_TERM',helpText:null},
    {sourceCode:'dou',section:'DO1',canonicalType:'DECRETO',mode:'KEEP_ALWAYS',helpText:null}],
  terms:[{text:'ICMS',strength:'STRONG',sourceCode:null,section:null,canonicalType:null,locationScope:'ANY'}],
}
async function setup(page:Page) {
  const writes:Array<{url:string;body:Record<string,unknown>}> = []
  let expanded=false
  await page.route('**/auth/refresh',r=>r.fulfill({json:{accessToken:'admin-token',tokenType:'Bearer',expiresIn:900}}))
  await page.route('**/auth/me',r=>r.fulfill({json:{user:{id:'admin',email:'admin@example.test'},memberships:[]}}))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v2/archive/**',r=> {
    const url=new URL(r.request().url())
    if(url.pathname.endsWith('/facets')) return r.fulfill({json:{sources:[{code:'dou',name:'DOU'},...(expanded?[{code:'doe',name:'DOE'}]:[])],actTypes:['PORTARIA','DECRETO'],ufs:[]}})
    const values=url.searchParams.get('source')==='doe'?['RESOLUCAO']:['PORTARIA','DECRETO',...(expanded?['INSTRUCAO NORMATIVA']:[])]
    return r.fulfill({json:{items:values.map(value=>({value,label:value,count:1}))}})
  })
  await page.route('**/api/v1/admin/collection-filter/**',r=>{
    const url=r.request().url()
    if(r.request().method()!=='GET') {writes.push({url,body:r.request().postDataJSON()});return r.fulfill({json:{policyId:policy.id,version:2,revision:1}})}
    if(url.endsWith('/state')) return r.fulfill({json:{policies:[policy],documents:{[policy.id]:policy},simulations:[],newTypesOpen:1}})
    return r.fulfill({json:{items:[{id:'22222222-2222-4222-8222-222222222222',source_code:'dou',section:'DO1',normalized_type:'ATO NOVO',sample_raw_type:'Ato Novo',occurrence_count:1,status:'OPEN'}]}})
  })
  await page.goto('/admin/filtro-coleta')
  await expect(page.getByRole('table',{name:'Tipos de ato',exact:true})).toBeVisible()
  return {writes,expand:()=>{expanded=true}}
}

test('ALV filters, filtered export, atomic CSV preview and hidden criteria survive save',async({page})=>{
  const {writes}=await setup(page)
  await expect(page.getByRole('spinbutton')).toHaveCount(0)
  await page.getByRole('button',{name:'Ordenar Tipo',exact:true}).click()
  await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('DECRETO')
  await page.getByRole('button',{name:'Filtrar Tipo',exact:true}).click()
  let dialog=page.getByRole('dialog')
  await dialog.getByLabel('DECRETO',{exact:true}).uncheck()
  await dialog.getByRole('button',{name:'Aplicar filtro'}).click()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1)
  await page.getByLabel('Modo PORTARIA').selectOption('EXCLUDE_ALWAYS')
  const downloadPromise=page.waitForEvent('download')
  await page.getByRole('button',{name:'Exportar CSV'}).click()
  const download=await downloadPromise
  expect(download.suggestedFilename()).toBe('tipos-coleta.csv')
  const stream=await download.createReadStream();let csv=''
  for await(const chunk of stream!) csv+=chunk.toString()
  expect(csv).toContain('PORTARIA');expect(csv).toContain('EXCLUDE_ALWAYS');expect(csv).not.toContain('DECRETO')
  await page.getByRole('button',{name:'Importar CSV'}).click()
  dialog=page.getByRole('dialog')
  const header='sourceCode;section;canonicalType;mode;helpText\n'
  await dialog.getByLabel('Arquivo CSV').setInputFiles({name:'invalid.csv',mimeType:'text/csv',buffer:Buffer.from(header+'dou;DO1;PORTARIA;KEEP_ALWAYS;\ninexistente;DO1;PORTARIA;KEEP_ALWAYS;')})
  await expect(dialog.getByRole('alert')).toContainText('Registro 2')
  await expect(dialog.getByRole('button',{name:'Aplicar ao rascunho'})).toBeDisabled()
  await dialog.getByLabel('Arquivo CSV').setInputFiles({name:'valid.csv',mimeType:'text/csv',buffer:Buffer.from(header+'dou;DO1;PORTARIA;KEEP_ALWAYS;Revisado')})
  await expect(dialog.getByRole('status')).toContainText('1 substituições')
  expect(writes).toEqual([])
  await dialog.getByRole('button',{name:'Aplicar ao rascunho'}).click()
  await expect(page.getByLabel('Modo PORTARIA')).toHaveValue('KEEP_ALWAYS')
  await page.getByRole('button',{name:'Limpar filtros'}).click()
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button',{name:'Salvar rascunho'}).click()
  await expect.poll(()=>writes.length).toBe(1)
  expect(writes[0].body).toMatchObject({contextWindowWords:27,weakScoreThreshold:8,locationWeights:{title:7,summary:5,body:2}})
  expect(writes[0].body.rules).toHaveLength(2)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})

test('help and all actions have dismissible popups; real origin options refresh automatically',async({page})=>{
  await page.clock.install()
  const {writes,expand}=await setup(page)
  expand();await page.clock.fastForward(61000)
  await expect(page.getByLabel('Fonte do tipo').locator('option[value="doe"]')).toHaveCount(1)
  await expect(page.getByLabel('Tipo canônico',{exact:true}).locator('option[value="INSTRUCAO NORMATIVA"]')).toHaveCount(1)
  await page.getByLabel('Fonte do tipo').selectOption('doe')
  await expect(page.getByLabel('Tipo canônico',{exact:true}).locator('option[value="RESOLUCAO"]')).toHaveCount(1)
  await expect(page.getByLabel('Tipo canônico',{exact:true}).locator('option[value="PORTARIA"]')).toHaveCount(0)
  await page.getByRole('button',{name:/Novos tipos/}).click()
  const help=page.getByRole('button',{name:'Ajuda das ações de Ato Novo'})
  await help.click()
  await expect(page.getByRole('dialog')).toContainText('Não publica uma regra de coleta')
  await page.keyboard.press('Escape');await expect(help).toBeFocused()
  for(const name of ['Classificar','Mesclar','Criar termo']) {
    await page.getByRole('button',{name,exact:true}).click()
    const dialog=page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
    await dialog.getByRole('button',{name:'Fechar popup'}).click()
    await expect(page.getByRole('button',{name,exact:true})).toBeFocused()
  }
  expect(writes).toEqual([])
  await page.getByRole('button',{name:'Criar termo',exact:true}).click()
  await page.getByRole('dialog').getByLabel('Texto do termo').fill('PIS')
  await page.getByRole('dialog').getByRole('button',{name:'Adicionar ao rascunho'}).click()
  await page.getByRole('button',{name:'Termos',exact:true}).click()
  await expect(page.getByRole('table').locator('tbody tr').filter({hasText:'PIS'})).toContainText('ATO NOVO')
  expect(writes).toEqual([])
})
