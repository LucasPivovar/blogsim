// Números dos painéis: últimos 14 dias (dia de Brasília), com a variação contra os 14 dias anteriores.
// Visualizações e cliques vêm da medição do script nos blogs; dinheiro vem das movimentações reais.
import { one, all } from '../db/index.js';
import { reais, spDay } from '../lib/format.js';

const DAY = 86400000;
const SP_DAY = col => `(${col} AT TIME ZONE 'America/Sao_Paulo')::date`;
const days = n => Array.from({ length: n }, (_, i) => spDay(new Date(Date.now() - (n - 1 - i) * DAY)));
const since = () => days(28)[0];

// rows: [{ day: 'aaaa-mm-dd', value }] → série dos 14 dias, total e variação em %.
function window14(rows, toValue = v => v) {
  const byDay = Object.fromEntries(rows.map(r => [r.day, Number(r.value) || 0]));
  const all28 = days(28);
  const prev = all28.slice(0, 14).reduce((t, d) => t + (byDay[d] || 0), 0);
  const series = all28.slice(14).map(d => ({ label: `${d.slice(8)}/${d.slice(5, 7)}`, value: toValue(byDay[d] || 0) }));
  const raw = all28.slice(14).reduce((t, d) => t + (byDay[d] || 0), 0);
  return { total: toValue(raw), series, delta: prev ? Math.round((raw - prev) / prev * 1000) / 10 : null };
}

const trafficRows = (where, ...params) => all(`SELECT st.day, SUM(st.views) AS views, SUM(st.clicks) AS clicks FROM ad_stats st
  JOIN campaigns c ON c.id = st.campaign_id JOIN slots s ON s.id = st.slot_id WHERE ${where} AND st.day >= ? GROUP BY st.day`, ...params, since());
const pick = (rows, field) => rows.map(r => ({ day: r.day, value: r[field] }));

export async function advertiserStats(userId) {
  const traffic = await trafficRows('c.advertiser_id = ?', userId);
  // Investido: gasto com campanhas menos estornos, no dia em que aconteceu.
  const spent = await all(`SELECT ${SP_DAY('created_at')} AS day, -SUM(amount_cents) AS value FROM wallet_tx
    WHERE user_id = ? AND kind IN ('campanha', 'estorno') AND status = 'pago' AND created_at >= ? GROUP BY 1`, userId, since());
  return { invested: window14(spent, reais), views: window14(pick(traffic, 'views')), clicks: window14(pick(traffic, 'clicks')) };
}

export async function bloggerStats(blog) {
  const traffic = await trafficRows('s.blog_id = ?', blog.id);
  const revenue = await all(`SELECT ${SP_DAY('created_at')} AS day, SUM(amount_cents) AS value FROM earnings WHERE blog_id = ? AND created_at >= ? GROUP BY 1`, blog.id, since());
  const last30 = days(30)[0];
  const topPosts = await all(`SELECT path, MAX(title) AS title, SUM(views) AS views, SUM(clicks) AS clicks FROM ad_pages
    WHERE blog_id = ? AND day >= ? GROUP BY path ORDER BY SUM(clicks) DESC, SUM(views) DESC LIMIT 10`, blog.id, last30);
  const topSlot = await one(`SELECT s.placement, SUM(c.weeks) AS weeks FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id JOIN slots s ON s.id = cs.slot_id
    WHERE s.blog_id = ? AND c.status IN ('ativa', 'pausada', 'encerrada') GROUP BY s.placement ORDER BY SUM(c.weeks) DESC LIMIT 1`, blog.id);
  const niche = await one(`SELECT COUNT(DISTINCT c.advertiser_id) AS n FROM campaigns c JOIN campaign_slots cs ON cs.campaign_id = c.id JOIN slots s ON s.id = cs.slot_id
    JOIN blogs b ON b.id = s.blog_id WHERE b.niche = ? AND c.created_at >= ?`, blog.niche, new Date(Date.now() - 30 * DAY).toISOString());
  return { revenue: window14(revenue, reais), views: window14(pick(traffic, 'views')), clicks: window14(pick(traffic, 'clicks')),
    topPosts, topSlot: topSlot || null, nicheAdvertisers: niche.n };
}

export async function adminStats() {
  // Volume: valor das campanhas no dia em que entraram no ar.
  const volume = await all(`SELECT ${SP_DAY('starts_at')} AS day, SUM(total_cents) AS value FROM campaigns
    WHERE starts_at IS NOT NULL AND status IN ('ativa', 'pausada', 'encerrada') AND starts_at >= ? GROUP BY 1`, since());
  return { volume: window14(volume, reais) };
}
