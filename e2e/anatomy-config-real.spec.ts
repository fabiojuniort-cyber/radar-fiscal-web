import { expect, test, type Page } from '@playwright/test'

/**
 * ANAT-CONFIG-01 — complete flow against the REAL API (backend routes + SQL entry points of 081 + isolated executor +
 * disposable PostgreSQL with the project's migrations), served by the backend harness
 * test/support/anatomy-config-dev-server.ts. Runs only with ANAT_REAL_API=1 and a build with VITE_ENABLE_ANAT_CONFIG=true
 * proxied to the harness (AUTH_PROXY_TARGET). Synthetic users and synthetic acts only; no credentials appear.
 * Screenshots and the video go to docs/evidence/anat-config-01/.
 */
test.skip(process.env.ANAT_REAL_API !== '1', 'needs the local anatomy config dev harness')
test.describe.configure({ mode: 'serial' })
const dir = 'docs/evidence/anat-config-01'
const shot = (page: Page, name: string) => page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: true })
const as = async (page: Page, who: 'ana' | 'bruno' | 'visitante') => { await page.goto(`/auth/__dev-login?as=${who}`) }
const ready = async (page: Page) => { await expect(page.getByRole('heading', { name: 'Anatomia dos atos' })).toBeVisible(); await expect(page.locator('.ac-seg').first()).toBeVisible({ timeout: 30_000 }) }
const SIGNATURE = 'Presidente do CONFAZ - Fulano Exemplo'
const openDoc = async (page: Page, name: RegExp) => { await page.getByRole('button', { name }).click(); await expect(page.locator('.ac-doc-head')).toBeVisible() }
const newAnalysis = async (page: Page) => {
  const box = page.getByRole('region', { name: 'Nova análise do documento' })
  const status = box.getByRole('status')
  const previous = (await status.count()) ? (await status.innerText()).trim() : null
  await box.getByRole('button', { name: 'Nova análise deste documento' }).click()
  if (previous === null) await expect(status).toBeVisible({ timeout: 30_000 })
  else await expect(status).not.toHaveText(previous, { timeout: 30_000 })
  return (await status.innerText()).trim()
}
const testAndSave = async (page: Page, note: string) => {
  const pending = page.getByRole('region', { name: 'Alterações em preparação' })
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(pending.getByText(/Resultado do teste em \d+ atos de exemplo/u)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Salvar configuração' }).click()
  const confirm = page.getByRole('region', { name: 'Confirmar salvamento' })
  await expect(confirm).toContainText('Nada do acervo é reprocessado')
  await confirm.getByLabel('Observação (opcional)').fill(note)
  return confirm
}

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } } })

test('fluxo completo: análise antes → corrigir trecho e regra → salvar (aplica) → nova análise → semelhante intacto → versão modificada → concorrência → restaurar', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'the mutating flow runs once; other viewports check the layout')
  test.setTimeout(240_000)

  // Authorisation: a non-admin cannot open the screen (API answers 403 with a Portuguese message).
  await as(page, 'visitante')
  await expect(page.getByRole('alert')).toContainText('Somente administradores da plataforma')
  await shot(page, '00-nao-admin')

  // 1. Administrator: shipped configuration, synthetic acts, act + structure side by side, no JSON editor.
  await as(page, 'ana'); await ready(page)
  await expect(page.getByText('Configuração de fábrica')).toBeVisible()
  await expect(page.locator('.ac-banner')).toContainText('Exemplos sintéticos')
  await expect(page.locator('textarea')).toHaveCount(0)
  await shot(page, '01-ato-e-estrutura')

  // 2. Analysis BEFORE any change, through the real consumer (recorded): version 0, the signature is read as body text.
  await openDoc(page, /redação anterior e nota de alteração/u)
  expect(await newAnalysis(page)).toContain('configuração versão 0, 0 correção(ões) aplicada(s)')
  const panel = page.getByRole('region', { name: 'Trecho selecionado' })
  await page.locator('.ac-seg', { hasText: SIGNATURE }).click()
  await expect(panel.locator('.ac-dims')).toContainText('Dispositivo do ato')
  await expect(page.locator('.ac-tree button[aria-current="true"]')).toBeVisible() // tree and text are linked
  await expect(panel.getByText(/notas e estilos não decidem a vigência/u)).toBeVisible()
  await expect(panel.getByText(/Segunda conferência/u)).toBeVisible()
  await shot(page, '02-analise-antes')

  // 3. A. Correct ONE passage without writing a rule: reason required; undo works.
  await panel.getByLabel('Este trecho é').selectOption('structure')
  await panel.getByRole('button', { name: 'Registrar correção' }).click()
  await expect(panel.getByRole('alert')).toContainText('Informe o motivo da correção')
  await panel.getByLabel('Motivo (obrigatório)').fill('Teste de desfazer')
  await panel.getByRole('button', { name: 'Registrar correção' }).click()
  await page.getByRole('button', { name: 'Desfazer correções' }).click()
  await expect(panel.getByText(/Correção nesta proposta/u)).toHaveCount(0)
  await panel.getByLabel('Motivo (obrigatório)').fill('É a assinatura do ato, não um dispositivo')
  await panel.getByRole('button', { name: 'Registrar correção' }).click()
  await expect(panel.getByText(/Correção nesta proposta: Elemento estrutural/u)).toBeVisible()

  // 4. B. Rule for similar passages with explicit scope, on another document.
  await openDoc(page, /Ajuste fictício do CONFAZ/u)
  await page.locator('.ac-seg', { hasText: 'Acrescentado pelo' }).click()
  await panel.getByLabel('Tratar como').selectOption('editorial_note')
  await panel.getByRole('button', { name: 'Ver sugestão' }).click()
  await expect(panel.getByText('Incluir "NotaAlteracao" em estilo de nota editorial — Fonte: CONFAZ')).toBeVisible()
  await expect(panel.getByLabel('Alcance')).toHaveValue('source')
  await panel.getByRole('button', { name: 'Adicionar à proposta' }).click()
  await expect(page.getByRole('button', { name: 'Salvar configuração' })).toBeDisabled() // test first
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  const pending = page.getByRole('region', { name: 'Alterações em preparação' })
  await expect(pending.getByText(/Resultado do teste em \d+ atos de exemplo/u)).toBeVisible({ timeout: 30_000 })
  await expect(pending.getByText('2 trecho(s) mudam de natureza em 2 ato(s).')).toBeVisible() // the rule + the one correction
  await shot(page, '03-previa-regra-e-correcao')

  // 5. Specific error: removing a factory protection is refused, nothing saved; undo the edit clears the message.
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('button', { name: 'Retirar Remisso de Estilo de nota editorial' }).first().click()
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(pending.getByRole('alert')).toContainText('"Remisso" é proteção de fábrica em estilo de nota editorial e não pode ser retirado.')
  await shot(page, '04-mensagem-de-validacao')
  await pending.getByRole('button', { name: 'Desfazer' }).nth(1).click()
  await expect(pending.getByRole('alert')).toHaveCount(0)

  // 6. Save = validate + apply (one action, one administrator).
  const confirm = await testAndSave(page, 'Estilo de nota do CONFAZ e assinatura do Convênio 901 (sintético)')
  await shot(page, '05-confirmar-salvamento')
  await confirm.getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(page.getByText(/Configuração salva e aplicada \(versão 1\)/u)).toBeVisible()

  // 7. New analysis with the saved version: the correction is APPLIED on top of the engine result, shown apart.
  await openDoc(page, /redação anterior e nota de alteração/u)
  expect(await newAnalysis(page)).toContain('configuração versão 1, 1 correção(ões) aplicada(s)')
  await page.locator('.ac-seg', { hasText: SIGNATURE }).click()
  const applied = panel.getByRole('note', { name: 'Correção administrativa aplicada' })
  await expect(applied).toContainText('Elemento estrutural (o motor produziu "Dispositivo do ato")')
  await expect(applied).toContainText('Motivo: É a assinatura do ato, não um dispositivo · por ana@example.test · desde a versão 1')
  await shot(page, '06-correcao-aplicada')
  await openDoc(page, /Ajuste fictício do CONFAZ/u)
  await newAnalysis(page)
  await page.locator('.ac-seg', { hasText: 'Acrescentado pelo' }).click()
  await expect(panel.locator('.ac-dims')).toContainText('Nota editorial') // the rule applies

  // 8. A similar document with the same line is unchanged (a correction is never widened).
  await openDoc(page, /Outro convênio fictício/u)
  expect(await newAnalysis(page)).toContain('0 correção(ões) aplicada(s)')
  await page.locator('.ac-seg', { hasText: SIGNATURE }).click()
  await expect(panel.locator('.ac-dims')).toContainText('Dispositivo do ato')
  await expect(panel.getByRole('note', { name: 'Correção administrativa aplicada' })).toHaveCount(0)
  await shot(page, '07-documento-semelhante-intacto')

  // 9. A modified version of the corrected document does not receive it silently: reported stale.
  await openDoc(page, /versão 2/u)
  expect(await newAnalysis(page)).toContain('1 desatualizada(s) não aplicada(s)')
  await page.getByRole('tab', { name: /Conferência/u }).click()
  await expect(page.getByRole('region', { name: 'Casos que precisam de conferência' }).getByText('Correção desatualizada (não aplicada)')).toBeVisible()
  await shot(page, '08-versao-modificada-correcao-desatualizada')

  // 10. Concurrency: Bruno opens version 1 and TESTS his proposal on it; Ana then saves version 2 (removing the
  //     correction); Bruno's save, based on his tested version 1, is refused with 409 and his edits stay.
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const b = await ctxB.newPage()
  await as(b, 'bruno'); await ready(b)
  await b.getByRole('tab', { name: 'Regras' }).click()
  await b.getByLabel('Tipo de regra').selectOption('classes.editorialNote')
  await b.getByLabel('Texto', { exact: true }).fill('NotaBruno')
  await b.getByRole('button', { name: 'Adicionar à proposta' }).click()
  const confirmB = await testAndSave(b, 'Bruno (sintético)')
  await openDoc(page, /redação anterior e nota de alteração/u)
  await page.locator('.ac-seg', { hasText: SIGNATURE }).click()
  await page.getByRole('tab', { name: 'Trecho' }).click()
  await panel.getByRole('button', { name: 'Retirar correção' }).click()
  await (await testAndSave(page, 'Sem a correção da assinatura (sintético)')).getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(page.getByText(/versão 2/u).first()).toBeVisible()
  expect(await newAnalysis(page)).toContain('configuração versão 2, 0 correção(ões) aplicada(s)')
  await confirmB.getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(b.getByRole('alert')).toContainText('Outra pessoa salvou uma configuração depois que você começou')
  await expect(b.getByText(/Incluir "NotaBruno"/u)).toBeVisible()
  await b.screenshot({ path: `${dir}/${info.project.name}-09-concorrencia-bruno.png`, fullPage: true })
  await ctxB.close()

  // 11. C. Restore version 1 (a new version 3): the correction and the rule come back in a new analysis.
  await page.getByRole('tab', { name: 'Histórico' }).click()
  const hist = page.getByRole('region', { name: 'Histórico de versões' })
  await hist.locator('li').filter({ has: page.getByText('Versão 1', { exact: true }) }).getByRole('button', { name: 'Restaurar esta versão' }).click()
  await hist.getByLabel('Motivo (opcional)').fill('Voltar à versão com a correção (sintético)')
  await hist.getByRole('button', { name: 'Confirmar restauração' }).click()
  await expect(page.getByText(/restaurada como versão 3/u)).toBeVisible()
  await expect(hist.getByText('Restauração da versão 1 — Voltar à versão com a correção (sintético)')).toBeVisible()
  await expect(hist.getByText(/Tentativa recusada · versão desatualizada/u)).toBeVisible()
  expect(await newAnalysis(page)).toContain('configuração versão 3, 1 correção(ões) aplicada(s)')
  const box = page.getByRole('region', { name: 'Nova análise do documento' })
  await box.getByText(/Análises registradas deste documento/u).click()
  await shot(page, '10-restaurado-historico-e-analises')

  const state = await (await request.get('/auth/__dev-state')).json() as { current: { version: number }; versions: { kind: string }[];
    audit: { action: string; data: Record<string, unknown> }[]; analyses: { documentId: string; documentVersion: string; configVersion: number; applied: number; stale: number }[] }
  expect(state.current.version).toBe(3)
  expect(state.versions.map((v) => v.kind)).toEqual(['save', 'save', 'restore'])
  expect(state.audit.filter((a) => a.action !== 'ANAT_RULES_CONFIG_ANALYZED').map((a) => `${a.action}:${String(a.data.kind ?? a.data.code)}`)).toEqual([
    'ANAT_RULES_CONFIG_SAVED:SAVE', 'ANAT_RULES_CONFIG_SAVED:SAVE', 'ANAT_RULES_CONFIG_REJECTED:STALE_VERSION', 'ANAT_RULES_CONFIG_SAVED:RESTORE'])
  expect(state.analyses.map((a) => `${a.documentId}@${a.documentVersion}:v${a.configVersion}:${a.applied}/${a.stale}`)).toEqual([
    'sint-confaz-convenio@v1:v0:0/0', 'sint-confaz-convenio@v1:v1:1/0', 'sint-confaz-estilo-novo@v1:v1:0/0', 'sint-confaz-convenio-outro@v1:v1:0/0',
    'sint-confaz-convenio@v2:v1:0/1', 'sint-confaz-convenio@v1:v2:0/0', 'sint-confaz-convenio@v1:v3:1/0'])
})

test('layout responsivo com a configuração restaurada', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1440x900', 'covered above')
  await as(page, 'ana'); await ready(page)
  await page.locator('.ac-seg').nth(3).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await shot(page, 'layout')
})
