import { useMemo, useRef, useState, type KeyboardEvent } from 'react'

/**
 * ANAT-NAV-01: hierarchical navigation of an act's anatomy (WAI-ARIA tree pattern). Built only from the passages the
 * API already returns (key, parentKey, depth, structure, label): no new contract, no JSON on screen.
 */
export interface TreePassage { key: string; parentKey: string | null; depth: number; structure: string; label: string; type: string; effectiveNature: string; effectiveNatureLabel: string }
export interface TreeNode<P extends TreePassage> { passage: P; children: TreeNode<P>[] }

/** Nested nodes in document order. A passage whose parent is not a passage (hidden container) becomes a root. */
export function buildTree<P extends TreePassage>(passages: readonly P[]): TreeNode<P>[] {
  const nodes = new Map(passages.map((p) => [p.key, { passage: p, children: [] as TreeNode<P>[] }]))
  const roots: TreeNode<P>[] = []
  for (const p of passages) {
    const node = nodes.get(p.key)!
    const parent = p.parentKey ? nodes.get(p.parentKey) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/** Keys of the ancestors of `key`, root first (for the breadcrumb). */
export function ancestorsOf<P extends TreePassage>(passages: readonly P[], key: string | null): P[] {
  const byKey = new Map(passages.map((p) => [p.key, p]))
  const chain: P[] = []
  let current = key ? byKey.get(key) : undefined
  const seen = new Set<string>()
  while (current && !seen.has(current.key)) {
    seen.add(current.key); chain.unshift(current)
    current = current.parentKey ? byKey.get(current.parentKey) : undefined
  }
  return chain
}

/** Visible keys in order, given the collapsed set (what the arrow keys walk through). */
export function visibleKeys<P extends TreePassage>(roots: readonly TreeNode<P>[], collapsed: ReadonlySet<string>): string[] {
  const out: string[] = []
  const walk = (n: TreeNode<P>) => { out.push(n.passage.key); if (!collapsed.has(n.passage.key)) n.children.forEach(walk) }
  roots.forEach(walk)
  return out
}

/** Structure plus the start of the passage label (truncated, never dropped) so sibling items stay distinguishable. */
const short = (p: TreePassage) => {
  const label = p.type === 'unidentified' ? '' : p.label.replace(/\s+/gu, ' ').trim()
  return label ? `${p.structure} · ${label.length > 40 ? `${label.slice(0, 39).trimEnd()}…` : label}` : p.structure
}

export function AnatomyTree<P extends TreePassage>({ passages, selected, onSelect }: { passages: readonly P[]; selected: string | null; onSelect: (key: string) => void }) {
  const roots = useMemo(() => buildTree(passages), [passages])
  const parentOf = useMemo(() => new Map(passages.map((p) => [p.key, p.parentKey])), [passages])
  const hasKids = useMemo(() => new Set(passages.filter((p) => p.parentKey).map((p) => p.parentKey!)), [passages])
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLLIElement>())
  const order = visibleKeys(roots, collapsed)
  const active = focusKey && order.includes(focusKey) ? focusKey : (selected && order.includes(selected) ? selected : order[0] ?? null)
  const focus = (key: string | undefined) => { if (!key) return; setFocusKey(key); refs.current.get(key)?.focus() }
  const toggle = (key: string, open?: boolean) => setCollapsed((prev) => {
    const next = new Set(prev); const isOpen = !next.has(key)
    if (open ?? !isOpen) next.delete(key); else next.add(key)
    return next
  })
  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (!active) return
    const i = order.indexOf(active)
    const handled = (() => {
      switch (e.key) {
        case 'ArrowDown': focus(order[i + 1]); return true
        case 'ArrowUp': focus(order[i - 1]); return true
        case 'Home': focus(order[0]); return true
        case 'End': focus(order[order.length - 1]); return true
        case 'ArrowRight':
          if (hasKids.has(active) && collapsed.has(active)) toggle(active, true)
          else if (hasKids.has(active)) focus(order[i + 1])
          return true
        case 'ArrowLeft':
          if (hasKids.has(active) && !collapsed.has(active)) toggle(active, false)
          else { const parent = parentOf.get(active); if (parent) focus(parent) }
          return true
        case 'Enter': case ' ': onSelect(active); return true
        default: return false
      }
    })()
    if (handled) e.preventDefault()
  }
  const render = (n: TreeNode<P>) => {
    const p = n.passage; const kids = n.children.length > 0; const open = !collapsed.has(p.key)
    return (
      <li key={p.key} role="treeitem" aria-level={p.depth + 1} aria-selected={p.key === selected} aria-expanded={kids ? open : undefined}
        tabIndex={p.key === active ? 0 : -1} ref={(el) => { if (el) refs.current.set(p.key, el); else refs.current.delete(p.key) }}
        aria-label={`${short(p)}: ${p.effectiveNatureLabel}`} onFocus={(e) => { if (e.target === e.currentTarget) setFocusKey(p.key) }}
        onClick={(e) => { e.stopPropagation(); setFocusKey(p.key); onSelect(p.key) }}>
        <span className="ac-tree-row">
          {kids
            ? <span className="ac-tree-twisty" aria-hidden="true" onClick={(e) => { e.stopPropagation(); toggle(p.key) }}>{open ? '▾' : '▸'}</span>
            : <span className="ac-tree-twisty" aria-hidden="true" />}
          <span className={`ac-dot k-${p.effectiveNature}`} aria-hidden="true" />
          <span className="ac-tree-label">{short(p)}</span>
        </span>
        {kids && open && <ul role="group">{n.children.map(render)}</ul>}
      </li>
    )
  }
  return <ul role="tree" aria-label="Estrutura do ato" onKeyDown={onKey}>{roots.map(render)}</ul>
}

/** "Você está em": the path from the root to the selected passage, each step clickable. */
export function AnatomyBreadcrumb<P extends TreePassage>({ passages, selected, onSelect }: { passages: readonly P[]; selected: string | null; onSelect: (key: string) => void }) {
  const chain = ancestorsOf(passages, selected)
  if (chain.length === 0) return null
  return (
    <nav className="ac-crumbs" aria-label="Localização do trecho">
      <ol>
        {chain.map((p, i) => (
          <li key={p.key}>
            {i < chain.length - 1
              ? <button type="button" onClick={() => onSelect(p.key)}>{short(p)}</button>
              : <span aria-current="location">{short(p)}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
