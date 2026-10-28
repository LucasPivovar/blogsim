// Job diário: encerra as campanhas que passaram do prazo e manda o relatório do dia
// para cada anunciante e blogueiro com campanha no ar. Os números do dia vêm da medição do script
// nos blogs (tabela ad_stats). Rode com: npm run report:daily (de preferência perto do fim do dia).
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { all, run, now, migrate, closeDb } from '../db/index.js';
import { queueMail, sendMail } from '../lib/mailer.js';
import { endCampaign } from '../modules/campaigns.js';
import { reais, brDate, spDay } from '../lib/format.js';

export async function runDailyReport(log = console, { wait = false } = {}) {
  const mail = wait ? sendMail : queueMail;
  const expired = await all("SELECT * FROM campaigns WHERE status = 'ativa' AND ends_at <= ?", now());
  for (const c of expired) await endCampaign(c, null, log);

  const day = spDay();
  const date = brDate(now());
  const link = `${config.APP_URL}/#entrar`;
  let sent = 0;

  const advertisers = await all(`SELECT DISTINCT u.id, u.name, u.email FROM campaigns c JOIN users u ON u.id = c.advertiser_id WHERE c.status = 'ativa'`);
  for (const a of advertisers) {
    const rows = await all(`SELECT c.name AS campaign, c.views, c.clicks, COALESCE(SUM(st.views), 0) AS "dayViews", COALESCE(SUM(st.clicks), 0) AS "dayClicks"
                            FROM campaigns c LEFT JOIN ad_stats st ON st.campaign_id = c.id AND st.day = ?
                            WHERE c.advertiser_id = ? AND c.status = 'ativa' GROUP BY c.id ORDER BY c.name`, day, a.id);
    const views = rows.reduce((t, r) => t + r.dayViews, 0), clicks = rows.reduce((t, r) => t + r.dayClicks, 0);
    await mail(a.email, 'relatorio_diario', { role: 'anunciante', name: a.name, date, views, clicks, rows, link }, log);
    sent++;
  }

  const bloggers = await all(`SELECT DISTINCT u.id, u.name, u.email, b.id AS blog_id, b.name AS blog FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id
                        JOIN slots s ON s.id = cs.slot_id JOIN blogs b ON b.id = s.blog_id JOIN users u ON u.id = b.user_id WHERE c.status = 'ativa'`);
  for (const b of bloggers) {
    const rows = (await all(`SELECT co.trade_name AS advertiser, s.placement, c.ends_at, COALESCE(st.views, 0) AS views, COALESCE(st.clicks, 0) AS clicks
                      FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id JOIN slots s ON s.id = cs.slot_id JOIN companies co ON co.user_id = c.advertiser_id
                      LEFT JOIN ad_stats st ON st.campaign_id = c.id AND st.slot_id = s.id AND st.day = ?
                      WHERE s.blog_id = ? AND c.status = 'ativa' ORDER BY c.ends_at`, day, b.blog_id))
      .map(r => ({ advertiser: r.advertiser, placement: r.placement, until: brDate(r.ends_at), views: r.views, clicks: r.clicks }));
    const total = (await all(`SELECT e.amount_cents FROM earnings e JOIN campaigns c ON c.id = e.campaign_id WHERE e.blog_id = ? AND c.status = 'ativa'`, b.blog_id)).reduce((t, r) => t + r.amount_cents, 0);
    await mail(b.email, 'relatorio_diario', { role: 'blogueiro', name: b.name, blog: b.blog, date, total: reais(total),
      views: rows.reduce((t, r) => t + r.views, 0), clicks: rows.reduce((t, r) => t + r.clicks, 0), rows, link }, log);
    sent++;
  }

  // A lista de "já contado hoje" só serve para o dia corrente.
  await run('DELETE FROM ad_seen WHERE day < ?', day);
  return { ended: expired.length, sent };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await migrate();
  const result = await runDailyReport(console, { wait: true });
  console.log(`Relatório do dia: ${result.sent} e-mails, ${result.ended} campanhas encerradas.`);
  await closeDb();
}
