/** T06 manual IE fallback: lack of provider is not proof of missing IE. */
export type StateIeLookupStatus = 'SUCCESS' | 'NOT_FOUND' | 'UNAVAILABLE' | 'NOT_SUPPORTED' | null

export function manualIeActionLabel(
  registration: string | null,
  lookupStatus: StateIeLookupStatus,
): string {
  return !registration &&
    (lookupStatus === 'NOT_SUPPORTED' ||
     lookupStatus === 'UNAVAILABLE' ||
     lookupStatus === 'NOT_FOUND')
    ? 'Informar IE manualmente'
    : 'Editar estabelecimento'
}

export function manualIeHelperText(
  uf: string,
  lookupStatus: StateIeLookupStatus,
): string {
  if (lookupStatus === 'NOT_SUPPORTED') {
    return uf === 'MG'
      ? 'MG: consulta por arquivo semanal aguarda autorização de uso. Você pode informar a IE manualmente.'
      : 'Sem consulta automática para esta UF. Você pode informar a IE manualmente.'
  }
  if (lookupStatus === 'UNAVAILABLE')
    return 'Consulta estadual indisponível. A IE pode ser informada manualmente.'
  if (lookupStatus === 'NOT_FOUND')
    return 'IE não localizada nesta consulta; confira e informe manualmente quando aplicável.'
  return ''
}
