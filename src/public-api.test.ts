import { describe, expect, it } from 'vitest'

import {
  findFederalSource,
  findStateSource,
  formatLastSuccessAt,
  toCoveragePresentation,
  translatePublicStatus,
  type PublicSource,
} from './public-api'

const source = (overrides: Partial<PublicSource> = {}): PublicSource => ({
  code: 'doe-sp',
  name: 'Diário Oficial do Estado de São Paulo',
  jurisdictionLevel: 'STATE',
  uf: 'SP',
  isActive: true,
  status: 'ONLINE',
  lastRunStatus: 'SUCCESS',
  lastSuccessAt: '2026-09-28T13:30:00.000Z',
  lastAttemptAt: '2026-09-28T13:30:00.000Z',
  importedToday: 3,
  totalPublications: 517,
  ...overrides,
})

describe('public Coverage API mapping', () => {
  it('translates backend statuses without changing their meaning', () => {
    expect(translatePublicStatus('ONLINE')).toBe('Online')
    expect(translatePublicStatus('UNSTABLE')).toBe('Em validação')
    expect(translatePublicStatus('UNAVAILABLE')).toBe('Em validação')
    expect(translatePublicStatus('NOT_CONSULTED')).toBe('Em implantação')
  })

  it('maps federal sources by stable code', () => {
    const items = [
      source({ code: 'dou', jurisdictionLevel: 'FEDERAL', uf: null }),
      source({ code: 'confaz', jurisdictionLevel: 'FEDERAL', uf: null }),
    ]

    expect(findFederalSource(items, 'confaz')?.code).toBe('confaz')
  })

  it('prefers an explicit STATE/UF match and falls back to DOE code', () => {
    const items = [
      source({ code: 'state-sp', jurisdictionLevel: 'STATE', uf: 'SP' }),
      source({ code: 'doe-sp', jurisdictionLevel: 'FEDERAL', uf: null }),
    ]

    expect(findStateSource(items, 'SP')?.code).toBe('state-sp')
    expect(
      findStateSource(
        [source({ code: 'doe-go', jurisdictionLevel: 'FEDERAL', uf: null })],
        'GO',
      )?.code,
    ).toBe('doe-go')
  })

  it('uses lastSuccessAt and preserves real zero counts', () => {
    const presentation = toCoveragePresentation(
      source({ lastSuccessAt: '2026-09-28T13:30:00.000Z', importedToday: 0, totalPublications: 0 }),
      true,
    )

    expect(presentation.status).toBe('Online')
    expect(presentation.lastSuccessAt).not.toBe('—')
    expect(presentation.importedToday).toBe('0')
    expect(presentation.totalPublications).toBe('0')
  })

  it('does not substitute lastAttemptAt when there is no successful run', () => {
    const presentation = toCoveragePresentation(
      source({ lastSuccessAt: null, lastAttemptAt: '2026-09-28T13:30:00.000Z' }),
      true,
    )

    expect(presentation.lastSuccessAt).toBe('—')
  })

  it('marks a planned-but-absent source as Em implantação only after a successful API response', () => {
    expect(toCoveragePresentation(undefined, true)).toEqual({
      status: 'Em implantação',
      lastSuccessAt: '—',
      importedToday: '—',
      totalPublications: '—',
    })
  })

  it('keeps every field unknown during loading or API failure', () => {
    expect(toCoveragePresentation(source(), false)).toEqual({
      status: '—',
      lastSuccessAt: '—',
      importedToday: '—',
      totalPublications: '—',
    })
  })

  it('formats successful timestamps in São Paulo time', () => {
    expect(formatLastSuccessAt('2026-09-28T13:30:00.000Z')).toContain('10:30')
    expect(formatLastSuccessAt(null)).toBe('—')
  })
})
