// Saldo do anunciante. A recarga nasce pendente; o saldo só entra quando o pagamento é confirmado
// (no futuro, pelo webhook do gateway; hoje, pelo admin ou pela simulação em desenvolvimento).
import { z } from 'zod';
import { config } from '../config.js';
import { one, all, run, id, now, tx, audit, getSettings } from '../db/index.js';
import { parse, badRequest, notFound, conflict } from '../lib/errors.js';
import { requireRole } from '../lib/security.js';
import { queueMail } from '../lib/mailer.js';
import { reais, brDate } from '../lib/format.js';

export const balanceCents = userId => one("SELECT COALESCE(SUM(amount_cents), 0) AS v FROM wallet_tx WHERE user_id = ? AND status = 'pago'", userId).v;
export const txView = t => ({ id: t.id, date: brDate(t.created_at), desc: t.description, value: reais(t.amount_cents), status: t.status, method: t.method, installments: t.installments });

const rechargeSchema = z.object({ amount: z.coerce.number().positive().max(1_000_000), method: z.enum(['pix', 'cartao']), installments: z.coerce.number().int().min(1).max(12).default(1) });

export function confirmRecharge(rechargeId, actorId, log) {
  const t = one("SELECT * FROM wallet_tx WHERE id = ? AND kind = 'recarga'", rechargeId);
  if (!t) throw notFound('Recarga não encontrada.');
  if (t.status !== 'pendente') throw conflict('Esta recarga já foi processada.');
  run("UPDATE wallet_tx SET status = 'pago', paid_at = ? WHERE id = ?", now(), t.id);
  audit(actorId, 'recarga_confirmada', t.id);
  const user = one('SELECT * FROM users WHERE id = ?', t.user_id);
  queueMail(user.email, 'pagamento_confirmado', { amount: reais(t.amount_cents), balance: reais(balanceCents(user.id)), link: `${config.APP_URL}/#entrar` }, log);
  return t;
}

export default async function billing(app) {
  app.get('/api/billing', async req => {
    const user = requireRole(req, 'anunciante');
    return { balance: reais(balanceCents(user.id)), txns: all('SELECT * FROM wallet_tx WHERE user_id = ? ORDER BY created_at DESC', user.id).map(txView), settings: getSettings() };
  });

  app.post('/api/billing/recharges', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const user = requireRole(req, 'anunciante');
    const d = parse(rechargeSchema, req.body);
    const s = getSettings();
    if (d.amount < s.rechargeMin) throw badRequest(`A recarga mínima é de R$ ${s.rechargeMin},00.`);
    if (d.installments > 1 && (d.method !== 'cartao' || d.amount < s.installmentsFrom)) throw badRequest(`Parcelamento só no cartão, a partir de R$ ${s.installmentsFrom},00.`);
    if (d.installments > s.maxInstallments) throw badRequest(`O máximo é de ${s.maxInstallments} parcelas.`);
    const cents = Math.round(d.amount * 100);
    const how = d.method === 'cartao' ? 'cartão de crédito' + (d.installments > 1 ? ` em ${d.installments}x` : '') : 'Pix';
    const txId = id();
    run("INSERT INTO wallet_tx (id, user_id, kind, amount_cents, method, installments, status, description, created_at) VALUES (?, ?, 'recarga', ?, ?, ?, 'pendente', ?, ?)",
      txId, user.id, cents, d.method, d.installments, 'Recarga via ' + how, now());
    queueMail(user.email, 'pagamento_solicitado', { amount: d.amount, method: d.method, installments: d.installments, link: `${config.APP_URL}/#entrar` }, req.log);
    reply.code(201);
    return { recharge: txView(one('SELECT * FROM wallet_tx WHERE id = ?', txId)) };
  });

  app.post('/api/admin/recharges/:id/confirm', async req => {
    const adminUser = requireRole(req, 'admin');
    return { recharge: txView(confirmRecharge(req.params.id, adminUser.id, req.log)) };
  });
}