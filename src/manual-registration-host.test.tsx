import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getPendingManualRegistration,
  rejectManualRegistration,
  requestManualRegistration,
  type ManualCompanyForm,
} from './manual-registration-bridge'
import { ManualRegistrationHost } from './manual-registration-host'

afterEach(() => {
  cleanup()
  if (getPendingManualRegistration()) {
    rejectManualRegistration(
      new Error('test_cleanup'),
    )
  }
})

describe('ManualRegistrationHost', () => {
  it('lets the user complete a company manually while preserving CNPJ and Local Negócio', async () => {
    const submit = vi.fn(async (
      input: ManualCompanyForm,
    ) => ({
      company: {
        id: 'company-1',
        ...input,
      },
    }))

    const registration = requestManualRegistration({
      kind: 'company',
      cnpj: '10515785000350',
      businessLocationCode: 'MATRIZ-001',
      searchCnaes: vi.fn(async () => [{ code: '0111301', description: 'Cultivo de arroz' }]),
      submit,
    })

    render(<ManualRegistrationHost />)

    expect(
      screen.getByRole('dialog', {
        name: 'Continuar manualmente',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('10.515.785/0003-50'),
    ).toHaveAttribute('readonly')
    expect(
      screen.getByDisplayValue('MATRIZ-001'),
    ).toHaveAttribute('readonly')

    fireEvent.change(
      screen.getByLabelText('Razão social'),
      {
        target: {
          value: 'Empresa Manual Ltda.',
        },
      },
    )
    fireEvent.change(
      screen.getByLabelText('UF'),
      { target: { value: 'GO' } },
    )
    fireEvent.change(
      screen.getByLabelText('Município'),
      { target: { value: 'Goiânia' } },
    )
    fireEvent.change(
      screen.getByLabelText('Inscrição Estadual'),
      { target: { value: '123456789' } },
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Continuar para CNAEs',
      }),
    )

    await screen.findByRole('dialog', { name: 'Selecionar CNAEs da empresa' })
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /0111301.*Cultivo de arroz/ })).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText('Lista suspensa de CNAEs oficiais'), {
      target: { value: '0111301' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar CNAE selecionado' }))
    expect(submit).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }))

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        legalName: 'Empresa Manual Ltda.',
        uf: 'GO',
        municipalityName: 'Goiânia',
        postalCode: undefined,
        street: undefined,
        streetNumber: undefined,
        district: undefined,
        stateRegistration: '123456789',
        cnaes: [{ code: '0111301', description: 'Cultivo de arroz', isPrimary: true }],
        reactivateInactive: false,
      })
    })

    await expect(registration).resolves.toMatchObject({
      company: {
        id: 'company-1',
        legalName: 'Empresa Manual Ltda.',
        uf: 'GO',
      },
    })

    expect(
      screen.queryByRole('dialog'),
    ).not.toBeInTheDocument()
  })
  it('requires a second explicit confirmation before reactivating an inactive company', async () => {
    const submit = vi.fn(async (input: ManualCompanyForm) => {
      if (!input.reactivateInactive) throw new Error('reactivation_required')
      return { company: { id: 'company-restored' } }
    })
    const operation = requestManualRegistration({
      kind: 'company',
      cnpj: '10515785000350',
      searchCnaes: vi.fn(async () => [{ code: '6201501', description: 'Desenvolvimento de programas' }]),
      submit,
    })
    render(<ManualRegistrationHost />)
    fireEvent.change(screen.getByLabelText('Razão social'), { target: { value: 'Empresa Preservada' } })
    fireEvent.change(screen.getByLabelText('UF'), { target: { value: 'GO' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar para CNAEs' }))
    await screen.findByRole('option', { name: /6201501/ })
    fireEvent.change(screen.getByLabelText('Lista suspensa de CNAEs oficiais'), {
      target: { value: '6201501' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar CNAE selecionado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Concluir cadastro' }))
    await screen.findByRole('button', { name: 'Confirmar reativação' })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0]?.[0]?.reactivateInactive).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reativação' }))
    await expect(operation).resolves.toMatchObject({ company: { id: 'company-restored' } })
    expect(submit).toHaveBeenCalledTimes(2)
    expect(submit.mock.calls[1]?.[0]?.reactivateInactive).toBe(true)
  })

})
