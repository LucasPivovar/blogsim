// Saques do blogueiro: ele pede o saldo disponível; o admin marca como pago depois de transferir.
import { config } from '../config.js';
import { one, all, run, id, now, audit } from '../db/index.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { requireRole, myBlog } from '../lib/security.js';
import { queueMail } from '../lib/mailer.js';
import { reais, brDate } from '../lib/format.js';

export const availableCents = blogId =>
  one('SELECT COALESCE(SUM(amount_cents), 0) AS v FROM earnings WHERE blog_id = ?', blogId).v
  - one('SELECT COALESCE(SUM(amount_cents), 0) AS v FROM payouts WHERE blog_id = ?', blogId).v;

export const payoutView = p => ({ id: p.id, blog: p.blog_name, value: reais(p.amount_cents), date: brDate(p.requested_at), status: p.status });
const PAYOUTS = 'SELECT p.*, b.name AS blog_name FROM payouts p JOIN blogs b ON b.id = p.blog_id';

export default async function payouts(app) {
  app.get('/api/payouts/me', async req => {
    const blog = myBlog(req);
    return { balance: reais(availableCents(blog.id)), payouts: all(`${PAYOUTS} WHERE p.blog_id = ? ORDER BY p.requested_at DESC`, blog.id).map(payoutView) };
  });

  app.post('/api/payouts', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const blog = myBlog(req, { verified: true });
    const amount = availableCents(blog.id);
    if (amount <= 0) throw badRequest('Você ainda não tem saldo para sacar.');
    const payoutId = id();
    run("INSERT INTO payouts (id, blog_id, amount_cents, status, requested_at) VALUES (?, ?, ?, 'pendente', ?)", payoutId, blog.id, amount, now());
    const user = one('SELECT * FROM users WHERE id = ?', blog.user_id);
    queueMail(user.email, 'saque_solicitado', { amount: reais(amount), link: `${config.APP_URL}/#entrar` }, req.log);
    reply.code(201);
    return { payout: payoutView(one(`${PAYOUTS} WHERE p.id = ?`, payoutId)) };
  });

  app.get('/api/admin/payouts', async req => {
    requireRole(req, 'admin');
    return { payouts: all(`${PAYOUTS} ORDER BY p.requested_at DESC`).map(payoutView) };
  });

  app.post('/api/admin/payouts/:id/paid', async req => {
    const adminUser = requireRole(req, 'admin');
    const p = one(`${PAYOUTS} WHERE p.id = ?`, req.params.id);
    if (!p) throw notFound('Saque não encontrado.');
    if (p.status !== 'pendente') throw conflict('Este saque já foi pago.');
    run("UPDATE payouts SET status = 'pago', paid_at = ? WHERE id = ?", now(), p.id);
    audit(adminUser.id, 'saque_pago', p.id);
    const owner = one('SELECT u.* FROM users u JOIN blogs b ON b.user_id = u.id WHERE b.id = ?', p.blog_id);
    if (owner) queueMail(owner.email, 'saque_pago', { name: owner.name, amount: reais(p.amount_cents) }, req.log);
    return { payout: payoutView(one(`${PAYOUTS} WHERE p.id = ?`, p.id)) };
  });
}