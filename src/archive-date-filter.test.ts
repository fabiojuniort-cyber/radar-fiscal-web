import { describe, expect, it } from 'vitest'

import {
  archivePeriodCoverage,
  buildArchiveDateTimeline,
  chooseArchiveDateGranularity,
} from './archive-date-filter'

describe('archive date timeline', () => {
  it('uses days, months and years according to range amplitude', () => {
    expect(chooseArchiveDateGranularity('2026-09-01', '2026-09-20')).toBe('day')
    expect(chooseArchiveDateGranularity('2026-01-01', '2026-09-30')).toBe('month')
    expect(chooseArchiveDateGranularity('2023-06-01', '2026-06-30')).toBe('year')
  })

  it('shows contextual years and proportional boundary coverage', () => {
    const timeline = buildArchiveDateTimeline({
      mode: 'range',
      singleDate: '',
      from: '2023-06-01',
      to: '2026-06-30',
      maxDate: '2026-10-02',
    })

    expect(timeline.granularity).toBe('year')
    expect(timeline.periods.map((period) => period.primary)).toEqual([
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
      '2027',
    ])

    const byYear = new Map(timeline.periods.map((period) => [period.primary, period]))
    expect(byYear.get('2022')?.fillWidthPercent).toBe(0)
    expect(byYear.get('2023')?.fillStartPercent).toBeGreaterThan(40)
    expect(byYear.get('2023')?.fillWidthPercent).toBeGreaterThan(50)
    expect(byYear.get('2023')?.fillWidthPercent).toBeLessThan(60)
    expect(byYear.get('2024')?.fillWidthPercent).toBe(100)
    expect(byYear.get('2025')?.fillWidthPercent).toBe(100)
    expect(byYear.get('2026')?.fillStartPercent).toBe(0)
    expect(byYear.get('2026')?.fillWidthPercent).toBeGreaterThan(49)
    expect(byYear.get('2026')?.fillWidthPercent).toBeLessThan(51)
    expect(byYear.get('2027')?.fillWidthPercent).toBe(0)
    expect(byYear.get('2027')?.disabled).toBe(true)
  })

  it('places partial coverage at the correct side of a period', () => {
    const secondHalf = archivePeriodCoverage(
      '2023-01-01',
      '2023-12-31',
      '2023-07-01',
      '2023-12-31',
    )
    expect(secondHalf.startPercent).toBeGreaterThan(49)
    expect(secondHalf.startPercent).toBeLessThan(51)
    expect(secondHalf.widthPercent).toBeGreaterThan(49)
    expect(secondHalf.widthPercent).toBeLessThan(51)

    const firstHalf = archivePeriodCoverage(
      '2026-01-01',
      '2026-12-31',
      '2026-01-01',
      '2026-06-30',
    )
    expect(firstHalf.startPercent).toBe(0)
    expect(firstHalf.widthPercent).toBeGreaterThan(49)
    expect(firstHalf.widthPercent).toBeLessThan(51)
  })

  it('keeps future days visible but disabled in single-date context', () => {
    const timeline = buildArchiveDateTimeline({
      mode: 'single',
      singleDate: '2026-10-01',
      from: '',
      to: '',
      maxDate: '2026-10-01',
    })

    const oct1 = timeline.periods.find((period) => period.start === '2026-10-01')
    const oct2 = timeline.periods.find((period) => period.start === '2026-10-02')
    expect(oct1?.disabled).toBe(false)
    expect(oct1?.fillWidthPercent).toBe(100)
    expect(oct2?.disabled).toBe(true)
  })
})
