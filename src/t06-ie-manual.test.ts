import { describe, expect, it } from 'vitest'
import { manualIeActionLabel, manualIeHelperText } from './t06-ie-manual'

describe('T06 IE manual fallback', () => {
  it('offers an explicit manual form when provider is unsupported, unavailable or inconclusive', () => {
    for (const status of ['NOT_SUPPORTED', 'UNAVAILABLE', 'NOT_FOUND'] as const) {
      expect(manualIeActionLabel(null, status)).toBe('Informar IE manualmente')
      expect(manualIeActionLabel('100012345', status)).toBe('Editar estabelecimento')
    }
  })
  it('does not downgrade a successful official GO lookup to manual input', () => {
    expect(manualIeActionLabel('10.779.976-6', 'SUCCESS')).toBe('Editar estabelecimento')
    expect(manualIeActionLabel(null, 'SUCCESS')).toBe('Editar estabelecimento')
  })
  it('keeps MG disabled until weekly file reuse is explicitly cleared', () => {
    expect(manualIeHelperText('MG', 'NOT_SUPPORTED')).toMatch(/aguarda autorização de uso/)
    expect(manualIeHelperText('MS', 'NOT_SUPPORTED')).toMatch(/manualmente/)
    expect(manualIeHelperText('MS', 'UNAVAILABLE')).toMatch(/indisponível/)
    expect(manualIeHelperText('MS', 'NOT_FOUND')).toMatch(/não localizada/)
  })
})
