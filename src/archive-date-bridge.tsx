import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { ArchiveDateFilter } from './archive-date-filter'
import { useArchiveDateFilterState } from './archive-date-state'
import './archive-date-layout-fix.css'

const HOST_ATTRIBUTE = 'data-archive-date-host'

function findArchiveMain(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".tp-main-acervo:not([data-acervo-view='navegacao'])")
}

function ensureArchiveDateHost(main: HTMLElement): HTMLElement {
  const existing = main.querySelector<HTMLElement>(`[${HOST_ATTRIBUTE}]`)
  if (existing) return existing

  const host = document.createElement('div')
  host.setAttribute(HOST_ATTRIBUTE, 'true')

  const layout = main.querySelector('.tp-acervo-layout')
  if (layout) main.insertBefore(host, layout)
  else main.appendChild(host)

  return host
}

function resetPersistedArchivePage() {
  try {
    const raw = sessionStorage.getItem('tribusca.panel.state')
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, unknown>
    parsed.archivePage = 1
    sessionStorage.setItem('tribusca.panel.state', JSON.stringify(parsed))
  } catch {
    // Persistence is a convenience only; the live UI reset below is authoritative.
  }
}

function resetLiveArchivePage() {
  const main = findArchiveMain()
  if (!main) return

  const pageOne = [...main.querySelectorAll<HTMLButtonElement>('.tp-page-numbers button')]
    .find((button) => button.textContent?.trim() === '1')

  if (pageOne && pageOne.getAttribute('aria-current') !== 'page') {
    pageOne.click()
  }
}

function ArchiveDateBridgeActive({ host }: { host: HTMLElement }) {
  const queryClient = useQueryClient()
  const date = useArchiveDateFilterState()
  const initialized = useRef(false)

  useEffect(() => {
    // The first pass synchronizes persisted/URL state without destroying the
    // page restored by the panel. Only an actual date change returns to page 1.
    if (initialized.current) {
      resetPersistedArchivePage()
      resetLiveArchivePage()
    } else {
      initialized.current = true
    }

    void queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey
        return key[0] === 'launch' && key[1] === 'archive-v2' && key.length > 3
      },
    })
  }, [
    date.mode,
    date.singleDate,
    date.range.from,
    date.range.to,
    queryClient,
  ])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest('button')
      if (!button || !button.closest('.tp-filter-panel')) return
      if (button.textContent?.trim() !== 'Limpar filtros') return
      date.clear()
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [date])

  return createPortal(
    <ArchiveDateFilter
      mode={date.mode}
      singleDate={date.singleDate}
      range={date.range}
      maxDate={date.maxDate}
      onModeChange={date.setMode}
      onSingleDateChange={date.setSingleDate}
      onRangeChange={date.setRange}
      onClear={date.clear}
    />,
    host,
  )
}

/**
 * DATE-01 lives beside the authenticated panel so the large product panel
 * remains focused on navigation/catalog state. The bridge mounts the ruler
 * only while the Acervo surface exists and places it immediately before the
 * filter/results layout.
 */
export function ArchiveDateBridge() {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const sync = () => {
      const main = findArchiveMain()
      setHost(main ? ensureArchiveDateHost(main) : null)
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return host ? <ArchiveDateBridgeActive host={host} /> : null
}
