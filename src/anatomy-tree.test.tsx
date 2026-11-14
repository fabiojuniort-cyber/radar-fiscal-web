import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { AnatomyBreadcrumb, AnatomyTree, ancestorsOf, buildTree, visibleKeys, type TreePassage } from './anatomy-tree'

// ANAT-NAV-01 — synthetic passages only (shape of the API's Passage), no official text.
afterEach(() => cleanup())
const p = (key: string, parentKey: string | null, depth: number, structure: string, label = ''): TreePassage =>
  ({ key, parentKey, depth, structure, label, type: structure === 'Artigo' ? 'article' : 'group', effectiveNature: 'operative', effectiveNatureLabel: 'Dispositivo do ato' })
const DOC = [
  p('t1', null, 0, 'Agrupamento', 'TÍTULO I'),
  p('c1', 't1', 1, 'Agrupamento', 'CAPÍTULO I'),
  p('a1', 'c1', 2, 'Artigo', 'Art. 1º'),
  p('a1p', 'a1', 3, 'Parágrafo', 'Parágrafo único'),
  p('a2', 'c1', 2, 'Artigo', 'Art. 2º'),
  p('an', null, 0, 'Anexo', 'ANEXO I'),
]

describe('pure helpers', () => {
  it('builds the nested tree in document order; orphans become roots', () => {
    const roots = buildTree([...DOC, p('orphan', 'missing', 1, 'Artigo', 'Art. 9º')])
    expect(roots.map((r) => r.passage.key)).toEqual(['t1', 'an', 'orphan'])
    expect(roots[0]!.children[0]!.children.map((c) => c.passage.key)).toEqual(['a1', 'a2'])
  })
  it('ancestors go from root to the passage and survive cycles', () => {
    expect(ancestorsOf(DOC, 'a1p').map((x) => x.key)).toEqual(['t1', 'c1', 'a1', 'a1p'])
    expect(ancestorsOf([p('x', 'y', 0, 'A'), p('y', 'x', 0, 'B')], 'x').map((q) => q.key)).toEqual(['y', 'x'])
    expect(ancestorsOf(DOC, null)).toEqual([])
  })
  it('visible keys skip descendants of collapsed nodes', () => {
    const roots = buildTree(DOC)
    expect(visibleKeys(roots, new Set())).toEqual(['t1', 'c1', 'a1', 'a1p', 'a2', 'an'])
    expect(visibleKeys(roots, new Set(['c1']))).toEqual(['t1', 'c1', 'an'])
  })
})

function Harness() {
  const [sel, setSel] = useState<string | null>(null)
  return (<><AnatomyTree passages={DOC} selected={sel} onSelect={setSel} /><AnatomyBreadcrumb passages={DOC} selected={sel} onSelect={setSel} /><output data-testid="sel">{sel ?? ''}</output></>)
}

describe('AnatomyTree (WAI-ARIA tree)', () => {
  it('exposes tree semantics: levels, expanded state and a single tab stop', () => {
    render(<Harness />)
    const tree = screen.getByRole('tree', { name: 'Estrutura do ato' })
    const items = within(tree).getAllByRole('treeitem')
    expect(items).toHaveLength(6)
    const art1 = items.find((i) => i.getAttribute('aria-label')?.startsWith('Artigo · Art. 1º'))!
    expect(art1.getAttribute('aria-level')).toBe('3')
    expect(art1.getAttribute('aria-expanded')).toBe('true')
    expect(items.filter((i) => i.tabIndex === 0)).toHaveLength(1)
  })

  it('keyboard: arrows move, Left collapses then goes to parent, Right expands, Enter selects', () => {
    render(<Harness />)
    const tree = screen.getByRole('tree')
    const focused = () => document.activeElement?.getAttribute('aria-label') ?? ''
    const first = within(tree).getAllByRole('treeitem')[0]!
    first.focus()
    fireEvent.keyDown(tree, { key: 'ArrowDown' }); expect(focused()).toMatch(/^Agrupamento · CAPÍTULO I/)
    fireEvent.keyDown(tree, { key: 'ArrowLeft' })
    expect(within(tree).queryByLabelText(/Art\. 1º/)).toBeNull()
    fireEvent.keyDown(tree, { key: 'ArrowLeft' }); expect(focused()).toMatch(/^Agrupamento · TÍTULO I/)
    fireEvent.keyDown(tree, { key: 'ArrowDown' }); fireEvent.keyDown(tree, { key: 'ArrowRight' })
    expect(within(tree).getByLabelText(/Artigo · Art\. 1º/)).toBeTruthy()
    fireEvent.keyDown(tree, { key: 'ArrowRight' }); expect(focused()).toMatch(/^Artigo · Art\. 1º/)
    fireEvent.keyDown(tree, { key: 'Enter' })
    expect(screen.getByTestId('sel').textContent).toBe('a1')
    fireEvent.keyDown(tree, { key: 'End' }); expect(focused()).toMatch(/^Anexo/)
    fireEvent.keyDown(tree, { key: 'Home' }); expect(focused()).toMatch(/^Agrupamento · TÍTULO I/)
  })

  it('click selects; breadcrumb shows the path and navigates to an ancestor', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText(/Parágrafo · Parágrafo único/))
    const crumbs = screen.getByRole('navigation', { name: 'Localização do trecho' })
    expect(within(crumbs).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Agrupamento · TÍTULO I', 'Agrupamento · CAPÍTULO I', 'Artigo · Art. 1º', 'Parágrafo · Parágrafo único'])
    expect(within(crumbs).getByText('Parágrafo · Parágrafo único').getAttribute('aria-current')).toBe('location')
    fireEvent.click(within(crumbs).getByRole('button', { name: 'Agrupamento · CAPÍTULO I' }))
    expect(screen.getByTestId('sel').textContent).toBe('c1')
  })

  it('no JSON or internal ids on screen, and an empty document renders an empty tree', () => {
    const { container } = render(<Harness />)
    expect(container.textContent).not.toMatch(/[{}]|parentKey|a1p/)
    cleanup()
    render(<AnatomyTree passages={[]} selected={null} onSelect={() => {}} />)
    expect(screen.getByRole('tree').children).toHaveLength(0)
  })
})

describe('accessible names', () => {
  it('long labels are truncated (not dropped) so siblings with the same structure stay distinguishable', () => {
    const long = (k: string, t: string) => ({ ...p(k, null, 0, 'Cláusula', t), type: 'clause' })
    render(<AnatomyTree passages={[long('x', 'Cláusula primeira Fica reduzida a base de cálculo nas saídas'), long('y', 'Cláusula segunda Este convênio entra em vigor')]} selected={null} onSelect={() => {}} />)
    const names = screen.getAllByRole('treeitem').map((i) => i.getAttribute('aria-label'))
    expect(new Set(names).size).toBe(2)
    expect(names[0]).toBe('Cláusula · Cláusula primeira Fica reduzida a base…: Dispositivo do ato')
  })
})
