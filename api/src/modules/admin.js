// Área do admin: cadastros (aprovar ou negar) e configurações da plataforma.
import { z } from 'zod';
import { config } from '../config.js';
import { one, all, run, now, tx, audit, getSettings, saveSettings } from '../db/index.js';
import { parse, conflict, notFound } from '../lib/errors.js';
import * as f from '../lib/fields.js';
import { requireRole, endAllSessions } from '../lib/security.js';
import { queueMail } from '../lib/mailer.js';
import { brDate } from '../lib/format.js';

export function signupView(u) {
  const out = { id: u.id, role: u.role, name: u.name, email: u.email, status: u.status, reason: u.denial_reason || undefined, createdAt: brDate(u.created_at), emailVerified: Boolean(u.email_verified_at) };
  if (u.role === 'blogueiro') { const b = one('SELECT id FROM blogs WHERE user_id = ?', u.id); out.blogId = b && b.id; }
  if (u.role === 'anunciante') {
    const c = one('SELECT * FROM companies WHERE user_id = ?', u.id);
    out.company = c && { name: c.trade_name, legal: c.legal_name, cnpj: c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'), site: c.site, phone: c.phone, city: c.city, uf: c.uf };
  }
  return out;
}

const settingsSchema = z.object({
  commissionPct: z.coerce.number().min(0).max(50),
  rechargeMin: z.coerce.number().min(1).max(100000),
  installmentsFrom: z.coerce.number().min(1).max(1000000),
  maxInstallments: z.coerce.number().int().min(2).max(12),
  slotMinPrice: z.coerce.number().min(1).max(100000)
}).refine(s => s.installmentsFrom >= s.rechargeMin, { message: 'O parcelamento precisa começar no valor mínimo de recarga ou acima.', path: ['installmentsFrom'] });

export default async function admin(app) {
  app.get('/api/admin/signups', async req => {
    requireRole(req, 'admin');
    return { signups: all("SELECT * FROM users WHERE role <> 'admin' ORDER BY created_at DESC").map(signupView) };
  });

  app.post('/api/admin/signups/:id/approve', async req => {
    const adminUser = requireRole(req, 'admin');
    const user = one("SELECT * FROM users WHERE id = ? AND role <> 'admin'", req.params.id);
    if (!user) throw notFound('Cadastro não encontrado.');
    if (user.status !== 'pendente') throw conflict('Este cadastro já foi analisado.');
    tx(() => {
      run("UPDATE users SET status = 'aprovado', denial_reason = NULL, approved_at = ?, approved_by = ? WHERE id = ?", now(), adminUser.id, user.id);
      run("UPDATE blogs SET status = 'script' WHERE user_id = ? AND status = 'pendente'", user.id);
      audit(adminUser.id, 'cadastro_aprovado', user.id);
    });
    queueMail(user.email, 'cadastro_aprovado', { name: user.name, role: user.role, link: `${config.APP_URL}/#entrar` }, req.log);
    return { signup: signupView(one('SELECT * FROM users WHERE id = ?', user.id)) };
  });

  app.post('/api/admin/signups/:id/deny', async req => {
    const adminUser = requireRole(req, 'admin');
    const { reason } = parse(z.object({ reason: f.reason }), req.body);
    const user = one("SELECT * FROM users WHERE id = ? AND role <> 'admin'", req.params.id);
    if (!user) throw notFound('Cadastro não encontrado.');
    if (user.status !== 'pendente') throw conflict('Este cadastro já foi analisado.');
    tx(() => {
      run("UPDATE users SET status = 'negado', denial_reason = ? WHERE id = ?", reason, user.id);
      run("UPDATE blogs SET status = 'negado' WHERE user_id = ?", user.id);
      audit(adminUser.id, 'cadastro_negado', user.id, { reason });
    });
    endAllSessions(user.id);
    queueMail(user.email, 'cadastro_negado', { name: user.name, reason }, req.log);
    return { signup: signupView(one('SELECT * FROM users WHERE id = ?', user.id)) };
  });

  app.get('/api/admin/settings', async req => { requireRole(req, 'admin'); return { settings: getSettings() }; });

  app.put('/api/admin/settings', async req => {
    const adminUser = requireRole(req, 'admin');
    const values = parse(settingsSchema, { ...getSettings(), ...req.body });
    saveSettings(values);
    audit(adminUser.id, 'configuracoes', null, values);
    return { settings: getSettings() };
  });
}