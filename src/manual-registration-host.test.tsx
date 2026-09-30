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
        name: 'Cadastrar manualmente',
      }),
    )

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
})
