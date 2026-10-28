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

test.use({ video: { mode: 'on', size: { width: 1280, height: 800 } } })

test('fluxo completo: ver o ato → corrigir trecho → regra para semelhantes → testar → salvar (aplica) → concorrência → restaurar → auditoria', async ({ page, browser, request }, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'the mutating flow runs once; other viewports check the layout')
  test.setTimeout(180_000)

  // Non-admin: the screen does not open for them (the API answers 403 with a Portuguese message).
  await as(page, 'visitante')
  await expect(page.getByRole('alert')).toContainText('Somente administradores da plataforma')
  await shot(page, '00-nao-admin')

  // 1. Administrator opens the screen: shipped configuration, synthetic acts, act + structure side by side.
  await as(page, 'ana'); await ready(page)
  await expect(page.getByText('Configuração de fábrica')).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Exemplos sintéticos')
  await expect(page.locator('textarea')).toHaveCount(0) // no JSON editor anywhere
  await shot(page, '01-ato-e-estrutura')

  // 2. Select a passage: structure, nature and validity apart; the AI reading with evidence and second check.
  await page.getByRole('button', { name: /Ajuste fictício do CONFAZ/u }).click()
  await page.locator('.ac-seg', { hasText: 'Acrescentado pelo' }).click()
  const panel = page.getByRole('region', { name: 'Trecho selecionado' })
  await expect(panel.getByText('A conferir (não reconhecido)').first()).toBeVisible()
  await expect(panel.getByText('Leitura da IA')).toBeVisible()
  await expect(panel.getByText(/Evidência:/u)).toBeVisible()
  await expect(panel.getByText(/Segunda conferência/u)).toBeVisible()
  await expect(panel.getByText(/notas e estilos não decidem a vigência/u)).toBeVisible()
  // The structure tree is linked to the text: the same passage is current in the tree.
  await expect(page.locator('.ac-tree button[aria-current="true"]')).toContainText('Não identificado')
  await shot(page, '02-trecho-e-leitura-da-ia')

  // 3. Undo an edit: add a passage correction, then undo it.
  await panel.getByLabel('Este trecho é').selectOption('editorial_note')
  await panel.getByRole('button', { name: 'Registrar correção' }).click()
  await expect(panel.getByText(/Sua correção: Nota editorial/u)).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer correções' }).click()
  await expect(panel.getByText(/Sua correção/u)).toHaveCount(0)

  // 4. Rule for similar passages, with explicit scope; then test (real before/after counts).
  await panel.getByLabel('Tratar como').selectOption('editorial_note')
  await panel.getByRole('button', { name: 'Ver sugestão' }).click()
  await expect(panel.getByText('Incluir "NotaAlteracao" em estilo de nota editorial — Fonte: CONFAZ')).toBeVisible()
  await expect(panel.getByLabel('Alcance')).toHaveValue('source')
  await shot(page, '03-sugestao-de-regra')
  await panel.getByRole('button', { name: 'Adicionar à proposta' }).click()
  await expect(page.getByRole('button', { name: 'Salvar configuração' })).toBeDisabled() // must test first
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  const pending = page.getByRole('region', { name: 'Alterações em preparação' })
  await expect(pending.getByText(/Resultado do teste em 6 atos de exemplo/u)).toBeVisible({ timeout: 30_000 })
  await expect(pending.getByText('1 trecho(s) mudam de natureza em 1 ato(s).')).toBeVisible()
  await expect(pending.getByText('Casos a conferir: 7 → 6.')).toBeVisible()
  await expect(page.locator('.ac-seg.chg')).toContainText('antes: A conferir (não reconhecido)')
  await shot(page, '04-previa-antes-depois')

  // 5. Invalid input: proposing to remove a factory protection gets a specific Portuguese message; nothing is saved.
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByRole('button', { name: 'Retirar Remisso de Estilo de nota editorial' }).first().click()
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(page.getByRole('alert')).toContainText('"Remisso" é proteção de fábrica em estilo de nota editorial e não pode ser retirado.')
  await shot(page, '05-mensagem-de-validacao')
  await pending.getByRole('button', { name: 'Desfazer' }).nth(1).click()
  await expect(pending.getByRole('alert')).toHaveCount(0) // undoing the edit clears the stale message
  // Empty text in a new rule: blocked before sending.
  await page.getByLabel('Tipo de regra').selectOption('classes.editorialNote')
  await page.getByRole('button', { name: 'Adicionar à proposta' }).click()
  await expect(page.getByRole('region', { name: 'Regras' }).getByRole('alert')).toContainText('Informe o texto para "Estilo de nota editorial".')

  // 6. Save = validate + apply in one action (no freeze, no second administrator).
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(pending.getByText('1 trecho(s) mudam de natureza em 1 ato(s).')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Salvar configuração' }).click()
  const confirm = page.getByRole('region', { name: 'Confirmar salvamento' })
  await expect(confirm).toContainText('Nada do acervo é reprocessado')
  await confirm.getByLabel('Observação (opcional)').fill('Estilo de nota do CONFAZ (sintético)')
  await shot(page, '06-confirmar-salvamento')
  await confirm.getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(page.getByText(/Configuração salva e aplicada \(versão 1\)/u)).toBeVisible()
  await expect(page.getByText('Versão 1 em uso')).toBeVisible()
  // The saved rule is what the analysis now applies (version in force, not a preview).
  await page.locator('.ac-seg', { hasText: 'Acrescentado pelo' }).click()
  await expect(panel.locator('.ac-dims')).toContainText('Nota editorial')
  await shot(page, '07-salvo-e-aplicado')

  // 7. Concurrency: Bruno has the screen open on version 1; Ana saves version 2; Bruno's save is refused (409) with an
  //    explanation and his edits stay on screen.
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const b = await ctxB.newPage()
  await as(b, 'bruno'); await ready(b)
  await page.getByRole('tab', { name: 'Regras' }).click()
  await page.getByLabel('Tipo de regra').selectOption('classes.editorialNote')
  await page.getByLabel('Texto', { exact: true }).fill('NotaAna')
  await page.getByRole('button', { name: 'Adicionar à proposta' }).click()
  await page.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(pending.getByText(/Resultado do teste/u)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Salvar configuração' }).click()
  await page.getByRole('region', { name: 'Confirmar salvamento' }).getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(page.getByText(/versão 2/u).first()).toBeVisible()
  await b.getByRole('tab', { name: 'Regras' }).click()
  await b.getByLabel('Tipo de regra').selectOption('classes.editorialNote')
  await b.getByLabel('Texto', { exact: true }).fill('NotaBruno')
  await b.getByRole('button', { name: 'Adicionar à proposta' }).click()
  await b.getByRole('button', { name: 'Testar alterações' }).click()
  await expect(b.getByText(/Resultado do teste/u)).toBeVisible({ timeout: 30_000 })
  await b.getByRole('button', { name: 'Salvar configuração' }).click()
  await b.getByRole('region', { name: 'Confirmar salvamento' }).getByRole('button', { name: 'Confirmar e salvar' }).click()
  await expect(b.getByRole('alert')).toContainText('Outra pessoa salvou uma configuração depois que você começou')
  await expect(b.getByText(/Incluir "NotaBruno"/u)).toBeVisible()
  await b.screenshot({ path: `${dir}/${info.project.name}-08-concorrencia-bruno.png`, fullPage: true })
  await ctxB.close()

  // 8. Restore version 1 (a new version 3), audited; history and audit shown.
  await page.getByRole('tab', { name: 'Histórico' }).click()
  const hist = page.getByRole('region', { name: 'Histórico de versões' })
  await expect(hist.getByText('Versão 2', { exact: true })).toBeVisible()
  await hist.locator('li').filter({ has: page.getByText('Versão 1', { exact: true }) }).getByRole('button', { name: 'Restaurar esta versão' }).click()
  await hist.getByLabel('Motivo (opcional)').fill('Voltar ao estilo único (sintético)')
  await hist.getByRole('button', { name: 'Confirmar restauração' }).click()
  await expect(page.getByText(/restaurada como versão 3/u)).toBeVisible()
  await expect(hist.getByText('Restauração da versão 1 — Voltar ao estilo único (sintético)')).toBeVisible()
  await expect(hist.getByText(/Tentativa recusada · versão desatualizada/u)).toBeVisible()
  await shot(page, '09-historico-e-auditoria')

  // 9. Review list explains what still needs attention.
  await page.getByRole('tab', { name: /Conferência/u }).click()
  await expect(page.getByRole('region', { name: 'Casos que precisam de conferência' })).toContainText('Texto corrido: o motor não divide este ato em partes')
  await shot(page, '10-conferencia')

  const state = await (await request.get('/auth/__dev-state')).json() as { current: { version: number }; versions: { version: number; kind: string }[]; audit: { action: string; data: Record<string, unknown> }[] }
  expect(state.current.version).toBe(3)
  expect(state.versions.map((v) => v.kind)).toEqual(['save', 'save', 'restore'])
  expect(state.audit.map((a) => `${a.action}:${String(a.data.kind ?? a.data.code)}`)).toEqual([
    'ANAT_RULES_CONFIG_SAVED:SAVE', 'ANAT_RULES_CONFIG_SAVED:SAVE', 'ANAT_RULES_CONFIG_REJECTED:STALE_VERSION', 'ANAT_RULES_CONFIG_SAVED:RESTORE'])
})

test('layout responsivo com a configuração restaurada', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1440x900', 'covered above')
  await as(page, 'ana'); await ready(page)
  await page.locator('.ac-seg').nth(3).click()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await shot(page, 'layout')
})
