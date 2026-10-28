// Cadastro, confirmação de e-mail, login, sessão e recuperação de senha.
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { one, all, run, id, now, tx, audit } from '../db/index.js';
import { parse, conflict, badRequest, forbidden, HttpError } from '../lib/errors.js';
import * as f from '../lib/fields.js';
import { hashPassword, verifyOrWaste, newToken, sha256, startSession, endSession, endAllSessions, requireUser } from '../lib/security.js';
import { saveLogo } from '../lib/uploads.js';
import { queueMail } from '../lib/mailer.js';

const blogSchema = z.object({ name: f.text(2, 80, 'Informe o nome do blog.'), site: f.site, niche: f.niche, audience: z.coerce.number().int().min(0).max(100_000_000).default(0), city: f.city, uf: f.uf, logo: f.logo });
const companySchema = z.object({ tradeName: f.text(2, 80, 'Informe o nome da empresa.'), legalName: f.text(2, 120, 'Informe a razão social.'), cnpj: f.cnpj, phone: f.phone, site: f.optionalSite, city: f.city, uf: f.uf });
const signupSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('blogueiro'), name: f.personName, email: f.email, password: f.password, blog: blogSchema }),
  z.object({ role: z.literal('anunciante'), name: f.personName, email: f.email, password: f.password, company: companySchema })
], { error: 'Escolha o tipo de conta.' });

const DAY = 86400000;
const tokenFor = async (userId, purpose, ttl) => {
  const { token, hash } = newToken();
  await run('INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', id(), userId, purpose, hash, new Date(Date.now() + ttl).toISOString(), now());
  return token;
};
// Marca o token como usado na mesma instrução que o encontra: dois cliques ao mesmo tempo não usam o link duas vezes.
const useToken = async (token, purpose) => {
  const row = await one('UPDATE email_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ? RETURNING *', now(), sha256(String(token || '')), purpose, now());
  return row;
};
const loginLink = () => `${config.APP_URL}/#entrar`;

export async function profile(user) {
  const out = { id: user.id, role: user.role, name: user.name, email: user.email, status: user.status };
  if (user.role === 'blogueiro') {
    const b = await one('SELECT id, name, site, script_verified_at FROM blogs WHERE user_id = ?', user.id);
    out.blog = b && { id: b.id, name: b.name, site: b.site, scriptVerified: Boolean(b.script_verified_at) };
  }
  if (user.role === 'anunciante') {
    const c = await one('SELECT trade_name, site FROM companies WHERE user_id = ?', user.id);
    out.company = c && { name: c.trade_name, site: c.site };
  }
  return out;
}

export default async function auth(app) {
  app.post('/api/auth/signup', { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } }, async (req, reply) => {
    const d = parse(signupSchema, req.body);
    if (await one('SELECT 1 FROM users WHERE email = ?', d.email)) throw conflict('Já existe uma conta com esse e-mail. Entre ou use outro e-mail.', 'EMAIL_TAKEN');
    if (d.role === 'anunciante' && await one('SELECT 1 FROM companies WHERE cnpj = ?', d.company.cnpj)) throw conflict('Esse CNPJ já tem cadastro no BlogSim.', 'CNPJ_TAKEN');
    const logoPath = d.role === 'blogueiro' ? saveLogo(d.blog.logo) : null;
    const passwordHash = await hashPassword(d.password);
    const userId = id();
    const token = await tx(async () => {
      await run('INSERT INTO users (id, role, name, email, password_hash, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', userId, d.role, d.name, d.email, passwordHash, 'pendente', now());
      if (d.role === 'blogueiro') {
        const b = d.blog;
        await run(`INSERT INTO blogs (id, user_id, name, site, niche, city, uf, audience, logo_path, script_token, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?)`, id(), userId, b.name, b.site, b.niche, b.city, b.uf, b.audience, logoPath, 'BL-' + randomBytes(4).toString('hex').toUpperCase(), now());
      } else {
        const c = d.company;
        await run('INSERT INTO companies (id, user_id, trade_name, legal_name, cnpj, site, phone, city, uf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id(), userId, c.tradeName, c.legalName, c.cnpj, c.site, c.phone, c.city, c.uf);
      }
      return tokenFor(userId, 'verify_email', DAY);
    });
    queueMail(d.email, 'confirmar_email', { name: d.name, link: `${config.APP_URL}/api/auth/verify-email?token=${token}` }, req.log);
    reply.code(201);
    return { ok: true, email: d.email };
  });

  // Link do e-mail de confirmação. Confirma, avisa o admin e volta para o site.
  app.get('/api/auth/verify-email', async (req, reply) => {
    const row = await useToken(req.query.token, 'verify_email');
    if (!row) return reply.redirect('/#email-invalido');
    await run('UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL', now(), row.user_id);
    const user = await one('SELECT * FROM users WHERE id = ?', row.user_id);
    const blog = await one('SELECT * FROM blogs WHERE user_id = ?', user.id);
    const company = await one('SELECT * FROM companies WHERE user_id = ?', user.id);
    const org = blog ? blog.name : company.trade_name;
    queueMail(user.email, 'boas_vindas', { name: user.name, role: user.role, org }, req.log);
    const details = blog
      ? [['Blog', blog.site], ['Nicho', blog.niche], ['Local', `${blog.city}, ${blog.uf}`], ['Leitores por mês', new Intl.NumberFormat('pt-BR').format(blog.audience)]]
      : [['Razão social', company.legal_name], ['CNPJ', company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')], ['Telefone', company.phone], ['Local', `${company.city}, ${company.uf}`]];
    const admins = config.ADMIN_NOTIFY_EMAIL ? [config.ADMIN_NOTIFY_EMAIL] : (await all("SELECT email FROM users WHERE role = 'admin' AND status = 'aprovado'")).map(a => a.email);
    for (const to of admins) queueMail(to, 'admin_novo_cadastro', { role: user.role, org, name: user.name, email: user.email, details, link: loginLink() }, req.log);
    return reply.redirect('/#email-confirmado');
  });

  app.post('/api/auth/resend-verification', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async req => {
    const { email } = parse(z.object({ email: f.email }), req.body);
    const user = await one('SELECT * FROM users WHERE email = ? AND email_verified_at IS NULL', email);
    if (user) queueMail(user.email, 'confirmar_email', { name: user.name, link: `${config.APP_URL}/api/auth/verify-email?token=${await tokenFor(user.id, 'verify_email', DAY)}` }, req.log);
    return { ok: true };
  });

  app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const d = parse(z.object({ email: f.email, password: z.string().max(128), remember: z.boolean().default(false) }), req.body);
    const user = await one('SELECT * FROM users WHERE email = ?', d.email);
    const ok = await verifyOrWaste(user?.password_hash, d.password);
    if (!ok) throw new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos. Confira os dados e tente de novo.');
    // O status só é revelado depois da senha certa, para não dizer a estranhos quem tem conta.
    if (!user.email_verified_at) throw forbidden('Confirme seu e-mail pelo link que enviamos para liberar o cadastro.', 'EMAIL_NOT_VERIFIED');
    if (user.status === 'pendente') throw forbidden('Seu cadastro ainda está em análise. A equipe do BlogSim responde em até 24 horas no seu e-mail.', 'PENDING');
    if (user.status === 'negado') throw forbidden('Seu cadastro não foi aprovado.', 'DENIED', { reason: user.denial_reason });
    await startSession(req, reply, user.id, d.remember);
    return { user: await profile(user) };
  });

  app.post('/api/auth/logout', async (req, reply) => { await endSession(req, reply); return { ok: true }; });

  app.get('/api/auth/me', async req => ({ user: await profile(requireUser(req)) }));

  app.post('/api/auth/forgot-password', { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } }, async req => {
    const { email } = parse(z.object({ email: f.email }), req.body);
    const user = await one('SELECT * FROM users WHERE email = ?', email);
    if (user) queueMail(user.email, 'recuperar_senha', { name: user.name, link: `${config.APP_URL}/#nova-senha=${await tokenFor(user.id, 'reset_password', 30 * 60000)}` }, req.log);
    return { ok: true }; // mesma resposta exista ou não a conta
  });

  app.post('/api/auth/reset-password', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async req => {
    const d = parse(z.object({ token: z.string().min(10).max(100), password: f.password }), req.body);
    const row = await useToken(d.token, 'reset_password');
    if (!row) throw badRequest('Este link expirou ou já foi usado. Peça um link novo em "Esqueci a senha".', 'TOKEN_INVALID');
    const user = await one('SELECT * FROM users WHERE id = ?', row.user_id);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(d.password), user.id);
    await endAllSessions(user.id);
    await audit(user.id, 'senha_alterada', user.id);
    queueMail(user.email, 'senha_alterada', { name: user.name }, req.log);
    return { ok: true };
  });
}