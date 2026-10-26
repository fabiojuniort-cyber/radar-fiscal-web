import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { TaxProfileSection } from './authenticated-product-panel'
import type { AccountCompany, Establishment, TaxonomyProfileOptions, TaxProfile } from './product-api'

afterEach(cleanup)
const company: AccountCompany = { id:'synthetic-company', legalName:'Synthetic fixture',
  tradeName:null, cnpj:'11222333000181', isActive:true, establishmentCount:1,businessLocationCode:null }
const unit = (id: string, head: boolean): Establishment => ({
  id, companyId:company.id,cnpj:head?'11222333000181':'11222333000262',name:head?'Synthetic head':'Synthetic branch',
  typeCode:head?'HEAD_OFFICE':'OTHER',isHeadOffice:head,uf:'GO',municipalityName:null,
  municipalityIbgeCode:null,postalCode:null,street:null,streetNumber:null,complement:null,district:null,
  businessLocationCode:null,stateRegistration:null,stateRegistrationStatus:null,stateRegistrationSource:null,
  stateRegistrationCheckedAt:null,stateRegistrationLookupStatus:null,isActive:true,cnaes:[],
})
const options: TaxonomyProfileOptions = {
  release:{id:'synthetic-release',version:'v1.0.0',publishedAt:null},
  dimensions:[{code:'product',name:'Produto',description:null,
    concepts:[{code:'product.soy',label:'Soja',definition:'Synthetic'}]}],
  conceptCodes:['product.soy'],segments:[],products:[],
}
const savedHead = {establishmentId:'head',taxRegime:'LUCRO_PRESUMIDO',conceptCodes:['product.soy'],ncmCodes:[]}
const profile: TaxProfile = {
  id:'synthetic-profile',companyId:company.id,versionNo:1,taxRegime:'LUCRO_REAL',
  segments:[],activities:[],validFrom:null,
  personalization:{taxonomy:{releaseId:'synthetic-release',releaseVersion:'v1.0.0',conceptCodes:['product.soy']},
    establishmentOverrides:[savedHead]},
}
it('a later branch starts empty; saving its choices preserves the head office and legacy company profile', async () => {
  const changed = vi.fn()
  const api = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => new Response(
    JSON.stringify(init?.method === 'PUT' ? {profile} : {items:[],segments:[],cnaes:[]}),
    {status:200,headers:{'Content-Type':'application/json'}},
  ))
  const client = new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
  const view = (units: Establishment[]) => <MemoryRouter>
    <QueryClientProvider client={client}>
      <TaxProfileSection apiFetch={api} tenantId="synthetic-tenant" company={company}
        establishments={units} profile={profile} taxonomyOptions={options}
        loading={false} error={false} onChanged={changed} />
    </QueryClientProvider>
  </MemoryRouter>
  const rendered=render(view([unit('head',true)]))
  const area=screen.getByRole('region',{name:'Perfil por estabelecimento'})
  expect(within(area).getByLabelText('Regime tributário desta unidade')).toHaveValue('LUCRO_PRESUMIDO')
  expect(within(area).getByRole('button',{name:'Remover Soja'})).toBeInTheDocument()

  rendered.rerender(view([unit('head',true),unit('branch',false)]))
  fireEvent.change(within(area).getByLabelText('Estabelecimento'),{target:{value:'branch'}})
  expect(within(area).getByLabelText('Regime tributário desta unidade')).toHaveValue('NAO_INFORMADO')
  expect(within(area).queryByRole('button',{name:'Remover Soja'})).not.toBeInTheDocument()
  expect(within(area).getByRole('region',{name:'NCM'})).toHaveTextContent('Nenhuma NCM selecionada.')
  expect(screen.getByRole('region',{name:'Taxonomia da empresa'})).toHaveTextContent('Soja')

  fireEvent.change(within(area).getByLabelText('Regime tributário desta unidade'),{target:{value:'SIMPLES_NACIONAL'}})
  fireEvent.click(within(area).getByRole('button',{name:'Soja'}))
  fireEvent.change(within(area).getByLabelText('Estabelecimento'),{target:{value:'head'}})
  expect(within(area).getByLabelText('Regime tributário desta unidade')).toHaveValue('LUCRO_PRESUMIDO')
  fireEvent.click(screen.getByRole('button',{name:'Salvar Perfil Tributário'}))
  await waitFor(()=>expect(changed).toHaveBeenCalledTimes(1))
  const writes=api.mock.calls.filter(([,init])=>init?.method==='PUT')
  expect(writes).toHaveLength(1)
  const payload=JSON.parse(String(writes[0]?.[1]?.body))
  expect(payload.taxRegime).toBe('LUCRO_REAL')
  expect(payload.personalization.taxonomy.conceptCodes).toEqual(['product.soy'])
  expect(payload.personalization.establishmentOverrides).toEqual([
    savedHead,{establishmentId:'branch',taxRegime:'SIMPLES_NACIONAL',conceptCodes:['product.soy'],ncmCodes:[]},
  ])
  expect(new Headers(writes[0]?.[1]?.headers).get('X-Tenant-Id')).toBe('synthetic-tenant')
})
