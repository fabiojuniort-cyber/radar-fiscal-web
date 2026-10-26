import { expect, test, type Page } from '@playwright/test'

/**
 * ANAT-ADMIN-01 P4 — complete flow against the REAL API (backend P3-D plugin + P3-C executor + disposable PostgreSQL),
 * served by the backend dev harness (test/support/anatomy-admin-dev-server.ts). Runs only with ANAT_REAL_API=1 and a
 * build with VITE_ENABLE_ANAT_RULES_ADMIN=true proxied to the harness (AUTH_PROXY_TARGET). Synthetic data only.
 * Screenshots go to docs/evidence/anat-admin-p4/ (no private data: synthetic admins and examples).
 */
test.skip(process.env.ANAT_REAL_API !== '1', 'needs the local anatomy admin dev harness')
test.describe.configure({ mode: 'serial' })
const shot = (page: Page, name: string) => page.screenshot({ path: `docs/evidence/anat-admin-p4/${test.info().project.name}-${name}.png`, fullPage: true })
const asUser = async (page: Page, who: 'author' | 'reviewer') => {
  await page.goto(`/auth/__dev-login?as=${who}`)
  await expect(page.getByRole('heading', { name: 'Regras da Anatomia do Ato' })).toBeVisible()
}

test('fluxo completo: rascunho → congelar → simular → comparar → revisar → prévia → confirmar → histórico', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop-1440x900', 'the full mutating flow runs once; other viewports check the result')
  test.setTimeout(120_000)
  const fixtures = await (await request.get('/auth/__dev-fixtures')).json() as { defaults: unknown[]; candidate: unknown[]; examples: unknown[] }
  await asUser(page, 'author')
  await shot(page, '01-vazio')
  const saveAndFreeze = async (profiles: unknown[]) => {
    await page.getByRole('button', { name: 'Novo rascunho' }).click()
    await page.getByLabel('Perfis (JSON, ANAT-PROFILE/1)').fill(JSON.stringify(profiles))
    await page.getByLabel('Exemplos sintéticos (JSON, até 20)').fill(JSON.stringify(fixtures.examples))
    await page.getByRole('button', { name: 'Salvar rascunho' }).click()
    await expect(page.getByText(/Rascunho salvo \(revisão 1\)/u)).toBeVisible()
    await page.getByRole('button', { name: 'Congelar candidato' }).click()
    await expect(page.getByText('Candidato congelado.')).toBeVisible()
  }
  // Baseline snapshot (shipped defaults), then the candidate (RFB column header added).
  await saveAndFreeze(fixtures.defaults)
  const baseline = (await page.locator('.ar-meta dt:has-text("Snapshot") + dd').innerText()).trim()
  await saveAndFreeze(fixtures.candidate)
  await page.getByRole('button', { name: 'Simular' }).click()
  await expect(page.locator('.ar-out-pass').first()).toBeVisible({ timeout: 30_000 })
  await page.getByLabel('Base (snapshot; vazio = regra ativa)').fill(baseline)
  await page.getByRole('button', { name: 'Comparar com a base' }).click()
  await expect(page.locator('.ar-diff summary').first()).toContainText('diferença', { timeout: 30_000 })
  // The author cannot review.
  await expect(page.getByText('Você é autor deste candidato e não pode revisá-lo.').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
  await shot(page, '02-autor-bloqueado')
  // Reviewer: decide every difference, approve, preview, confirm.
  await asUser(page, 'reviewer')
  await page.locator('.ar-list button', { hasText: 'simulado' }).first().click()
  const selects = page.getByLabel(/^Decisão /u)
  await expect(selects.first()).toBeVisible()
  for (const select of await selects.all()) await select.selectOption('expected')
  await page.getByLabel(/Justificativa \(10/u).fill('Coluna Classificacao reconhecida como esperado (sintético).')
  await shot(page, '03-revisao')
  await page.getByRole('button', { name: 'Aprovar' }).click()
  await expect(page.getByText('Revisão registrada.')).toBeVisible()
  await page.getByRole('button', { name: 'Gerar prévia' }).click()
  const region = page.getByRole('region', { name: 'Confirmar ativação' })
  await expect(region.getByText('não suportado').first()).toBeVisible()
  await expect(region.getByText('Nada é reprocessado ao ativar ou retornar.')).toBeVisible()
  await shot(page, '04-previa')
  await region.getByLabel(/Justificativa da ativação/u).fill('Ativação sintética de ensaio local.')
  await region.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('Ativação registrada.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Histórico' }).getByText(/Ativação · global/u)).toBeVisible()
  await expect(page.locator('.ar-badge.ar-state-active').first()).toBeVisible()
  await shot(page, '05-historico')
})

test('viewport check after the flow: candidates, state and history readable', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-1440x900', 'covered by the flow above')
  await asUser(page, 'reviewer')
  await expect(page.locator('.ar-badge.ar-state-active').first()).toBeVisible()
  await page.locator('.ar-list button', { hasText: 'ativo' }).first().click()
  await expect(page.getByText(/Candidato [0-9a-f]{8}…/u)).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await shot(page, '06-viewport')
})
