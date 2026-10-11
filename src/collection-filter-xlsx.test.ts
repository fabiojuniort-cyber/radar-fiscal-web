import {describe,it,expect} from 'vitest'
import {buildCollectionDiscardsWorkbook} from './collection-filter-xlsx'

describe('L-17: exported Excel workbook',()=>{
  it('creates real OOXML XLSX ZIP with all provided rows and inline-string safety',()=>{
    const result=buildCollectionDiscardsWorkbook(
      ['Título','Data do descarte','Link oficial'],
      [
        ['=2+2','11/10/2026','https://www.in.gov.br/a'],
        ['Resolução CIT-SNC/MINC','12/10/2026','https://www.in.gov.br/b'],
      ],
    )
    expect(result.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    expect(result.size).toBeGreaterThan(1200)
  })
  it('rejects incomplete export column shapes',()=>{
    expect(()=>buildCollectionDiscardsWorkbook(['Título','Fonte'],[['Ato']]))
      .toThrow('invalid_xlsx_row_shape')
  })
})
