// O script que o blogueiro instala: entrega os anúncios no ar e mede visualizações e cliques.
// Rotas públicas, chamadas do blog (outro domínio) pelo leitor, que não tem conta no BlogSim.
// Os links de contagem são assinados: ninguém consegue inventar números para outra campanha.
import { createHmac } from 'node:crypto';
import { config } from '../config.js';
import { one, all, run, tx } from '../db/index.js';
import { sha256, safeEqual } from '../lib/security.js';
import { spDay } from '../lib/format.js';

const sign = body => createHmac('sha256', config.TRACK_SECRET).update(body).digest('base64url').slice(0, 22);
// Token curto: os dois ids (campanha e espaço) em 32 bytes, mais a assinatura.
const uuid = hex => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
function tokenFor(campaignId, slotId) {
  const hex = (campaignId + slotId).replace(/-/g, '');
  return `${Buffer.from(hex, 'hex').toString('base64url')}.${sign(hex)}`;
}
function readToken(token) {
  const [data, mac] = String(token || '').split('.');
  if (!/^[\w-]{43}$/.test(data || '') || !/^[\w-]{22}$/.test(mac || '')) return null;
  const hex = Buffer.from(data, 'base64url').toString('hex');
  if (hex.length !== 64 || !safeEqual(mac, sign(hex))) return null;
  return { campaignId: uuid(hex.slice(0, 32)), slotId: uuid(hex.slice(32)) };
}

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

// Post do blog onde o anúncio apareceu, mandado pelo script (?p=caminho&tt=título).
function pageOf(query) {
  const path = String(query.p || '').slice(0, 200);
  if (!path.startsWith('/')) return null;
  return { path, title: String(query.tt || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) };
}

// Conta uma visualização ou clique. A mesma pessoa (IP + navegador) conta uma vez por anúncio por dia.
async function count(kind, token, req) {
  const ad = readToken(token);
  const ua = String(req.headers['user-agent'] || '');
  if (!ad || !ua || BOT.test(ua)) return null;
  const live = await one(`SELECT c.ad_link, s.blog_id FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id JOIN slots s ON s.id = cs.slot_id
                          WHERE cs.campaign_id = ? AND cs.slot_id = ? AND c.status = 'ativa'`, ad.campaignId, ad.slotId);
  if (!live) return null;
  const day = spDay();
  const key = sha256([kind, day, ad.campaignId, ad.slotId, req.ip, ua].join('|'));
  const column = kind === 'click' ? 'clicks' : 'views';
  await tx(async () => {
    const fresh = await run('INSERT INTO ad_seen (key, day) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', key, day);
    if (!fresh.changes) return;
    await run(`INSERT INTO ad_stats (campaign_id, slot_id, day, ${column}) VALUES (?, ?, ?, 1)
               ON CONFLICT (campaign_id, slot_id, day) DO UPDATE SET ${column} = ad_stats.${column} + 1`, ad.campaignId, ad.slotId, day);
    await run(`UPDATE campaigns SET ${column} = ${column} + 1 WHERE id = ?`, ad.campaignId);
    const page = pageOf(req.query);
    if (page) await run(`INSERT INTO ad_pages (blog_id, day, path, title, ${column}) VALUES (?, ?, ?, ?, 1)
               ON CONFLICT (blog_id, day, path) DO UPDATE SET ${column} = ad_pages.${column} + 1, title = CASE WHEN excluded.title <> '' THEN excluded.title ELSE ad_pages.title END`,
      live.blog_id, day, page.path, page.title);
  });
  return live;
}

// Link do anúncio: só http(s). Sem protocolo, vira https.
function destination(link) {
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

// Lido pelo blog, que está em outro domínio.
const publicHeaders = reply => reply.header('access-control-allow-origin', '*').header('cross-origin-resource-policy', 'cross-origin');

export default async function ads(app) {
  app.get('/slots.js', async (req, reply) => {
    publicHeaders(reply).header('cache-control', 'public, max-age=300').type('application/javascript; charset=utf-8');
    return SCRIPT.replace('__API__', JSON.stringify(config.APP_URL));
  });

  // Anúncios no ar no blog, um por espaço. Só blog ativo e com script verificado.
  app.get('/api/ads/:token', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    publicHeaders(reply).header('cache-control', 'no-store');
    const blog = await one("SELECT id FROM blogs WHERE script_token = ? AND status = 'ativo' AND script_verified_at IS NOT NULL", String(req.params.token).slice(0, 40));
    if (!blog) return { ads: [] };
    const rows = await all(`SELECT DISTINCT ON (s.placement) s.id AS slot_id, s.placement, c.id AS campaign_id, c.ad_title, c.ad_text
                            FROM slots s JOIN campaign_slots cs ON cs.slot_id = s.id JOIN campaigns c ON c.id = cs.campaign_id
                            WHERE s.blog_id = ? AND s.active AND c.status = 'ativa' ORDER BY s.placement, c.ends_at DESC`, blog.id);
    return { ads: rows.map(r => {
      const t = tokenFor(r.campaign_id, r.slot_id);
      return { placement: r.placement, title: r.ad_title, text: r.ad_text, view: `${config.APP_URL}/api/ads/view?t=${t}`, click: `${config.APP_URL}/c/${t}` };
    }) };
  });

  app.get('/api/ads/view', { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } }, async (req, reply) => {
    publicHeaders(reply).header('cache-control', 'no-store');
    await count('view', req.query.t, req);
    return reply.code(204).send();
  });

  // Clique: conta e leva o leitor ao site do anunciante.
  app.get('/c/:token', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    reply.header('cache-control', 'no-store').header('referrer-policy', 'no-referrer');
    const live = await count('click', req.params.token, req);
    const ad = readToken(req.params.token);
    const target = live ? live.ad_link : ad && (await one('SELECT ad_link FROM campaigns WHERE id = ?', ad.campaignId))?.ad_link;
    return reply.redirect((target && destination(target)) || config.APP_URL);
  });
}

// O script em si. Nada do anúncio entra como HTML: tudo vai por textContent, dentro de shadow DOM,
// para o anúncio não quebrar o layout do blog nem o blog mexer no anúncio.
const SCRIPT = String.raw`/* BlogSim · anúncios nos blogs parceiros */
(function () {
  var API = __API__;
  var me = document.currentScript || document.querySelector('script[data-blog]');
  var blog = me && me.getAttribute('data-blog');
  if (!blog || window.__blogsimLoaded) return;
  window.__blogsimLoaded = true;

  var CSS = ':host{all:initial;display:block;margin:16px 0}' +
    'a{display:block;padding:14px 16px;border:1px solid #d8dce9;border-radius:12px;background:#fff;color:#121633;text-decoration:none;font:15px/21px Arial,Helvetica,sans-serif;box-shadow:0 1px 2px rgba(18,22,51,.06)}' +
    'a:hover{border-color:#2a49de}.tag{display:inline-block;margin-bottom:6px;font-size:11px;line-height:14px;letter-spacing:.06em;text-transform:uppercase;color:#585e7e}' +
    'b{display:block;font-size:17px;line-height:23px}p{margin:4px 0 0;color:#585e7e}.cta{display:inline-block;margin-top:10px;font-weight:bold;color:#2a49de}' +
    '.pop{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(18,22,51,.55)}' +
    '.pop .box{position:relative;width:100%;max-width:380px}.x{position:absolute;top:-12px;right:-12px;width:32px;height:32px;border:0;border-radius:50%;background:#121633;color:#fff;font:bold 16px/32px Arial;cursor:pointer}';

  function ping(url) {
    try { fetch(url, { mode: 'no-cors', keepalive: true, credentials: 'omit' }); } catch (e) { new Image().src = url; }
  }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }

  // Qual post do blog: entra na contagem para o blogueiro ver onde os anúncios rendem mais.
  var PAGE = 'p=' + encodeURIComponent(location.pathname.slice(0, 200)) + '&tt=' + encodeURIComponent((document.title || '').slice(0, 120));

  function card(ad) {
    var a = el('a');
    a.href = ad.click + '?' + PAGE; a.target = '_blank'; a.rel = 'sponsored noopener';
    a.appendChild(el('span', 'tag', 'Anúncio'));
    a.appendChild(el('b', '', ad.title));
    if (ad.text) a.appendChild(el('p', '', ad.text));
    a.appendChild(el('span', 'cta', 'Saiba mais'));
    return a;
  }
  function host(content) {
    var h = document.createElement('div');
    h.setAttribute('data-blogsim-ad', '');
    var root = h.attachShadow ? h.attachShadow({ mode: 'closed' }) : h;
    var style = document.createElement('style'); style.textContent = CSS;
    root.appendChild(style); root.appendChild(content);
    return h;
  }
  // Conta a visualização quando metade do anúncio aparece na tela.
  function watch(node, url) {
    if (!('IntersectionObserver' in window)) { ping(url); return; }
    var io = new IntersectionObserver(function (es) {
      for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { io.disconnect(); ping(url); return; }
    }, { threshold: 0.5 });
    io.observe(node);
  }

  function popup(ad) {
    try { if (sessionStorage.getItem('blogsim-pop')) return; sessionStorage.setItem('blogsim-pop', '1'); } catch (e) {}
    var wrap = el('div', 'pop'), box = el('div', 'box'), x = el('button', 'x', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Fechar anúncio');
    box.appendChild(card(ad)); box.appendChild(x); wrap.appendChild(box);
    var h = host(wrap);
    function close() { if (h.parentNode) h.parentNode.removeChild(h); }
    x.onclick = close; wrap.onclick = function (e) { if (e.target === wrap) close(); };
    setTimeout(function () { document.body.appendChild(h); ping(ad.view + '&' + PAGE); }, 4000);
  }

  // Onde cada espaço entra: num elemento data-blogsim="espaço" do blog ou, sem ele, num lugar padrão.
  function place(ad) {
    if (ad.placement === 'popup') return popup(ad);
    var h = host(card(ad));
    var spot = document.querySelector('[data-blogsim="' + ad.placement + '"]');
    if (spot) spot.appendChild(h);
    else if (ad.placement === 'banner') document.body.insertBefore(h, document.body.firstChild);
    else if (ad.placement === 'inline') {
      var ps = document.querySelectorAll('article p, main p, .post p, .entry-content p');
      if (!ps.length) return;
      var p = ps[Math.min(1, ps.length - 1)];
      p.parentNode.insertBefore(h, p.nextSibling);
    } else return; // lateral só aparece onde o blog marcou
    watch(h, ad.view + '&' + PAGE);
  }

  function start() {
    fetch(API + '/api/ads/' + encodeURIComponent(blog), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : { ads: [] }; })
      .then(function (d) { (d.ads || []).forEach(place); })
      .catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
`;
