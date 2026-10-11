import { test, expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * L-11 pre-merge visual evidence; synthetic API fixtures, NO real writes.
 * Fábio must approve the five screenshots before merge.
 * GitHub Actions collects playwright-artifacts with the full CI.
 */
test('L11 pré-merge: screenshots Tipos, Termos, Novos tipos com popup, Desconsiderados e Alertas',async({
  page,
},testInfo)=>{
  const policyId='11111111-1111-4111-8111-111111111111'
  const files=path.join('playwright-artifacts','l11-review',testInfo.project.name)
  await mkdir(files,{recursive:true})
  await page.route('**/auth/refresh',r=>r.fulfill({
    json:{accessToken:'screenshot-fixture',tokenType:'Bearer',expiresIn:900},
  }))
  await page.route('**/auth/me',r=>r.fulfill({
    json:{user:{id:'admin',email:'visual-review@example.test'},memberships:[]},
  }))
  await page.route('**/api/v1/admin/me',r=>r.fulfill({json:{platformAdmin:true}}))
  await page.route('**/api/v2/archive/facets',r=>r.fulfill({
    json:{sources:[{code:'dou',name:'DOU'},{code:'confaz',name:'CONFAZ'}],
      actTypes:['AVISO DE LICITACAO','PORTARIA','DECRETO','AJUSTE SINIEF']},
  }))
  await page.route('**/api/v2/archive/navigation?**',r=>r.fulfill({
    json:{groupBy:'actType',items:[
      {value:'AVISO DE LICITACAO',count:15},
      {value:'PORTARIA',count:16},{value:'DECRETO',count:9},
    ]},
  }))
  await page.route('**/api/v1/admin/collection-filter/**',async r=>{
    const url=new URL(r.request().url())
    if(r.request().method()!=='GET')return r.fulfill({status:409,json:{error:'screenshots_read_only'}})
    if(url.pathname.endsWith('/state')){
      const doc={id:policyId,status:'APPROVED',version:9,revision:42,
        rules:[
          {sourceCode:'dou',section:'DO1',canonicalType:'PORTARIA',mode:'KEEP_IF_TAX_TERM',helpText:null},
          {sourceCode:'dou',section:'DO3',canonicalType:'AVISO DE LICITACAO',mode:'EXCLUDE_ALWAYS',helpText:null},
          {sourceCode:'dou',section:'DO1',canonicalType:'DECRETO',mode:'KEEP_ALWAYS',helpText:null},
          {sourceCode:'confaz',section:'',canonicalType:'AJUSTE SINIEF',mode:'KEEP_ALWAYS',helpText:null},
        ],aliases:[],
        terms:[
          {text:'ICMS',normalizedTerm:'ICMS',strength:'STRONG',locationScope:'ANY',sourceCode:null,section:null,canonicalType:null},
          {text:'Crédito presumido',normalizedTerm:'CREDITO PRESUMIDO',strength:'WEAK',locationScope:'ANY',sourceCode:'dou',section:null,canonicalType:null},
          {text:'Tomada de preços',normalizedTerm:'TOMADA DE PRECOS',strength:'NEGATIVE',locationScope:'ANY',sourceCode:'dou',section:null,canonicalType:null},
        ]};
      return r.fulfill({json:{policies:[{id:policyId,status:'APPROVED',version:9,revision:42}],
        documents:{[policyId]:doc},newTypesOpen:1}})
    }
    if(url.pathname.endsWith('/new-types'))return r.fulfill({json:{items:[{
      id:'22222222-2222-4222-8222-222222222222',source_code:'dou',section:'DO3',
      normalized_type:'AVISO DE LICITACAO PREGAO',sample_raw_type:'Aviso de Licitação - Pregão',
      occurrence_count:2632,first_seen_at:'2026-10-01T12:00:00Z',
      last_seen_at:'2026-10-10T12:00:00Z',status:'OPEN',
      examples:[{id:'ex-1',title:'Aviso de Pregão Eletrônico nº 12/2026',
        officialUrl:'https://www.in.gov.br/',publishedOn:'2026-10-10'}],
    }]}})
    if(url.pathname.endsWith('/discarded'))return r.fulfill({json:{items:[{
      id:'d-1',source_code:'dou',connector_key:'dou-inlabs',section:'DO3',
      raw_type:'AVISO DE LICITACAO',canonical_type:'AVISO DE LICITACAO',
      title:'Aviso de licitação para demonstração visual',act_number:'12',
      published_on:'2026-10-10',official_url:'https://www.in.gov.br/',
      reason_code:'EXCLUDE_ALWAYS',decisive_term:null,policy_version:9,
      policy_revision:42,discarded_at:'2026-10-10T15:00:00Z',
      expires_at:'2027-01-10T15:00:00Z',
    }]}})
    if(url.pathname.endsWith('/discard-alerts'))return r.fulfill({json:{items:[{
      id:'a-1',collection_run_id:'01234567-89ab-4cde-8f01-234567890abc',
      source_code:'dou',discard_rate:'0.85',baseline_rate:'0.45',threshold_rate:'0.65',
      found_count:100,discard_count:85,status:'OPEN',
      created_at:'2026-10-10T14:00:00Z',acknowledged_at:null,
    }]}})
    return r.fulfill({json:{items:[]}})
  })
  await page.goto('/admin/filtro-coleta')
  await expect(page.getByRole('heading',{name:'Tipos de ato'})).toBeVisible()
  await expect(page.getByRole('table',{name:'Tipos de ato'})).toBeVisible()
  await page.screenshot({path:path.join(files,'01-tipos.png'),fullPage:true})
  await page.getByRole('button',{name:'Termos',exact:true}).click()
  await expect(page.getByRole('table',{name:'Termos tributários'})).toBeVisible()
  await page.screenshot({path:path.join(files,'02-termos.png'),fullPage:true})
  await page.getByRole('button',{name:/Novos tipos/}).click()
  await expect(page.getByRole('button',{name:'Classificar'})).toBeVisible()
  await page.getByRole('button',{name:'Classificar'}).click()
  await expect(page.getByRole('dialog',{name:'Classificar novo tipo'})).toBeVisible()
  await page.screenshot({path:path.join(files,'03a-novos-tipos-escolher-tipo.png'),fullPage:true})
  await page.getByRole('dialog',{name:'Classificar novo tipo'})
    .getByRole('button',{name:'Confirmar classificação'}).click()
  const confirm=page.getByRole('dialog',{name:'Classificar tipo de publicação'})
  await expect(confirm).toBeVisible()
  await expect(confirm.getByLabel('Modo')).toBeVisible()
  await page.screenshot({path:path.join(files,'03-novos-tipos-popup.png'),fullPage:true})
  await confirm.getByRole('button',{name:'Cancelar'}).click()
  await page.getByRole('button',{name:'Desconsiderados',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Aviso de licitação para demonstração visual'})).toBeVisible()
  await page.screenshot({path:path.join(files,'04-desconsiderados.png'),fullPage:true})
  await page.getByRole('button',{name:'Alertas de descarte'}).click()
  await expect(page.getByText('85%',{exact:true})).toBeVisible()
  await page.screenshot({path:path.join(files,'05-alertas.png'),fullPage:true})
})
