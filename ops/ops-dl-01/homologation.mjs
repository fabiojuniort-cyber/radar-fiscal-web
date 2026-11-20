import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { buildApp } from '../dist/app.js';

const requireWeb = createRequire(resolve('../web/package.json'));
const { chromium, expect } = requireWeb('@playwright/test');
const origin = 'https://127.0.0.1:4173';
const pagePath = '/admin/administradores';
const apiPath = '/api/v1/admin/platform/dou-download-limits';
const backend = 'http://127.0.0.1:3000';
const password = 'Synthetic-Ops-DL-2026!';
const defaults = { pdfMiB: 20, zipMiB: 64, expandedZipMiB: 128, xmlEntryMiB: 8 };
const savedLimits = { ...defaults, zipMiB: 32 };
const gatewayMessage = 'A gravação está indisponível no momento. Tente novamente mais tarde.';
const unconfirmedMessage = 'Não foi possível confirmar a gravação dos limites. Tente novamente.';
const gateway = 'public.platform_admin_set_dou_limits(uuid,jsonb,bigint,uuid,text)';
const role = 'radar_dou_limits_runtime';
const markers = [];
let phase = 'setup';
let app;
let db;
let browser;
let preview;

try {
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['DATABASE_ADMIN_URL', 'DATABASE_URL', 'DATABASE_DOU_LIMITS_URL']) {
    const endpoint = new URL(process.env[key]);
    assert.equal(endpoint.hostname, 'localhost');
    assert.equal(endpoint.pathname, '/radar_fiscal_test');
  }
  db = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 1 });
  const fixture = await db.query(`SELECT
    (SELECT count(*)::int FROM public.app_users) AS users,
    (SELECT count(*)::int FROM public.ops_dou_limits_signing_keys) AS keys,
    (SELECT count(*)::int FROM public.ops_dou_limits_used_nonces) AS nonces`);
  assert.deepEqual(fixture.rows[0], { users: 0, keys: 0, nonces: 0 });
  const source = (await db.query(`INSERT INTO public.sources(code,name,jurisdiction_level,base_url,connector_key)
    VALUES('dou','DOU synthetic fixture','FEDERAL','https://example.invalid','dou')
    ON CONFLICT(code) DO UPDATE SET connector_config='{}'::jsonb RETURNING id`)).rows[0].id;

  app = await buildApp();
  app.log.level = 'silent';
  await app.listen({ host: '127.0.0.1', port: 3000 });
  preview = spawn(process.execPath, ['--input-type=module', '-e', `
    import { preview } from 'vite';
    import { readFileSync } from 'node:fs';
    await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true, https: {
      key: readFileSync(process.env.OPS_PREVIEW_KEY), cert: readFileSync(process.env.OPS_PREVIEW_CERT),
    } } });
  `], { cwd: resolve('../web'), env: { ...process.env, AUTH_PROXY_TARGET: backend }, stdio: 'ignore' });
  browser = await chromium.launch({ headless: true });

  async function openSession() {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const email = `${randomUUID()}@example.invalid`;
    const register = await context.request.post(`${origin}/auth/register`, { data: {
      name: 'OPS Synthetic', email, password, confirmPassword: password, acceptedTerms: true,
    } });
    assert.equal(register.status(), 201);
    const { user } = await register.json();
    const login = await context.request.post(`${origin}/auth/login`, { data: { email, password } });
    assert.equal(login.status(), 200);
    const { accessToken } = await login.json();
    return { context, page, actor: user.id, headers: { authorization: `Bearer ${accessToken}` } };
  }

  const probe = await browser.newContext({ ignoreHTTPSErrors: true });
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    ready = await probe.request.get(origin).then((response) => response.ok(), () => false);
    if (!ready) await delay(300);
  }
  await probe.close();
  assert.ok(ready);

  phase = 'admin_access_denied';
  const denied = await openSession();
  await denied.page.goto(origin + pagePath);
  await expect(denied.page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
  await expect(denied.page.getByRole('heading', { name: 'Limites de arquivos do DOU' })).toHaveCount(0);
  assert.equal((await denied.context.request.get(origin + apiPath, { headers: denied.headers })).status(), 403);
  assert.equal((await denied.context.request.put(origin + apiPath, { headers: denied.headers, data: savedLimits })).status(), 403);
  await denied.context.close();
  markers.push(phase);

  phase = 'admin_access_and_editable_false';
  const admin = await openSession();
  await db.query(`INSERT INTO public.platform_user_roles(user_id,role,granted_by) VALUES($1,'PLATFORM_ADMIN','ops-dl-ci')`, [admin.actor]);
  const { page } = admin;
  const card = page.getByRole('region', { name: 'Limites de arquivos do DOU' });
  const zip = card.getByRole('spinbutton', { name: /Arquivo ZIP INLABS/ });
  const save = card.getByRole('button', { name: 'Salvar limites' });
  await page.goto(origin + pagePath);
  await expect(page.getByRole('heading', { name: 'Administradores' })).toBeVisible();
  await expect(zip).toHaveValue('64');
  await expect(zip).toBeDisabled();
  await expect(save).toBeDisabled();
  const notEditable = await admin.context.request.get(origin + apiPath, { headers: admin.headers });
  assert.equal(notEditable.status(), 200);
  assert.equal((await notEditable.json()).editable, false);
  markers.push(phase);

  phase = 'save_config_audit_nonce';
  execFileSync(process.execPath, ['dist/infrastructure/database/provision-runtime-role.js'], { stdio: 'ignore' });
  await page.reload();
  await expect(zip).toBeEnabled();
  await zip.fill('32');
  const writeResponse = page.waitForResponse((r) => new URL(r.url()).pathname === apiPath && r.request().method() === 'PUT');
  await save.click();
  assert.equal((await writeResponse).status(), 200);
  await expect(card.getByRole('status')).toHaveText('Limites salvos para as próximas execuções.');
  await page.reload();
  await expect(zip).toHaveValue('32');

  async function readState() {
    const config = (await db.query(`SELECT connector_config->'douDownloadLimits' AS limits FROM public.sources WHERE id=$1`, [source])).rows[0].limits;
    const audit = (await db.query(`SELECT entity_id, before_data, after_data FROM public.audit_log
      WHERE action='DOU_DOWNLOAD_LIMITS_UPDATED' AND entity_type='sources.connector_config' AND actor_id=$1`, [admin.actor])).rows;
    const nonces = (await db.query(`SELECT count(*)::int AS total FROM public.ops_dou_limits_used_nonces WHERE actor_id=$1`, [admin.actor])).rows[0].total;
    return { config, audit, nonces };
  }
  const committed = await readState();
  assert.deepEqual(committed, { config: savedLimits, audit: [{ entity_id: source, before_data: null, after_data: savedLimits }], nonces: 1 });
  markers.push(phase);

  async function expectDeniedSave(status, message, value) {
    await zip.fill(value);
    const deniedResponse = page.waitForResponse((r) => new URL(r.url()).pathname === apiPath && r.request().method() === 'PUT');
    await save.click();
    assert.equal((await deniedResponse).status(), status);
    await expect(card.getByRole('alert')).toHaveText(message);
    await expect(card.getByRole('status')).toHaveCount(0);
    await expect(card).not.toContainText(/ops-internal-marker|23505|42501|dou_limits_signature_invalid/);
    assert.deepEqual(await readState(), committed);
  }

  phase = 'gateway_failure_real';
  await db.query(`REVOKE EXECUTE ON FUNCTION ${gateway} FROM ${role}`);
  try { await expectDeniedSave(503, gatewayMessage, '24'); }
  finally { await db.query(`GRANT EXECUTE ON FUNCTION ${gateway} TO ${role}`); }
  markers.push(phase);

  for (const [caseName, status, body, message, value] of [
    ['replay_ui_simulated', 500, { error: '23505', detail: 'ops-internal-marker' }, unconfirmedMessage, '25'],
    ['invalid_signature_ui_simulated', 503, { error: 'dou_limits_store_not_ready', detail: 'dou_limits_signature_invalid', code: '42501' }, gatewayMessage, '26'],
  ]) {
    phase = caseName;
    const route = (request) => request.request().method() === 'PUT'
      ? request.fulfill({ status, json: body }) : request.fallback();
    await page.route(origin + apiPath, route);
    try { await expectDeniedSave(status, message, value); }
    finally { await page.unroute(origin + apiPath, route); }
    markers.push(phase);
  }

  console.log(JSON.stringify({ result: 'PASS', backendSha: process.env.OPS_BACKEND_SHA,
    webSha: process.env.OPS_WEB_SHA, checks: markers }));
} catch {
  console.log(JSON.stringify({ result: 'FAIL', phase, completed: markers }));
  process.exitCode = 1;
} finally {
  await browser?.close();
  preview?.kill();
  await app?.close();
  await db?.end();
}
