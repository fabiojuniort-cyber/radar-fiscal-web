import { useEffect, useMemo, useState } from 'react'

import {
  todayInSaoPaulo,
  type ArchiveDateMode,
  type ArchiveDateRange,
} from './archive-date-filter'

const STORAGE_KEY = 'tribusca.archive.date'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export type ArchiveDateFilterState = {
  mode: ArchiveDateMode
  singleDate: string
  range: ArchiveDateRange
  maxDate: string
  setMode: (mode: ArchiveDateMode) => void
  setSingleDate: (value: string) => void
  setRange: (value: ArchiveDateRange) => void
  clear: () => void
  apiFilters: {
    publishedOn?: string
    publishedFrom?: string
    publishedTo?: string
  }
  queryKey: readonly [ArchiveDateMode, string, string, string]
}

type StoredState = {
  mode?: ArchiveDateMode
  singleDate?: string
  from?: string
  to?: string
}

function validDate(value: string | null, maxDate: string): string {
  if (!value || !ISO_DATE.test(value) || value > maxDate) return ''
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : ''
}

function readStored(maxDate: string): StoredState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as StoredState
    return {
      mode: parsed.mode === 'range' ? 'range' : 'single',
      singleDate: validDate(parsed.singleDate ?? null, maxDate),
      from: validDate(parsed.from ?? null, maxDate),
      to: validDate(parsed.to ?? null, maxDate),
    }
  } catch {
    return {}
  }
}

function readInitial(maxDate: string): Required<StoredState> {
  const stored = readStored(maxDate)
  const params = new URLSearchParams(window.location.search)
  const urlDate = validDate(params.get('date'), maxDate)
  const urlFrom = validDate(params.get('from'), maxDate)
  const urlTo = validDate(params.get('to'), maxDate)
  const hasRangeInUrl = params.get('range') === '1' || Boolean(urlFrom || urlTo)
  const hasDateInUrl = Boolean(urlDate)

  const mode: ArchiveDateMode = hasRangeInUrl
    ? 'range'
    : hasDateInUrl
      ? 'single'
      : stored.mode === 'range'
        ? 'range'
        : 'single'

  return {
    mode,
    singleDate: hasDateInUrl ? urlDate : stored.singleDate ?? '',
    from: hasRangeInUrl ? urlFrom : stored.from ?? '',
    to: hasRangeInUrl ? urlTo : stored.to ?? '',
  }
}

function replaceDateQuery(
  mode: ArchiveDateMode,
  singleDate: string,
  from: string,
  to: string,
) {
  const url = new URL(window.location.href)
  url.searchParams.delete('date')
  url.searchParams.delete('from')
  url.searchParams.delete('to')
  url.searchParams.delete('range')

  if (mode === 'single') {
    if (singleDate) url.searchParams.set('date', singleDate)
  } else {
    url.searchParams.set('range', '1')
    if (from) url.searchParams.set('from', from)
    if (to) url.searchParams.set('to', to)
  }

  window.history.replaceState(window.history.state, '', url)
}

export function useArchiveDateFilterState(): ArchiveDateFilterState {
  const maxDate = useMemo(() => todayInSaoPaulo(), [])
  const initial = useMemo(() => readInitial(maxDate), [maxDate])
  const [mode, setModeState] = useState<ArchiveDateMode>(initial.mode)
  const [singleDate, setSingleDateState] = useState(initial.singleDate)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)

  useEffect(() => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mode, singleDate, from, to }),
    )
    replaceDateQuery(mode, singleDate, from, to)
  }, [mode, singleDate, from, to])

  const setMode = (next: ArchiveDateMode) => {
    if (next === mode) return
    if (next === 'range') {
      if (singleDate && !from && !to) {
        setFrom(singleDate)
        setTo(singleDate)
      }
    } else if (!singleDate) {
      setSingleDateState(to || from)
    }
    setModeState(next)
  }

  const setSingleDate = (value: string) => {
    setSingleDateState(validDate(value, maxDate))
  }

  const setRange = (value: ArchiveDateRange) => {
    let safeFrom = validDate(value.from, maxDate)
    let safeTo = validDate(value.to, maxDate)
    if (safeFrom && safeTo && safeFrom > safeTo) {
      ;[safeFrom, safeTo] = [safeTo, safeFrom]
    }
    setFrom(safeFrom)
    setTo(safeTo)
  }

  const clear = () => {
    setSingleDateState('')
    setFrom('')
    setTo('')
  }

  const apiFilters = mode === 'single'
    ? singleDate
      ? { publishedOn: singleDate }
      : {}
    : {
        ...(from ? { publishedFrom: from } : {}),
        ...(to ? { publishedTo: to } : {}),
      }

  return {
    mode,
    singleDate,
    range: { from, to },
    maxDate,
    setMode,
    setSingleDate,
    setRange,
    clear,
    apiFilters,
    queryKey: [mode, singleDate, from, to] as const,
  }
}
