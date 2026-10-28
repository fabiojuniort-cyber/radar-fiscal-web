import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import {afterEach,expect,it,vi} from 'vitest'
import {ProfileEditor} from './onboarding-profile-editor'
import type {AssistantData,EffectiveProfile} from './onboarding-assistant-api'
afterEach(cleanup)
it('a legacy profile can replace a retired non-product choice with a current canonical choice',async()=>{
 const data:AssistantData={version:4,companyName:'Test',release:{id:'current',version:'v1.9.0'},state:{completed:false,cards:{},units:{}},cards:[],concepts:[{code:'operation.resale',label:'Revenda',dimensionCode:'operation',ncmCodes:[]}],historicalConcepts:[{code:'operation.retired',label:'Operação anterior',dimensionCode:'operation'}]}
 const profile:EffectiveProfile={establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'LUCRO_REAL',conceptCodes:['operation.retired'],ncmCodes:['2716'],legacyFields:{},cnaeSegments:[],historicalCodes:['operation.retired']}
 const onSave=vi.fn(async()=>{}),api=vi.fn(async()=>Response.json({items:[]}))
 render(<ProfileEditor data={data} profile={profile} apiFetch={api} locked={false} onSave={onSave} onCancel={vi.fn()}/>)
 expect(screen.getByRole('button',{name:'Salvar escolhas deste estabelecimento'})).toBeDisabled()
 fireEvent.click(screen.getByRole('checkbox',{name:/Operação anterior/}))
 fireEvent.change(screen.getByLabelText('Buscar outra escolha ou NCM'),{target:{value:'Revenda'}})
 fireEvent.click(await screen.findByRole('button',{name:'Adicionar Revenda'}))
 fireEvent.click(screen.getByRole('button',{name:'Salvar escolhas deste estabelecimento'}))
 await waitFor(()=>expect(onSave).toHaveBeenCalledWith(expect.objectContaining({conceptCodes:['operation.resale'],ncmCodes:['2716']})))
 expect(profile.conceptCodes).toEqual(['operation.retired'])
})
