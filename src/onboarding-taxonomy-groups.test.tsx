import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {TaxonomyGroups} from './onboarding-taxonomy-groups'
import type {AssistantData} from './onboarding-assistant-api'
afterEach(cleanup)
it('keeps selected choices across collapse, searches closed groups, orders groups and keeps ungrouped options',()=>{
 const data={taxonomyGroups:[{code:'income',label:'Renda e lucro',dimensionCode:'tax',displayOrder:2},{code:'consumption',label:'Tributos sobre consumo',dimensionCode:'tax',displayOrder:1}],concepts:[{code:'tax.icms',label:'ICMS',dimensionCode:'tax',groupCode:'consumption'},{code:'tax.irpj',label:'IRPJ',dimensionCode:'tax',groupCode:'income'},{code:'tax.other',label:'Outro tributo',dimensionCode:'tax',groupCode:null}]} as AssistantData
 const onToggle=vi.fn(),props={data,dimension:'tax',query:'',selected:['tax.icms'],onToggle};const view=render(<TaxonomyGroups {...props}/>);
 expect(screen.getAllByRole('button').map(b=>b.textContent)).toEqual(['▾ Tributos sobre consumo · 1','▾ Renda e lucro · 1','▾ Sem grupo · 1'])
 fireEvent.click(screen.getByRole('button',{name:/Tributos sobre consumo/}));expect(screen.queryByRole('checkbox',{name:'ICMS'})).toBeNull();expect(onToggle).not.toHaveBeenCalled()
 view.rerender(<TaxonomyGroups {...props} query="ICMS"/>);expect(screen.getByRole('checkbox',{name:'ICMS'})).toBeChecked();expect(screen.queryByRole('checkbox',{name:'IRPJ'})).toBeNull()
 view.rerender(<TaxonomyGroups {...props} query="renda"/>);expect(screen.getByRole('checkbox',{name:'IRPJ'})).toBeInTheDocument()
 view.rerender(<TaxonomyGroups {...props} query="inexistente"/>);expect(screen.getByText('Nenhuma opção encontrada.')).toBeInTheDocument()
})
