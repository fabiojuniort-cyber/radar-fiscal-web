import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ProductApiFetch, TaxonomyProfileDimension } from './product-api'
import { NcmProfileCard, TaxonomyDimensionPicker } from './profile-taxonomy-cards'

afterEach(() => {
  cleanup()
})

const segments: TaxonomyProfileDimension = {
  code: 'sector',
  name: 'Segmento',
  description: null,
  concepts: [
    { code: 'sector.trifaros_agro', label: 'Agropecuária, pesca e insumos agrícolas', definition: '' },
    { code: 'sector.trifaros_ali', label: 'Alimentos, bebidas e tabaco', definition: '' },
    { code: 'sector.trifaros_ind', label: 'Indústria química', definition: '' },
  ],
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
}

describe('TaxonomyDimensionPicker', () => {
  it('shows the selected tags apart from the options to browse', () => {
    const onToggle = vi.fn()
    const onRemoveDerived = vi.fn()
    render(
      <TaxonomyDimensionPicker
        dimension={segments}
        selected={new Set(['sector.trifaros_ali'])}
        onToggle={onToggle}
        onSetMany={vi.fn()}
        derived={[{ code: 'sector.trifaros_agro', label: 'Agropecuária, pesca e insumos agrícolas', source: 'do CNAE 0111301' }]}
        onRemoveDerived={onRemoveDerived}
      />,
    )

    const selected = screen.getByLabelText('Selecionados')
    expect(selected).toHaveTextContent(/Agropecuária.*do CNAE 0111301.*Alimentos, bebidas e tabaco/)
    expect(screen.getByText('3 opções · 2 selecionadas')).toBeInTheDocument()
    // Only what is not selected yet is offered below.
    const options = screen.getAllByRole('button').filter((button) => button.classList.contains('tp-profile-option'))
    expect(options.map((button) => button.textContent)).toEqual(['Indústria química'])

    fireEvent.click(within(selected).getByRole('button', { name: 'Remover Agropecuária, pesca e insumos agrícolas' }))
    expect(onRemoveDerived).toHaveBeenCalledWith(expect.objectContaining({ code: 'sector.trifaros_agro' }))
    fireEvent.click(within(selected).getByRole('button', { name: 'Remover Alimentos, bebidas e tabaco' }))
    expect(onToggle).toHaveBeenCalledWith('sector.trifaros_ali')
    fireEvent.click(options[0]!)
    expect(onToggle).toHaveBeenCalledWith('sector.trifaros_ind')
  })

  it('filters the options with the search', () => {
    render(
      <TaxonomyDimensionPicker dimension={segments} selected={new Set()} onToggle={vi.fn()} onSetMany={vi.fn()} />,
    )
    expect(screen.getByText('Nenhum selecionado.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Buscar Segmento'), { target: { value: 'quimica' } })
    const options = screen.getAllByRole('button').filter((button) => button.classList.contains('tp-profile-option'))
    expect(options.map((button) => button.textContent)).toEqual(['Indústria química'])
  })
})

describe('NcmProfileCard', () => {
  it('shows NCMs from the CNAE table locked and adds/removes the card NCMs', async () => {
    const apiFetch = vi.fn(async (input: RequestInfo | URL) => {
      const params = new URLSearchParams(String(input).split('?')[1])
      if (params.get('prefixes')) {
        return json({ items: [{ entryId: 'e1', code: '22030000', officialCode: '2203.00.00', description: 'Cervejas de malte' }] })
      }
      return json({ items: [{ entryId: 'e2', code: '10063011', officialCode: '1006.30.11', description: 'Arroz polido' }] })
    }) as ProductApiFetch
    const onChange = vi.fn()
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <NcmProfileCard
          apiFetch={apiFetch}
          codes={['22030000']}
          onChange={onChange}
          derived={[{ code: '10062099', officialCode: '1006.20.99', description: 'Arroz descascado', source: 'do CNAE 0111301' }]}
        />
      </QueryClientProvider>,
    )

    const selected = screen.getByLabelText('Selecionados')
    expect(selected).toHaveTextContent(/1006\.20\.99.*do CNAE 0111301/)
    expect(within(selected).queryByRole('button', { name: /1006\.20\.99/ })).not.toBeInTheDocument()
    fireEvent.click(await within(selected).findByRole('button', { name: 'Remover NCM 2203.00.00' }))
    expect(onChange).toHaveBeenCalledWith([])

    fireEvent.change(screen.getByLabelText('Buscar NCM'), { target: { value: 'arroz' } })
    const found = await screen.findByRole('group', { name: 'NCMs encontradas' })
    fireEvent.click(within(found).getByRole('button', { name: /1006\.30\.11/ }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['22030000', '10063011']))
  })
})
