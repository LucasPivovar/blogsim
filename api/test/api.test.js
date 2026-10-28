// Testes da API com um PostgreSQL em memória (PGlite): segurança das rotas e o fluxo principal de ponta a ponta.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const uploads = mkdtempSync(join(tmpdir(), 'blogsim-test-'));
const secret = () => 'T' + randomBytes(9).toString('hex') + '9';
const PW = { admin: secret(), anunciante: secret(), blogueiro: secret() };
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: 'pglite:memory', TRACK_SECRET: randomBytes(32).toString('hex'), UPLOAD_DIR: uploads, APP_URL: 'http://localhost:4100',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', ADMIN_NOTIFY_EMAIL: 'admin.qa@blogsim.com.br',
  QA_ADMIN_PASSWORD: PW.admin, QA_ANUNCIANTE_PASSWORD: PW.anunciante, QA_BLOGUEIRO_PASSWORD: PW.blogueiro
});

const { buildApp } = await import('../src/server.js');
const { seed } = await import('../src/db/seed.js');
const { one, migrate, closeDb } = await import('../src/db/index.js');

const ORIGIN = 'http://localhost:4100';
let app;
before(async () => { await migrate(); await seed({ quiet: true }); app = await buildApp(); await app.ready(); });
after(async () => { await app.close(); await closeDb(); rmSync(uploads, { recursive: true, force: true }); });

// Cliente com cookie de sessão, como um navegador.
function client() {
  let cookie = '';
  return async function call(method, url, body, headers = {}) {
    const res = await app.inject({ method, url, payload: body, headers: { origin: ORIGIN, ...(cookie ? { cookie } : {}), ...headers } });
    const set = res.headers['set-cookie'];
    if (set) cookie = [].concat(set).map(c => c.split(';')[0]).join('; ');
    return { status: res.statusCode, body: res.json ? safeJson(res.body) : null, headers: res.headers };
  };
}
const safeJson = s => { try { return JSON.parse(s); } catch { return s; } };
async function loginAs(role) {
  const c = client();
  const r = await c('POST', '/api/auth/login', { email: `${role}.qa@blogsim.com.br`, password: PW[role] });
  assert.equal(r.status, 200, `login ${role}`);
  return c;
}
// O e-mail é registrado logo depois da resposta; espera um pouco por ele.
async function lastMail(to, template) {
  for (let i = 0; i < 40; i++) {
    const row = await one('SELECT * FROM email_outbox WHERE to_email = ? AND template = ? ORDER BY created_at DESC LIMIT 1', to, template);
    if (row) return row;
    await new Promise(r => setTimeout(r, 25));
  }
}

test('rotas protegidas pedem sessão', async () => {
  const c = client();
  for (const url of ['/api/state', '/api/auth/me', '/api/billing', '/api/campaigns', '/api/payouts/me', '/api/admin/signups']) {
    assert.equal((await c('GET', url)).status, 401, url);
  }
});

test('POST sem Origin ou de outro site é bloqueado (CSRF)', async () => {
  const r1 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.com', password: 'x' } });
  assert.equal(r1.statusCode, 403);
  const r2 = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'a@b.com', password: 'x' }, headers: { origin: 'https://site-malicioso.com' } });
  assert.equal(r2.statusCode, 403);
});

test('login errado não diz se o e-mail existe', async () => {
  const c = client();
  const a = await c('POST', '/api/auth/login', { email: 'admin.qa@blogsim.com.br', password: 'senha-errada-1' });
  const b = await c('POST', '/api/auth/login', { email: 'ninguem@blogsim.com.br', password: 'senha-errada-1' });
  assert.equal(a.status, 401); assert.equal(b.status, 401);
  assert.deepEqual(a.body, b.body);
});

test('cookie de sessão é httpOnly e SameSite', async () => {
  const c = client();
  const r = await c('POST', '/api/auth/login', { email: 'admin.qa@blogsim.com.br', password: PW.admin });
  const set = [].concat(r.headers['set-cookie']).join(';').toLowerCase();
  assert.match(set, /httponly/); assert.match(set, /samesite=lax/);
  assert.ok(!JSON.stringify(r.body).includes('password'), 'a resposta não traz hash de senha');
});

test('cada perfil só acessa as próprias rotas', async () => {
  const adv = await loginAs('anunciante');
  const blog = await loginAs('blogueiro');
  assert.equal((await adv('GET', '/api/admin/signups')).status, 403);
  assert.equal((await blog('GET', '/api/admin/payouts')).status, 403);
  assert.equal((await adv('GET', '/api/blogs/me')).status, 403);
  assert.equal((await blog('POST', '/api/campaigns', {})).status, 403);
  assert.equal((await adv('POST', '/api/payouts', {})).status, 403);
});

test('blogueiro não mexe no espaço de outro blog (IDOR)', async () => {
  const blog = await loginAs('blogueiro');
  const other = await one("SELECT s.id FROM slots s JOIN blogs b ON b.id = s.blog_id JOIN users u ON u.id = b.user_id WHERE u.email <> 'blogueiro.qa@blogsim.com.br' LIMIT 1");
  const r = await blog('PATCH', `/api/blogs/me/slots/${other.id}`, { price: 999 });
  assert.equal(r.status, 404);
});

test('campos extras são descartados (mass assignment)', async () => {
  const blog = await loginAs('blogueiro');
  const mine = await one("SELECT s.id, s.blog_id FROM slots s JOIN blogs b ON b.id = s.blog_id JOIN users u ON u.id = b.user_id WHERE u.email = 'blogueiro.qa@blogsim.com.br' LIMIT 1");
  assert.equal((await blog('PATCH', `/api/blogs/me/slots/${mine.id}`, { price: 120, blog_id: 'outro', blogId: 'outro' })).status, 200);
  assert.equal((await one('SELECT blog_id FROM slots WHERE id = ?', mine.id)).blog_id, mine.blog_id);
  const s = client();
  const r = await s('POST', '/api/auth/signup', { role: 'anunciante', status: 'aprovado', emailVerified: true, name: 'Ana Teste', email: 'ana@teste.com', password: 'SenhaBoa123',
    company: { tradeName: 'Loja da Ana', legalName: 'Ana Teste ME', cnpj: '11222333000181', phone: '(47) 99999-0000', site: '', city: 'Joinville', uf: 'SC' } });
  assert.equal(r.status, 201);
  const u = await one("SELECT status, role, email_verified_at FROM users WHERE email = 'ana@teste.com'");
  assert.deepEqual([u.status, u.role, u.email_verified_at], ['pendente', 'anunciante', null]);
  assert.equal((await s('POST', '/api/auth/signup', { role: 'admin', name: 'Hacker', email: 'h@teste.com', password: 'SenhaBoa123' })).status, 400, 'não dá para se cadastrar como admin');
});

test('limite de tentativas no login', async () => {
  const c = client();
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await c('POST', '/api/auth/login', { email: 'x@blogsim.com.br', password: 'errada-123' }, { 'x-test-rate-limit': 'on' })).status);
  assert.ok(codes.includes(429), codes.join(','));
});

test('fluxo completo: cadastro, confirmação, aprovação, campanha, saque', async () => {
  const email = 'novo.blog@teste.com';
  const pw = 'SenhaBoa123';
  const b = client();
  const s = await b('POST', '/api/auth/signup', { role: 'blogueiro', name: 'Nina Teste', email, password: pw,
    blog: { name: 'Blog da Nina', site: 'blogdanina.com.br', niche: 'Pets', audience: 9000, city: 'Joinville', uf: 'SC' } });
  assert.equal(s.status, 201);
  assert.equal((await b('POST', '/api/auth/login', { email, password: pw })).body.error.code, 'EMAIL_NOT_VERIFIED');

  const link = (await lastMail(email, 'confirmar_email')).html.match(/verify-email\?token=([\w-]+)/)[1];
  const v = await b('GET', `/api/auth/verify-email?token=${link}`);
  assert.equal(v.status, 302); assert.match(v.headers.location, /email-confirmado/);
  assert.match((await b('GET', `/api/auth/verify-email?token=${link}`)).headers.location, /email-invalido/, 'link vale uma vez só');
  assert.ok(await lastMail(email, 'boas_vindas'));
  assert.ok(await lastMail('admin.qa@blogsim.com.br', 'admin_novo_cadastro'));
  assert.equal((await b('POST', '/api/auth/login', { email, password: pw })).body.error.code, 'PENDING');

  const admin = await loginAs('admin');
  const user = await one('SELECT id FROM users WHERE email = ?', email);
  assert.equal((await admin('POST', `/api/admin/signups/${user.id}/approve`, {})).status, 200);
  assert.equal((await b('POST', '/api/auth/login', { email, password: pw })).status, 200);

  assert.equal((await b('POST', '/api/blogs/me/slots', { placement: 'lateral', price: 100 })).status, 403, 'sem script não cria espaço');
  assert.equal((await b('POST', '/api/blogs/me/verify-script', {})).status, 200);
  const slot = (await b('POST', '/api/blogs/me/slots', { placement: 'lateral', price: 100 })).body.slot;

  const adv = await loginAs('anunciante');
  const before = (await adv('GET', '/api/state')).body.balance;
  const rec = (await adv('POST', '/api/billing/recharges', { amount: 500, method: 'pix' })).body.recharge;
  assert.equal((await adv('GET', '/api/state')).body.balance, before, 'recarga pendente não vira saldo');
  assert.equal((await admin('POST', `/api/admin/recharges/${rec.id}/confirm`, {})).status, 200);
  assert.equal((await adv('GET', '/api/state')).body.balance, before + 500);

  const camp = await adv('POST', '/api/campaigns', { name: 'Teste de fluxo', objective: 'visitas', slotIds: [slot.id], weeks: 2, ad: { title: 'Ração premium', text: '', link: 'https://exemplo.com.br' } });
  assert.equal(camp.status, 201);
  assert.equal((await adv('GET', '/api/state')).body.balance, before + 300);
  const c = await one("SELECT id FROM campaigns WHERE name = 'Teste de fluxo'");
  assert.equal((await adv('POST', `/api/admin/campaigns/${c.id}/approve`, {})).status, 403);
  assert.equal((await admin('POST', `/api/admin/campaigns/${c.id}/approve`, {})).status, 200);

  const st = (await b('GET', '/api/state')).body;
  assert.equal(st.balance, 160, '200 de aluguel menos 20% de comissão');
  assert.equal((await b('POST', '/api/payouts', {})).status, 201);
  assert.equal((await b('GET', '/api/state')).body.balance, 0);
  assert.ok(await lastMail(email, 'saque_solicitado'));
});

test('senha nova: link vale uma vez e derruba as sessões', async () => {
  const c = await loginAs('blogueiro');
  const anon = client();
  assert.equal((await anon('POST', '/api/auth/forgot-password', { email: 'ninguem@blogsim.com.br' })).status, 200, 'não revela se o e-mail existe');
  await anon('POST', '/api/auth/forgot-password', { email: 'blogueiro.qa@blogsim.com.br' });
  const token = (await lastMail('blogueiro.qa@blogsim.com.br', 'recuperar_senha')).html.match(/nova-senha=([\w-]+)/)[1];
  const nova = 'OutraSenha456';
  assert.equal((await anon('POST', '/api/auth/reset-password', { token, password: nova })).status, 200);
  assert.equal((await anon('POST', '/api/auth/reset-password', { token, password: nova })).status, 400);
  assert.equal((await c('GET', '/api/state')).status, 401, 'sessão antiga caiu');
  PW.blogueiro = nova;
  await loginAs('blogueiro');
});
test('script do blog: entrega anúncio e mede visualização e clique', async () => {
  const blog = await one("SELECT script_token FROM blogs WHERE name = 'Treino em Casa'");
  const camp = await one("SELECT id, views, clicks FROM campaigns WHERE name = 'Black Friday – Tênis'");
  const ua = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Teste' };

  const js = await app.inject({ method: 'GET', url: '/slots.js' });
  assert.equal(js.statusCode, 200);
  assert.equal(js.headers['cross-origin-resource-policy'], 'cross-origin');
  assert.match(js.body, /http:\/\/localhost:4100/);

  const res = await app.inject({ method: 'GET', url: `/api/ads/${blog.script_token}`, headers: { origin: 'https://treinoemcasa.com.br' } });
  assert.equal(res.headers['access-control-allow-origin'], '*');
  const ad = res.json().ads.find(a => a.placement === 'lateral');
  assert.ok(ad, 'anúncio da lateral no ar');
  assert.equal((await app.inject({ method: 'GET', url: '/api/ads/BL-NAOEXISTE' })).json().ads.length, 0);

  const view = new URL(ad.view);
  for (let i = 0; i < 3; i++) assert.equal((await app.inject({ method: 'GET', url: view.pathname + view.search, headers: ua })).statusCode, 204);
  await app.inject({ method: 'GET', url: view.pathname + view.search, headers: { 'user-agent': 'Googlebot/2.1' } });
  await app.inject({ method: 'GET', url: view.pathname + view.search.slice(0, -3) + 'abc', headers: ua });
  assert.equal((await one('SELECT views FROM campaigns WHERE id = ?', camp.id)).views, camp.views + 1, 'mesma pessoa conta uma vez; robô e link adulterado não contam');

  const click = await app.inject({ method: 'GET', url: new URL(ad.click).pathname, headers: ua });
  assert.equal(click.statusCode, 302);
  assert.equal(click.headers.location, 'https://passocerto.com.br/');
  const today = await one('SELECT SUM(views) AS v, SUM(clicks) AS c FROM ad_stats WHERE campaign_id = ?', camp.id);
  assert.deepEqual([today.v, today.c], [1, 1]);

  const admin = await loginAs('admin');
  const r = await admin('POST', '/api/dev/reports/daily', {});
  assert.equal(r.status, 200);
  const mail = await lastMail('anunciante.qa@blogsim.com.br', 'relatorio_diario');
  assert.match(mail.text, /Cliques hoje: 1/);
});