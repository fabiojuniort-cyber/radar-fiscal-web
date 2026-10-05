import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { CurationGrid } from './taxonomy-grid'
import type { CurationConcept, CurationDimension, CurationGroup } from './taxonomy-api'
import type { ProductApiFetch } from './product-api'

afterEach(cleanup)

it('keeps edits across CNAE pages and filters the entire dataset with code before description', () => {
  const dimension = { code: 'sector', name: 'Segmento', usesGroups: true, officialCodeType: 'CNAE' } as CurationDimension
  const groups = [{ id: 'g', label: 'Agro / Produção', displayOrder: 1, segmentCodes: ['sector.agro'] }] as CurationGroup[]
  const general = { code: 'sector.agro', label: 'Agropecuária', membershipStatus: 'INCLUDED', officialCodes: [], aliases: [], groupId: null } as unknown as CurationConcept
  const activities = Array.from({ length: 51 }, (_, index) => ({
    ...general,
    code: `sector.cnae_${index}`, label: `Cultivo ${index + 1}`, membershipStatus: 'INCLUDED', groupId: 'g',
    officialCodes: [String(111301 + index).padStart(7, '0')], aliases: [], profileVisible: true,
    classifyByLabel: true, displayOrder: index,
  }))
  render(<CurationGrid dimension={dimension} groups={groups} concepts={[general, ...activities]} segments={[general]}
    apiFetch={(() => { throw new Error('unexpected mutation') }) as ProductApiFetch} editable justification="Teste"
    showRetired={false} query="" onChanged={async () => {}} onOpenDetail={() => {}} />)
  const headers = within(screen.getByRole('table')).getAllByRole('columnheader').map(cell => cell.textContent)
  expect(headers.indexOf('CNAE')).toBeLessThan(headers.indexOf('Descrição do CNAE'))
  expect(headers).toContain('Subsegmento')
  expect(screen.getAllByLabelText('Descrição do CNAE')).toHaveLength(50)
  fireEvent.change(screen.getAllByLabelText('Descrição do CNAE')[0]!, { target: { value: 'Cultivo revisado' } })
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
  expect(screen.getAllByLabelText('Descrição do CNAE')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }))
  expect(screen.getAllByLabelText('Descrição do CNAE')[0]).toHaveValue('Cultivo revisado')
  fireEvent.change(screen.getByLabelText('Filtrar CNAE'), { target: { value: '0111-3/51' } })
  expect(screen.getAllByLabelText('Descrição do CNAE')).toHaveLength(1)
  expect(screen.getByLabelText('Descrição do CNAE')).toHaveValue('Cultivo 51')
  expect(screen.getByRole('button', { name: /Salvar alterações/ })).toBeEnabled()
})
