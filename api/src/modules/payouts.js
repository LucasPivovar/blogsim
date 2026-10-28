// Saques do blogueiro: ele pede o saldo disponível; o admin marca como pago depois de transferir.
import { config } from '../config.js';
import { one, all, run, id, now, tx, audit } from '../db/index.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { requireRole, myBlog } from '../lib/security.js';
import { queueMail } from '../lib/mailer.js';
import { reais, brDate } from '../lib/format.js';

export const availableCents = async blogId => (await one(`SELECT (SELECT COALESCE(SUM(amount_cents), 0) FROM earnings WHERE blog_id = ?)
  - (SELECT COALESCE(SUM(amount_cents), 0) FROM payouts WHERE blog_id = ?) AS v`, blogId, blogId)).v;

export const payoutView = p => ({ id: p.id, blog: p.blog_name, value: reais(p.amount_cents), date: brDate(p.requested_at), status: p.status });
const PAYOUTS = 'SELECT p.*, b.name AS blog_name FROM payouts p JOIN blogs b ON b.id = p.blog_id';

export default async function payouts(app) {
  app.get('/api/payouts/me', async req => {
    const blog = await myBlog(req);
    return { balance: reais(await availableCents(blog.id)), payouts: (await all(`${PAYOUTS} WHERE p.blog_id = ? ORDER BY p.requested_at DESC`, blog.id)).map(payoutView) };
  });

  app.post('/api/payouts', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const blog = await myBlog(req, { verified: true });
    const payoutId = id();
    // O blog fica travado durante a conta: dois pedidos ao mesmo tempo não sacam o mesmo saldo.
    const amount = await tx(async () => {
      await one('SELECT id FROM blogs WHERE id = ? FOR UPDATE', blog.id);
      const value = await availableCents(blog.id);
      if (value <= 0) throw badRequest('Você ainda não tem saldo para sacar.');
      await run("INSERT INTO payouts (id, blog_id, amount_cents, status, requested_at) VALUES (?, ?, ?, 'pendente', ?)", payoutId, blog.id, value, now());
      return value;
    });
    const user = await one('SELECT * FROM users WHERE id = ?', blog.user_id);
    queueMail(user.email, 'saque_solicitado', { amount: reais(amount), link: `${config.APP_URL}/#entrar` }, req.log);
    reply.code(201);
    return { payout: payoutView(await one(`${PAYOUTS} WHERE p.id = ?`, payoutId)) };
  });

  app.get('/api/admin/payouts', async req => {
    requireRole(req, 'admin');
    return { payouts: (await all(`${PAYOUTS} ORDER BY p.requested_at DESC`)).map(payoutView) };
  });

  app.post('/api/admin/payouts/:id/paid', async req => {
    const adminUser = requireRole(req, 'admin');
    const p = await one(`${PAYOUTS} WHERE p.id = ?`, req.params.id);
    if (!p) throw notFound('Saque não encontrado.');
    const paid = await run("UPDATE payouts SET status = 'pago', paid_at = ? WHERE id = ? AND status = 'pendente'", now(), p.id);
    if (!paid.changes) throw conflict('Este saque já foi pago.');
    await audit(adminUser.id, 'saque_pago', p.id);
    const owner = await one('SELECT u.* FROM users u JOIN blogs b ON b.user_id = u.id WHERE b.id = ?', p.blog_id);
    if (owner) queueMail(owner.email, 'saque_pago', { name: owner.name, amount: reais(p.amount_cents) }, req.log);
    return { payout: payoutView(await one(`${PAYOUTS} WHERE p.id = ?`, p.id)) };
  });
}
