import { CalendarDays } from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import './archive-date-filter.css'

export type ArchiveDateMode = 'single' | 'range'
export type ArchiveDateEndpoint = 'from' | 'to'
export type ArchiveDateGranularity = 'day' | 'month' | 'year'

export type ArchiveDateRange = {
  from: string
  to: string
}

type TimelinePeriod = {
  key: string
  start: string
  end: string
  primary: string
  secondary: string
  disabled: boolean
  fillStartPercent: number
  fillWidthPercent: number
}

type Props = {
  mode: ArchiveDateMode
  singleDate: string
  range: ArchiveDateRange
  maxDate: string
  onModeChange: (mode: ArchiveDateMode) => void
  onSingleDateChange: (value: string) => void
  onRangeChange: (range: ArchiveDateRange) => void
  onClear: () => void
}

const DAY_MS = 86_400_000
const PT_WEEKDAY = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  timeZone: 'UTC',
})
const PT_MONTH = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  timeZone: 'UTC',
})

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: string, days: number): string {
  const date = parseIsoDate(value)
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

function addMonths(value: string, months: number): string {
  const date = parseIsoDate(value)
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  return isoDate(date)
}

function addYears(value: string, years: number): string {
  const date = parseIsoDate(value)
  date.setUTCMonth(0, 1)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return isoDate(date)
}

function startOfMonth(value: string): string {
  const date = parseIsoDate(value)
  date.setUTCDate(1)
  return isoDate(date)
}

function endOfMonth(value: string): string {
  return addDays(addMonths(startOfMonth(value), 1), -1)
}

function startOfYear(value: string): string {
  const year = parseIsoDate(value).getUTCFullYear()
  return `${year}-01-01`
}

function endOfYear(value: string): string {
  const year = parseIsoDate(value).getUTCFullYear()
  return `${year}-12-31`
}

function minDate(left: string, right: string): string {
  return left < right ? left : right
}

function maxDate(left: string, right: string): string {
  return left > right ? left : right
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

export function todayInSaoPaulo(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return now.toISOString().slice(0, 10)
  return `${year}-${month}-${day}`
}

export function chooseArchiveDateGranularity(
  from: string,
  to: string,
): ArchiveDateGranularity {
  if (!from || !to) return 'day'
  const spanDays = Math.max(
    0,
    Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS),
  )
  if (spanDays <= 45) return 'day'
  if (spanDays <= 550) return 'month'
  return 'year'
}

export function archivePeriodCoverage(
  periodStart: string,
  periodEnd: string,
  selectedFrom: string,
  selectedTo: string,
): { startPercent: number; widthPercent: number } {
  if (!selectedFrom || !selectedTo || selectedFrom > selectedTo) {
    return { startPercent: 0, widthPercent: 0 }
  }

  const periodStartMs = parseIsoDate(periodStart).getTime()
  const periodEndExclusiveMs = parseIsoDate(addDays(periodEnd, 1)).getTime()
  const selectedStartMs = parseIsoDate(selectedFrom).getTime()
  const selectedEndExclusiveMs = parseIsoDate(addDays(selectedTo, 1)).getTime()
  const intersectionStart = Math.max(periodStartMs, selectedStartMs)
  const intersectionEnd = Math.min(periodEndExclusiveMs, selectedEndExclusiveMs)

  if (intersectionEnd <= intersectionStart) {
    return { startPercent: 0, widthPercent: 0 }
  }

  const duration = periodEndExclusiveMs - periodStartMs
  return {
    startPercent: clampPercent(((intersectionStart - periodStartMs) / duration) * 100),
    widthPercent: clampPercent(((intersectionEnd - intersectionStart) / duration) * 100),
  }
}

export function buildArchiveDateTimeline(input: {
  mode: ArchiveDateMode
  singleDate: string
  from: string
  to: string
  maxDate: string
}): { granularity: ArchiveDateGranularity; periods: TimelinePeriod[] } {
  const anchor =
    input.mode === 'single'
      ? input.singleDate || input.maxDate
      : input.from || input.to || input.maxDate

  const from = input.mode === 'single' ? input.singleDate : input.from
  const to = input.mode === 'single' ? input.singleDate : input.to
  const granularity =
    input.mode === 'single'
      ? 'day'
      : chooseArchiveDateGranularity(input.from, input.to)

  const periods: TimelinePeriod[] = []

  const pushPeriod = (
    start: string,
    end: string,
    primary: string,
    secondary: string,
  ) => {
    const coverage = archivePeriodCoverage(start, end, from, to)
    periods.push({
      key: `${granularity}-${start}`,
      start,
      end,
      primary,
      secondary,
      disabled: start > input.maxDate,
      fillStartPercent: coverage.startPercent,
      fillWidthPercent: coverage.widthPercent,
    })
  }

  if (granularity === 'day') {
    let start: string
    let end: string
    if (input.mode === 'range' && input.from && input.to) {
      start = addDays(input.from, -1)
      end = addDays(input.to, 1)
    } else {
      start = addDays(anchor, -3)
      end = addDays(anchor, 3)
    }

    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      const date = parseIsoDate(cursor)
      pushPeriod(
        cursor,
        cursor,
        String(date.getUTCDate()),
        PT_WEEKDAY.format(date).replace('.', '').toUpperCase(),
      )
    }
  } else if (granularity === 'month') {
    const rangeStart = input.from || anchor
    const rangeEnd = input.to || rangeStart
    const start = addMonths(startOfMonth(rangeStart), -1)
    const end = addMonths(startOfMonth(rangeEnd), 1)

    for (let cursor = start; cursor <= end; cursor = addMonths(cursor, 1)) {
      const date = parseIsoDate(cursor)
      pushPeriod(
        cursor,
        endOfMonth(cursor),
        PT_MONTH.format(date).replace('.', '').toUpperCase(),
        String(date.getUTCFullYear()),
      )
    }
  } else {
    const rangeStart = input.from || anchor
    const rangeEnd = input.to || rangeStart
    const start = addYears(startOfYear(rangeStart), -1)
    const end = addYears(startOfYear(rangeEnd), 1)

    for (let cursor = start; cursor <= end; cursor = addYears(cursor, 1)) {
      const date = parseIsoDate(cursor)
      pushPeriod(
        cursor,
        endOfYear(cursor),
        String(date.getUTCFullYear()),
        'ANO',
      )
    }
  }

  return { granularity, periods }
}

function formatDatePt(value: string): string {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function periodContains(period: TimelinePeriod, value: string): boolean {
  return Boolean(value && period.start <= value && value <= period.end)
}

export function ArchiveDateFilter({
  mode,
  singleDate,
  range,
  maxDate: maximumDate,
  onModeChange,
  onSingleDateChange,
  onRangeChange,
  onClear,
}: Props) {
  const [activeEndpoint, setActiveEndpoint] = useState<ArchiveDateEndpoint>('from')
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef(new Map<string, HTMLButtonElement>())

  useEffect(() => {
    if (mode === 'range') {
      if (!range.from) setActiveEndpoint('from')
      else if (!range.to) setActiveEndpoint('to')
    }
  }, [mode, range.from, range.to])

  const timeline = useMemo(
    () =>
      buildArchiveDateTimeline({
        mode,
        singleDate,
        from: range.from,
        to: range.to,
        maxDate: maximumDate,
      }),
    [mode, singleDate, range.from, range.to, maximumDate],
  )

  const anchorDate =
    mode === 'single'
      ? singleDate || maximumDate
      : activeEndpoint === 'from'
        ? range.from || range.to || maximumDate
        : range.to || range.from || maximumDate
  const anchor = timeline.periods.find((period) => periodContains(period, anchorDate))

  useEffect(() => {
    if (!anchor) return
    const node = itemRefs.current.get(anchor.key)
    if (!node || !timelineRef.current) return
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    node.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [anchor?.key])

  const selectPeriod = (period: TimelinePeriod) => {
    if (period.disabled) return

    if (mode === 'single') {
      onSingleDateChange(minDate(period.start, maximumDate))
      return
    }

    if (activeEndpoint === 'from') {
      const nextFrom = minDate(period.start, maximumDate)
      const nextTo = range.to && range.to >= nextFrom ? range.to : nextFrom
      onRangeChange({ from: nextFrom, to: nextTo })
      setActiveEndpoint('to')
      return
    }

    const nextTo = minDate(period.end, maximumDate)
    const nextFrom = range.from && range.from <= nextTo ? range.from : nextTo
    onRangeChange({ from: nextFrom, to: nextTo })
    setActiveEndpoint('from')
  }

  const updateFrom = (value: string) => {
    const safe = value > maximumDate ? maximumDate : value
    onRangeChange({
      from: safe,
      to: !safe || (range.to && range.to >= safe) ? range.to : safe,
    })
    setActiveEndpoint('from')
  }

  const updateTo = (value: string) => {
    const safe = value > maximumDate ? maximumDate : value
    onRangeChange({
      from: !safe || (range.from && range.from <= safe) ? range.from : safe,
      to: safe,
    })
    setActiveEndpoint('to')
  }

  const hasValue = Boolean(singleDate || range.from || range.to)

  return (
    <section className="tp-date-filter" aria-label="Filtro por data de publicação">
      <div className="tp-date-filter-head">
        <div>
          <span className="tp-date-filter-kicker">Data de publicação</span>
          <strong>
            {mode === 'single'
              ? 'Selecione o dia desejado'
              : 'Selecione o intervalo desejado'}
          </strong>
        </div>
        <label className="tp-date-mode-toggle">
          <input
            type="checkbox"
            checked={mode === 'range'}
            onChange={(event) => onModeChange(event.target.checked ? 'range' : 'single')}
          />
          <span aria-hidden="true" />
          Intervalo
        </label>
      </div>

      {mode === 'single' ? (
        <div className="tp-date-single-field">
          <CalendarDays size={18} aria-hidden="true" />
          <label>
            Data
            <input
              type="date"
              value={singleDate}
              max={maximumDate}
              onChange={(event) => onSingleDateChange(event.target.value)}
            />
          </label>
          {singleDate && <small>{formatDatePt(singleDate)}</small>}
        </div>
      ) : (
        <div className="tp-date-range-fields">
          <label className={activeEndpoint === 'from' ? 'is-active' : ''}>
            <span>De:</span>
            <input
              type="date"
              value={range.from}
              max={maximumDate}
              onFocus={() => setActiveEndpoint('from')}
              onChange={(event) => updateFrom(event.target.value)}
            />
          </label>
          <label className={activeEndpoint === 'to' ? 'is-active' : ''}>
            <span>Até:</span>
            <input
              type="date"
              value={range.to}
              max={maximumDate}
              min={range.from || undefined}
              onFocus={() => setActiveEndpoint('to')}
              onChange={(event) => updateTo(event.target.value)}
            />
          </label>
          <span className="tp-date-endpoint-hint">
            Régua ajusta: <b>{activeEndpoint === 'from' ? 'De' : 'Até'}</b>
          </span>
        </div>
      )}

      <div
        className={`tp-date-ruler is-${timeline.granularity}`}
        ref={timelineRef}
        role="group"
        aria-label={`Régua temporal por ${
          timeline.granularity === 'day'
            ? 'dias'
            : timeline.granularity === 'month'
              ? 'meses'
              : 'anos'
        }`}
      >
        {timeline.periods.map((period) => {
          const selected =
            mode === 'single'
              ? periodContains(period, singleDate)
              : period.fillWidthPercent > 0
          const active = periodContains(period, anchorDate)

          return (
            <button
              key={period.key}
              ref={(node) => {
                if (node) itemRefs.current.set(period.key, node)
                else itemRefs.current.delete(period.key)
              }}
              type="button"
              className={[
                'tp-date-period',
                selected ? 'is-selected' : '',
                active ? 'is-active' : '',
              ].filter(Boolean).join(' ')}
              disabled={period.disabled}
              aria-pressed={selected}
              aria-label={
                period.disabled
                  ? `${period.primary} ${period.secondary}, data futura indisponível`
                  : `${period.primary} ${period.secondary}`
              }
              onClick={() => selectPeriod(period)}
            >
              {mode === 'range' && period.fillWidthPercent > 0 && (
                <span
                  className="tp-date-period-fill"
                  aria-hidden="true"
                  style={{
                    left: `${period.fillStartPercent}%`,
                    width: `${period.fillWidthPercent}%`,
                  }}
                />
              )}
              <span className="tp-date-period-value">{period.primary}</span>
              <span className="tp-date-period-label">{period.secondary}</span>
            </button>
          )
        })}
      </div>

      <div className="tp-date-filter-foot">
        <span>
          {mode === 'range' && range.from && range.to
            ? `${formatDatePt(range.from)} — ${formatDatePt(range.to)}`
            : singleDate
              ? formatDatePt(singleDate)
              : 'Sem filtro de data aplicado'}
        </span>
        {hasValue && (
          <button type="button" onClick={onClear}>
            Limpar data
          </button>
        )}
      </div>
    </section>
  )
}
