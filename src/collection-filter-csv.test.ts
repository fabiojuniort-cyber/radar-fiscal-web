import { describe, expect, it } from 'vitest'
import { decodeFilterCsv, encodeFilterCsv, parseFilterCsv, RULE_HEADERS, TERM_HEADERS, mergeFilterRows, filterRuleKey } from './collection-filter-csv'

const types = (source: string) => source === 'dou' || !source ? ['PORTARIA', 'ATO NOVO'] : ['DECRETO']
const rule = ['dou','DO1','PORTARIA','KEEP_ALWAYS','']
describe('CSV de política: integridade e importação', () => {
  it('preserva Unicode, aspas, delimitadores, quebras e fórmulas protegidas no roundtrip', () => {
    const values = ['ação; "texto"\nsegunda linha', '=SUM(A1)', ' @formula', "'texto", "'=literal", '-10']
    const csv = encodeFilterCsv(['a','b','c','d','e','f'], [values])
    expect(csv).toContain("'=SUM")
    expect(parseFilterCsv(csv)[1]).toEqual(values)
  })
  it('aceita modelo separado por vírgula e normaliza fonte/tipo sem alterar o modo', () => {
    const result=decodeFilterCsv('rules',RULE_HEADERS.join(',')+'\nDOU,DO1,Portária,KEEP_ALWAYS,', ['dou'],types)
    expect(result.rules[0]).toMatchObject({sourceCode:'dou',canonicalType:'PORTARIA',mode:'KEEP_ALWAYS'})
  })
  it.each(['a;b\n"ab', 'a;b\n"ab"x;c', 'a;b\nab"c;d'])('rejeita CSV malformado: %s', csv=>expect(()=>parseFilterCsv(csv)).toThrow())
  it('rejeita todo o arquivo se o último registro usa uma fonte desconhecida',()=>{
    expect(()=>decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[rule,['outra','DO1','PORTARIA','KEEP_ALWAYS','']]),['dou'],types)).toThrow('Registro 2')
  })
  it('valida vínculo fonte/tipo e modo, incluindo regras duplicadas normalizadas',()=>{
    expect(()=>decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[['doe','DO1','PORTARIA','KEEP_ALWAYS','']]),['doe'],types)).toThrow('tipo não encontrado')
    expect(()=>decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[[...rule.slice(0,3),'WRONG','']]),['dou'],types)).toThrow('modo inválido')
    expect(()=>decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[rule,['DOU','do1','Portária','EXCLUDE_ALWAYS','']]),['dou'],types)).toThrow('duplicada')
  })
  it('rejeita força conflitante no mesmo escopo e termo positivo proibido',()=>{
    expect(()=>decodeFilterCsv('terms',encodeFilterCsv(TERM_HEADERS,[['ICMS','STRONG','','','','ANY'],['icms','WEAK','','','','ANY']]),['dou'],types)).toThrow('conflitante')
    expect(()=>decodeFilterCsv('terms',encodeFilterCsv(TERM_HEADERS,[['CNPJ','STRONG','','','','ANY']]),['dou'],types)).toThrow('não pode preservar')
    expect(decodeFilterCsv('terms',encodeFilterCsv(TERM_HEADERS,[['CNPJ','NEGATIVE','','','','BODY']]),['dou'],types).terms[0].sourceCode).toBeNull()
  })
  it('não aceita fontes excluídas pelo contrato do backend',()=>{
    expect(()=>decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[['doe-sp','DO1','DECRETO','KEEP_ALWAYS','']]),['doe-sp'],types)).toThrow('fora do escopo')
  })
  it('mescla chaves iguais preservando registros ausentes e sem mutar a entrada',()=>{
    const existing=decodeFilterCsv('rules',encodeFilterCsv(RULE_HEADERS,[rule,['dou','DO1','ATO NOVO','KEEP_ALWAYS','']]),['dou'],types).rules
    const incoming=[{...existing[0],mode:'EXCLUDE_ALWAYS' as const}]
    const result=mergeFilterRows(existing,incoming,filterRuleKey)
    expect(result).toHaveLength(2)
    expect(result[0].mode).toBe('EXCLUDE_ALWAYS')
    expect(existing[0].mode).toBe('KEEP_ALWAYS')
    expect(result[1]).toBe(existing[1])
  })
})
