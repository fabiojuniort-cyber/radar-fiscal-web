export const profileDimensions=[
 ['tax','Tributo'],['regime','Regime'],['operation','Operação'],['operation_purpose','Finalidade'],
 ['document','Documento'],['obligation','Obrigação'],['actuacao','Atuação'],['subject','Sujeito'],['theme','Tema'],
] as const
export const profileDimensionGroups=[
 {code:'tax_regime',title:'Tributos e regime',dimensions:['tax','regime']},
 {code:'operations_documents',title:'Operações e documentos',dimensions:['operation','operation_purpose','document']},
 {code:'obligations_context',title:'Obrigações e contexto',dimensions:['obligation','actuacao','subject','theme']},
]
