import {expect,it} from 'vitest'
import {effectiveChoice,productRows,toggleProduct,suggestedDraft} from './onboarding-selection'
import {segmentSteps,type AssistantData} from './onboarding-assistant-api'
const data:AssistantData={version:3,release:{id:'v19',version:'v1.9.0'},companyName:'Test',state:{completed:false,cards:{},units:{}},concepts:[{code:'product.rice',label:'Arroz',dimensionCode:'product',ncmCodes:['1006']},{code:'product.bran',label:'Farelo',dimensionCode:'product',ncmCodes:['2302']}],cards:[{establishmentId:'head',cnaeCode:'0111301',description:'Test',phraseSegment:'agro',segmentCode:'sector.agro',suggestions:[{kind:'PRODUCT',target:'product.rice',segment:'Agro'},{kind:'PRODUCT',target:'product.bran',segment:'Agro'},{kind:'NCM',target:'1006',segment:'Agro'},{kind:'NCM',target:'2302',segment:'Agro'},{kind:'NCM',target:'2716',segment:'Agro'}]}]}
it('each product receives only its own evidence; independent CNAE NCM is never attached',()=>{
 const rows=productRows(data,segmentSteps(data)[0]!,'head');expect(rows.map(r=>[r.label,r.ncms])).toEqual([['Arroz',['1006']],['Farelo',['2302']]])
 const choice=toggleProduct({conceptCodes:[],ncmCodes:[]},'product.rice',['1006'],data);expect(choice).toEqual({conceptCodes:['product.rice'],ncmCodes:['1006']});expect(toggleProduct(choice,'product.rice',['1006'],data)).toEqual({conceptCodes:[],ncmCodes:[]})
})
it('shared and explicit historical NCMs survive removing a product',()=>{
 expect(toggleProduct({conceptCodes:['product.rice'],ncmCodes:['1006','2716']},'product.rice',['1006'],data,['1006','2716'])).toEqual({conceptCodes:[],ncmCodes:['1006','2716']})
})
it('effective historical selections preload and a new branch remains empty',()=>{
 const d={...data,effectiveProfiles:[{establishmentId:'head',name:'Matriz',isHeadOffice:true,taxRegime:'LUCRO_REAL',conceptCodes:['product.retired','product.manual'],ncmCodes:['2716'],legacyFields:{products:['Antigo']},cnaeSegments:[],historicalCodes:['product.retired']}]}
 expect(effectiveChoice(d,'head')).toEqual({conceptCodes:['product.retired','product.manual'],ncmCodes:['2716']});expect(effectiveChoice(d,'branch')).toEqual({conceptCodes:[],ncmCodes:[]})
})
it('preselection is a pure per-unit draft and never restores removals on a reviewed card',()=>{
 const copy=JSON.stringify(data),step=segmentSteps(data)[0]!
 expect(suggestedDraft(data,step,'head')).toEqual({conceptCodes:['product.rice','product.bran'],ncmCodes:['1006','2302','2716']})
 expect(suggestedDraft(data,step,'branch')).toEqual({conceptCodes:[],ncmCodes:[]});expect(JSON.stringify(data)).toBe(copy)
 const reviewed={...data,state:{...data.state,units:{head:{cards:{[step.id]:{status:'CONFIRMED' as const,conceptCodes:[],ncmCodes:[]}}}}}}
 expect(suggestedDraft(reviewed,step,'head')).toEqual({conceptCodes:[],ncmCodes:[]})
})
