// Campanhas: o anunciante cria (o valor sai do saldo), o admin aprova ou recusa, e ela termina no fim do período.
import { z } from 'zod';
import { config } from '../config.js';
import { one, all, run, id, now, tx, audit, getSettings } from '../db/index.js';
import { parse, badRequest, notFound, conflict } from '../lib/errors.js';
import * as f from '../lib/fields.js';
import { requireRole, requireUser } from '../lib/security.js';
import { queueMail } from '../lib/mailer.js';
import { reais, brDate, addDays } from '../lib/format.js';
import { balanceCents } from './billing.js';

const link = () => `${config.APP_URL}/#entrar`;

export async function campaignView(c) {
  const blogs = (await all('SELECT DISTINCT b.name FROM campaign_slots cs JOIN slots s ON s.id = cs.slot_id JOIN blogs b ON b.id = s.blog_id WHERE cs.campaign_id = ? ORDER BY b.name', c.id)).map(r => r.name);
  const company = await one('SELECT trade_name FROM companies WHERE user_id = ?', c.advertiser_id);
  return { id: c.id, name: c.name, advertiser: company ? company.trade_name : '', objective: c.objective, status: c.status,
    invested: reais(c.total_cents), clicks: c.clicks, views: c.views, results: c.results, blogs: blogs.length, blogNames: blogs,
    weeks: c.weeks, startsAt: brDate(c.starts_at), endsAt: brDate(c.ends_at), reason: c.review_note || undefined };
}
export const campaignViews = rows => Promise.all(rows.map(campaignView));
const byId = async campaignId => campaignView(await one('SELECT * FROM campaigns WHERE id = ?', campaignId));

const createSchema = z.object({
  name: f.text(2, 80, 'Dê um nome à campanha.'),
  objective: z.enum(['visitas', 'conversas', 'vendas']),
  slotIds: z.array(z.uuid()).min(1, 'Escolha pelo menos um espaço.').max(30),
  weeks: z.coerce.number().int().min(1, 'Escolha de 1 a 12 semanas.').max(12, 'Escolha de 1 a 12 semanas.'),
  ad: z.object({ title: f.text(2, 40, 'Escreva um título para o anúncio.'), text: z.string().trim().max(90).default(''), link: f.text(4, 300, 'Diga para onde o leitor vai ao clicar no anúncio.') })
});

export async function endCampaign(c, actorId, log) {
  const ended = await one("UPDATE campaigns SET status = 'encerrada', ends_at = COALESCE(ends_at, ?) WHERE id = ? AND status IN ('ativa', 'pausada') RETURNING *", now(), c.id);
  if (!ended) return;
  await audit(actorId, 'campanha_encerrada', c.id);
  const adv = await one('SELECT * FROM users WHERE id = ?', c.advertiser_id);
  queueMail(adv.email, 'campanha_encerrada', { campaign: c.name, invested: reais(ended.total_cents), views: ended.views, clicks: ended.clicks, results: ended.results, link: link() }, log);
}

export default async function campaigns(app) {
  app.get('/api/campaigns', async req => {
    const user = requireRole(req, 'anunciante', 'admin');
    const rows = user.role === 'admin' ? await all('SELECT * FROM campaigns ORDER BY created_at DESC') : await all('SELECT * FROM campaigns WHERE advertiser_id = ? ORDER BY created_at DESC', user.id);
    return { campaigns: await campaignViews(rows) };
  });

  app.post('/api/campaigns', { config: { rateLimit: { max: 20, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const user = requireRole(req, 'anunciante');
    const d = parse(createSchema, req.body);
    const ids = [...new Set(d.slotIds)];
    const slots = await all(`SELECT s.* FROM slots s JOIN blogs b ON b.id = s.blog_id WHERE b.status = 'ativo' AND s.active AND s.id IN (${ids.map(() => '?').join(',')})`, ...ids);
    if (slots.length !== ids.length) throw badRequest('Algum espaço escolhido não está mais disponível. Escolha de novo.');
    const total = slots.reduce((t, s) => t + s.price_cents, 0) * d.weeks;
    const campaignId = await tx(async () => {
      // A conta do anunciante fica travada até o fim: duas abas ao mesmo tempo não gastam o mesmo dinheiro.
      await one('SELECT id FROM users WHERE id = ? FOR UPDATE', user.id);
      const balance = await balanceCents(user.id);
      if (total > balance) throw badRequest(`Seu saldo é de R$ ${(balance / 100).toFixed(2).replace('.', ',')}. Adicione mais saldo em Faturamento para publicar.`, 'INSUFFICIENT_BALANCE');
      const cid = id();
      await run(`INSERT INTO campaigns (id, advertiser_id, name, objective, status, weeks, total_cents, ad_title, ad_text, ad_link, created_at)
           VALUES (?, ?, ?, ?, 'revisao', ?, ?, ?, ?, ?, ?)`, cid, user.id, d.name, d.objective, d.weeks, total, d.ad.title, d.ad.text, d.ad.link, now());
      for (const s of slots) await run('INSERT INTO campaign_slots (campaign_id, slot_id, price_cents) VALUES (?, ?, ?)', cid, s.id, s.price_cents);
      await run("INSERT INTO wallet_tx (id, user_id, kind, amount_cents, status, description, campaign_id, created_at) VALUES (?, ?, 'campanha', ?, 'pago', ?, ?, ?)",
        id(), user.id, -total, `${d.name} · ${slots.length} ${slots.length > 1 ? 'espaços' : 'espaço'}`, cid, now());
      return cid;
    });
    reply.code(201);
    return { campaign: await byId(campaignId) };
  });

  // Encerrar: o dono da campanha ou o admin.
  app.post('/api/campaigns/:id/end', async req => {
    const user = requireUser(req);
    const c = await one('SELECT * FROM campaigns WHERE id = ?', req.params.id);
    if (!c || (user.role !== 'admin' && c.advertiser_id !== user.id)) throw notFound('Campanha não encontrada.');
    if (!['ativa', 'pausada'].includes(c.status)) throw conflict('Só campanhas no ar podem ser encerradas.');
    await endCampaign(c, user.id, req.log);
    return { campaign: await byId(c.id) };
  });

  // Aprovar: entra no ar, o blogueiro recebe a parte dele e todo mundo é avisado.
  app.post('/api/admin/campaigns/:id/approve', async req => {
    const adminUser = requireRole(req, 'admin');
    const c = await one('SELECT * FROM campaigns WHERE id = ?', req.params.id);
    if (!c) throw notFound('Campanha não encontrada.');
    const start = now(), end = addDays(start, c.weeks * 7);
    const pct = (await getSettings()).commissionPct;
    const lines = await all(`SELECT cs.price_cents, s.placement, b.id AS blog_id, b.name AS blog, u.email, u.name AS owner FROM campaign_slots cs
                       JOIN slots s ON s.id = cs.slot_id JOIN blogs b ON b.id = s.blog_id LEFT JOIN users u ON u.id = b.user_id WHERE cs.campaign_id = ?`, c.id);
    const share = l => Math.round(l.price_cents * c.weeks * (100 - pct) / 100);
    await tx(async () => {
      // Só sai de "revisão" uma vez: dois cliques não geram ganho em dobro.
      const moved = await run("UPDATE campaigns SET status = 'ativa', starts_at = ?, ends_at = ?, reviewed_by = ? WHERE id = ? AND status = 'revisao'", start, end, adminUser.id, c.id);
      if (!moved.changes) throw conflict('Esta campanha já foi revisada.');
      for (const l of lines) await run('INSERT INTO earnings (id, blog_id, campaign_id, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)', id(), l.blog_id, c.id, share(l), now());
      await audit(adminUser.id, 'campanha_aprovada', c.id);
    });
    const adv = await one('SELECT u.email, co.trade_name FROM users u JOIN companies co ON co.user_id = u.id WHERE u.id = ?', c.advertiser_id);
    queueMail(adv.email, 'campanha_iniciada', { campaign: c.name, start: brDate(start), end: brDate(end), total: reais(c.total_cents), blogs: lines.map(l => ({ blog: l.blog, placement: l.placement })), link: link() }, req.log);
    for (const l of lines) if (l.email) queueMail(l.email, 'anuncio_publicado', { blog: l.blog, advertiser: adv.trade_name, placement: l.placement, until: brDate(end), earnings: reais(share(l)), link: link() }, req.log);
    return { campaign: await byId(c.id) };
  });

  // Recusar: o valor volta inteiro para o saldo.
  app.post('/api/admin/campaigns/:id/deny', async req => {
    const adminUser = requireRole(req, 'admin');
    const { reason } = parse(z.object({ reason: f.reason }), req.body);
    const c = await one('SELECT * FROM campaigns WHERE id = ?', req.params.id);
    if (!c) throw notFound('Campanha não encontrada.');
    await tx(async () => {
      const moved = await run("UPDATE campaigns SET status = 'recusada', review_note = ?, reviewed_by = ? WHERE id = ? AND status = 'revisao'", reason, adminUser.id, c.id);
      if (!moved.changes) throw conflict('Esta campanha já foi revisada.');
      await run("INSERT INTO wallet_tx (id, user_id, kind, amount_cents, status, description, campaign_id, created_at) VALUES (?, ?, 'estorno', ?, 'pago', ?, ?, ?)",
        id(), c.advertiser_id, c.total_cents, `Estorno · ${c.name}`, c.id, now());
      await audit(adminUser.id, 'campanha_recusada', c.id, { reason });
    });
    const adv = await one('SELECT email FROM users WHERE id = ?', c.advertiser_id);
    queueMail(adv.email, 'campanha_recusada', { campaign: c.name, reason, refund: reais(c.total_cents), link: link() }, req.log);
    return { campaign: await byId(c.id) };
  });
}
