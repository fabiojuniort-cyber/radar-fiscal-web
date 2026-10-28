import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {OnboardingCompanyData,correctionValues} from './onboarding-company-data'
import type {Establishment} from './product-api'
afterEach(cleanup)
const unit={id:'branch',companyId:'company',name:'Filial',cnpj:'10515785000270',isHeadOffice:false,uf:'GO',street:'Rua original',streetNumber:'10',district:null,complement:null,municipalityName:'Goiânia',municipalityIbgeCode:'5208707',postalCode:'74000000',businessLocationCode:'FILIAL',stateRegistration:'123',cnaes:[]} as unknown as Establishment
it('edits in the displayed data box, cancels without writes and disables an empty legal name',()=>{
 const api=vi.fn(),saved=vi.fn()
 render(<OnboardingCompanyData unit={unit} legalName="Agrex" apiFetch={api} tenantId="tenant" companyId="company" locked={false} onSaved={saved} onEditing={vi.fn()}/>)
 fireEvent.click(screen.getByRole('button',{name:'Corrigir algum dado'}))
 const box=within(screen.getByLabelText('Dados cadastrais'))
 fireEvent.change(box.getByLabelText('Razão social'),{target:{value:''}})
 expect(box.getByRole('button',{name:'Salvar correção'})).toBeDisabled()
 fireEvent.change(box.getByLabelText('Logradouro'),{target:{value:'Não salvar'}})
 fireEvent.click(box.getByRole('button',{name:'Cancelar correção'}))
 expect(api).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();expect(box.getByText(/Rua original/)).toBeInTheDocument()
})
it('keeps a conflict draft and sends only the baseline and editable fields with tenant and unit identity',async()=>{
 const api=vi.fn(async()=>Response.json({error:'registration_data_conflict'},{status:409})),saved=vi.fn()
 render(<OnboardingCompanyData unit={unit} legalName="Agrex" apiFetch={api} tenantId="tenant" companyId="company" locked={false} onSaved={saved} onEditing={vi.fn()}/>)
 fireEvent.click(screen.getByRole('button',{name:'Corrigir algum dado'}));fireEvent.change(screen.getByLabelText('Logradouro'),{target:{value:'Rua corrigida'}});fireEvent.click(screen.getByRole('button',{name:'Salvar correção'}))
 await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Os dados mudaram'))
 expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua corrigida');expect(saved).not.toHaveBeenCalled()
 const call=api.mock.calls[0] as unknown as [string,RequestInit];expect(call[0]).toContain('/company/establishments/branch/onboarding-data');expect(JSON.parse(String(call[1].body))).toEqual({expected:correctionValues(unit,'Agrex'),values:{...correctionValues(unit,'Agrex'),street:'Rua corrigida'}})
 expect(call[1].headers).toMatchObject({'X-Tenant-Id':'tenant'})
})
