import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import { createStandaloneDatabase } from '../src/infrastructure/database/standalone-client.js';
import { heartbeatPasswordResetWorker, processPasswordResetRequestOnce, processPasswordResetOutboxOnce } from '../src/modules/auth/password-reset.worker.js';
import type { PasswordResetMessage } from '../src/modules/auth/password-reset.service.js';

const BACKEND_SHA = 'f4b1ef11865c35570e224d3ea79fcf6301baea98';
const WEB_SHA = 'dbf7e8f41ffc672cfb6bfa6bba12f6aef119c6e0';
const origin = 'https://127.0.0.1:4173';
const results: Record<string, boolean> = {};
const requireWeb = createRequire(resolve('../web/package.json'));
const { chromium, request } = requireWeb('@playwright/test');
const key = randomBytes(32).toString('hex');
const email = 'scenario4-' + randomUUID() + '@example.test';
const missing = 'missing-' + randomUUID() + '@example.test';
const oldPassword = 'Synthetic-Old-2026!';
const newPassword = 'Synthetic-New-2026!';
const inbox: PasswordResetMessage[] = [];
const workerUrl = new URL(process.env.DATABASE_URL!);
workerUrl.username = 'radar_worker_runtime';
const worker = createStandaloneDatabase({ connectionString: workerUrl.toString(), poolMax: 1, idleTimeoutMs: 10000, connectionTimeoutMs: 5000 });
const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 1 });
const settings = { tokenKey: key, publicUrl: origin + '/nova-senha', send: async (message: PasswordResetMessage) => { inbox.push(message); } };
const app = await buildApp({ passwordReset: { enabled: true, tokenKey: key, publicUrl: origin + '/nova-senha' } });
app.log.level = 'silent';
let browser: any;
let preview: ReturnType<typeof spawn> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let phase = 'setup';
try {
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(process.env.DATABASE_ADMIN_URL!, /\/radar_fiscal_test$/);
  assert.equal(process.env.ZOHO_CPAAS_API_KEY, undefined);
  const before = await admin.query('SELECT count(*)::int AS n FROM app_users');
  assert.equal(before.rows[0].n, 0);
  await app.listen({ host: '127.0.0.1', port: 3000 });
  assert.equal(await heartbeatPasswordResetWorker(worker, key, '11111111-1111-4111-8111-111111111111'), true);
  heartbeat = setInterval(() => { void heartbeatPasswordResetWorker(worker, key, '11111111-1111-4111-8111-111111111111').catch(() => {}); }, 10000);
  preview = spawn(process.execPath, ['--input-type=module', '-e', 'import {preview} from "vite"; import {readFileSync} from "node:fs"; await preview({preview:{host:"127.0.0.1",port:4173,strictPort:true,https:{key:readFileSync(process.env.SCENARIO4_KEY_PATH),cert:readFileSync(process.env.SCENARIO4_CERT_PATH)}}});'], {
    cwd: resolve('../web'), env: { ...process.env, AUTH_PROXY_TARGET: 'http://127.0.0.1:3000' }, stdio: 'ignore',
  });
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { ready = (await context.request.get(origin)).ok(); } catch {}
    if (ready) break;
    await delay(500);
  }
  assert.ok(ready);
  const page = await context.newPage();
  await page.route('**/*', (route: any) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());

  phase = '1_synthetic_account_and_session';
  const registered = await context.request.post(origin + '/auth/register', { data: { name: 'Synthetic Scenario Four', email, password: oldPassword, confirmPassword: oldPassword, acceptedTerms: true } });
  assert.equal(registered.status(), 201);
  const oldLogin = await context.request.post(origin + '/auth/login', { data: { email, password: oldPassword } });
  assert.equal(oldLogin.status(), 200);
  const oldJwt = (await oldLogin.json()).accessToken;
  const oldCookie = oldLogin.headers()['set-cookie']?.split(';')[0];
  assert.ok(oldJwt && oldCookie);
  assert.equal((await context.request.get(origin + '/auth/me', { headers: { authorization: 'Bearer ' + oldJwt } })).status(), 200);
  results[phase] = true;

  phase = '2_web_request_and_memory_delivery';
  await page.goto(origin);
  await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
  await page.getByRole('button', { name: 'Esqueci minha senha' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  const forgotResponse = page.waitForResponse((r: any) => new URL(r.url()).pathname === '/auth/password/forgot');
  await page.getByRole('button', { name: 'Enviar instruções' }).click();
  const forgot = await forgotResponse;
  assert.equal(forgot.status(), 202);
  const neutral = await forgot.json();
  assert.deepEqual(neutral, { status: 'if_account_exists' });
  assert.equal(await processPasswordResetRequestOnce(worker, settings), 'PREPARED');
  assert.equal(await processPasswordResetOutboxOnce(worker, settings), 'ACCEPTED');
  assert.equal(inbox.length, 1);
  const link = inbox[0].link;
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
  assert.ok(token);
  results[phase] = true;

  phase = '3_get_headers_fragment_and_no_consumption';
  const activeBefore = await admin.query('SELECT used_at IS NULL AS unused FROM auth_password_reset_tokens');
  assert.equal(activeBefore.rows.length, 1);
  assert.equal(activeBefore.rows[0].unused, true);
  let resets = 0;
  page.on('request', (request: any) => { if (new URL(request.url()).pathname === '/auth/password/reset') resets++; });
  const documentResponse = await page.goto(link);
  assert.equal(documentResponse.status(), 200);
  const headers = documentResponse.headers();
  assert.equal(headers['cache-control'], 'no-store');
  assert.equal(headers['referrer-policy'], 'no-referrer');
  assert.ok(headers['content-security-policy'].includes("script-src 'self'"));
  assert.ok(headers['content-security-policy'].includes("connect-src 'self'"));
  assert.ok(headers['content-security-policy'].includes("frame-ancestors 'none'"));
  await page.getByRole('heading', { name: 'Nova senha', exact: true }).waitFor();
  assert.equal(page.url(), origin + '/nova-senha');
  assert.equal(resets, 0);
  assert.ok(!(await page.content()).includes(token));
  assert.ok(!(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).includes(token));
  assert.equal((await admin.query('SELECT bool_and(used_at IS NULL) AS unused FROM auth_password_reset_tokens')).rows[0].unused, true);
  results[phase] = true;

  phase = '4_voluntary_reset';
  await page.getByLabel('Senha', { exact: true }).fill(newPassword);
  await page.getByLabel('Confirmar senha', { exact: true }).fill(newPassword);
  const resetResponse = page.waitForResponse((r: any) => new URL(r.url()).pathname === '/auth/password/reset');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  assert.equal((await resetResponse).status(), 204);
  await page.getByRole('heading', { name: 'Entrar na TriFaros' }).waitFor();
  assert.equal(resets, 1);
  results[phase] = true;

  phase = '5_new_login_old_credentials_and_link_rejected';
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(newPassword);
  const newLoginResponse = page.waitForResponse((r: any) => new URL(r.url()).pathname === '/auth/login');
  await page.getByRole('dialog').getByRole('button', { name: 'Entrar', exact: true }).click();
  const newLogin = await newLoginResponse;
  assert.equal(newLogin.status(), 200);
  const newJwt = (await newLogin.json()).accessToken;
  assert.equal((await context.request.get(origin + '/auth/me', { headers: { authorization: 'Bearer ' + newJwt } })).status(), 200);
  assert.equal((await context.request.post(origin + '/auth/login', { data: { email, password: oldPassword } })).status(), 401);
  assert.equal((await context.request.get(origin + '/auth/me', { headers: { authorization: 'Bearer ' + oldJwt } })).status(), 401);
  const oldClient = await request.newContext({ ignoreHTTPSErrors: true });
  const oldRefresh = await oldClient.post(origin + '/auth/refresh', { headers: { cookie: oldCookie, 'x-csrf-protection': '1' } });
  assert.equal(oldRefresh.status(), 401);
  await oldClient.dispose();
  assert.equal((await context.request.post(origin + '/auth/password/reset', { data: { token, password: newPassword, confirmPassword: newPassword } })).status(), 400);
  results[phase] = true;

  phase = '6_unknown_email_neutral_without_delivery';
  const missingResponse = await context.request.post(origin + '/auth/password/forgot', { data: { email: missing } });
  assert.equal(missingResponse.status(), 202);
  assert.deepEqual(await missingResponse.json(), neutral);
  assert.equal(await processPasswordResetRequestOnce(worker, settings), 'UNKNOWN');
  await processPasswordResetOutboxOnce(worker, settings);
  assert.equal(inbox.length, 1);
  results[phase] = true;
  console.log(JSON.stringify({ backend_sha: BACKEND_SHA, web_sha: WEB_SHA, result: 'PASS', checks: results, real_email_sent: false }));
} catch {
  console.log(JSON.stringify({ backend_sha: BACKEND_SHA, web_sha: WEB_SHA, result: 'FAIL', failed_phase: phase, checks: results }));
  process.exitCode = 1;
} finally {
  if (heartbeat) clearInterval(heartbeat);
  await browser?.close();
  preview?.kill();
  await app.close();
  await worker.destroy();
  await admin.end();
}
