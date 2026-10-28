// Job diário: encerra as campanhas que passaram do prazo e manda o relatório do dia
// para cada anunciante e blogueiro com campanha no ar. Rode com: npm run report:daily
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { all, now } from '../db/index.js';
import { queueMail, sendMail } from '../lib/mailer.js';
import { endCampaign } from '../modules/campaigns.js';
import { reais, brDate } from '../lib/format.js';

export async function runDailyReport(log = console, { wait = false } = {}) {
  const mail = wait ? sendMail : queueMail;
  const expired = all("SELECT * FROM campaigns WHERE status = 'ativa' AND ends_at <= ?", now());
  for (const c of expired) endCampaign(c, null, log);

  const date = brDate(now());
  const link = `${config.APP_URL}/#entrar`;
  let sent = 0;

  const advertisers = all(`SELECT DISTINCT u.id, u.name, u.email FROM campaigns c JOIN users u ON u.id = c.advertiser_id WHERE c.status = 'ativa'`);
  for (const a of advertisers) {
    const rows = all("SELECT name AS campaign, views, clicks, results FROM campaigns WHERE advertiser_id = ? AND status = 'ativa' ORDER BY name", a.id);
    await mail(a.email, 'relatorio_diario', { role: 'anunciante', name: a.name, date, clicks: rows.reduce((t, r) => t + r.clicks, 0), rows, link }, log);
    sent++;
  }

  const bloggers = all(`SELECT DISTINCT u.id, u.name, u.email, b.id AS blog_id, b.name AS blog FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id
                        JOIN slots s ON s.id = cs.slot_id JOIN blogs b ON b.id = s.blog_id JOIN users u ON u.id = b.user_id WHERE c.status = 'ativa'`);
  for (const b of bloggers) {
    const rows = all(`SELECT co.trade_name AS advertiser, s.placement, c.ends_at FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id
                      JOIN slots s ON s.id = cs.slot_id JOIN companies co ON co.user_id = c.advertiser_id WHERE s.blog_id = ? AND c.status = 'ativa'`, b.blog_id)
      .map(r => ({ advertiser: r.advertiser, placement: r.placement, until: brDate(r.ends_at) }));
    const total = all(`SELECT e.amount_cents FROM earnings e JOIN campaigns c ON c.id = e.campaign_id WHERE e.blog_id = ? AND c.status = 'ativa'`, b.blog_id).reduce((t, r) => t + r.amount_cents, 0);
    await mail(b.email, 'relatorio_diario', { role: 'blogueiro', name: b.name, blog: b.blog, date, total: reais(total), rows, link }, log);
    sent++;
  }
  return { ended: expired.length, sent };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runDailyReport(console, { wait: true });
  console.log(`Relatório do dia: ${result.sent} e-mails, ${result.ended} campanhas encerradas.`);
}