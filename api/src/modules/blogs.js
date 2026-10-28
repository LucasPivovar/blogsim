// Blogs: lista para o anunciante, Meu blog, verificação do script e espaços à venda.
import { z } from 'zod';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from '../config.js';
import { one, all, run, id, now, getSettings, audit } from '../db/index.js';
import { parse, badRequest, notFound, conflict, forbidden } from '../lib/errors.js';
import * as f from '../lib/fields.js';
import { requireRole, myBlog } from '../lib/security.js';
import { saveLogo } from '../lib/uploads.js';
import { queueMail } from '../lib/mailer.js';
import { reais } from '../lib/format.js';

export function blogView(b) {
  return { id: b.id, name: b.name, site: b.site, niche: b.niche, city: b.city, uf: b.uf, audience: b.audience, color: b.color, logo: b.logo_path || undefined,
    desc: b.description, status: b.status, owner: b.owner || undefined, slots: b.slot_count ?? undefined, scriptToken: b.script_token, scriptVerified: Boolean(b.script_verified_at) };
}
export const slotView = s => ({ id: s.id, blogId: s.blog_id, placement: s.placement, price: reais(s.price_cents), active: Boolean(s.active) });

// Endereço privado ou local não pode ser visitado pelo servidor (evita SSRF).
function privateIp(ip) {
  if (isIP(ip) === 6) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || ip.startsWith('::ffff:') && privateIp(ip.slice(7));
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

async function siteHasScript(site, token) {
  const host = site.split('/')[0];
  const { address } = await lookup(host);
  if (privateIp(address)) return false;
  const res = await fetch(`https://${site}`, { redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'user-agent': 'BlogSim-Verificador/1.0' } });
  if (!res.ok) return false;
  const html = (await res.text()).slice(0, 2_000_000);
  // Aceita o endereço atual do script e o antigo (cdn.blogsim.com.br), para quem instalou antes.
  const script = config.scriptUrl.replace(/^https?:\/\//, '');
  return (html.includes(script) || html.includes('cdn.blogsim.com.br/slots.js')) && html.includes(`data-blog="${token}"`);
}

const blogUpdate = z.object({ name: f.text(2, 80, 'Informe o nome do blog.'), site: f.site, niche: f.niche, city: f.city, uf: f.uf, desc: z.string().trim().max(240).default(''), logo: f.logo });
const newSlot = z.object({ placement: z.enum(f.PLACEMENTS), price: f.money });
const slotPatch = z.object({ price: f.money.optional(), active: z.boolean().optional() });

export default async function blogs(app) {
  // Explorar blogs: só blogs ativos e espaços ativos.
  app.get('/api/blogs', async req => {
    requireRole(req, 'anunciante', 'admin');
    const list = (await all("SELECT * FROM blogs WHERE status = 'ativo' ORDER BY name")).map(blogView);
    const slots = (await all("SELECT s.* FROM slots s JOIN blogs b ON b.id = s.blog_id WHERE b.status = 'ativo' AND s.active")).map(slotView);
    return { blogs: list, slots };
  });

  app.get('/api/blogs/me', async req => {
    const blog = await myBlog(req);
    return { blog: blogView(blog), slots: (await all('SELECT * FROM slots WHERE blog_id = ? ORDER BY placement', blog.id)).map(slotView) };
  });

  app.put('/api/blogs/me', async req => {
    const blog = await myBlog(req);
    const d = parse(blogUpdate, req.body);
    const logoPath = d.logo && d.logo.startsWith('data:') ? saveLogo(d.logo) : blog.logo_path;
    await run('UPDATE blogs SET name = ?, site = ?, niche = ?, city = ?, uf = ?, description = ?, logo_path = ? WHERE id = ?', d.name, d.site, d.niche, d.city, d.uf, d.desc, logoPath, blog.id);
    return { blog: blogView(await one('SELECT * FROM blogs WHERE id = ?', blog.id)) };
  });

  app.post('/api/blogs/me/verify-script', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async req => {
    const blog = await myBlog(req);
    if (blog.script_verified_at) return { verified: true, blog: blogView(blog) };
    let found = false;
    if (config.fakeScriptCheck) found = true;
    else { try { found = await siteHasScript(blog.site, blog.script_token); } catch { found = false; } }
    if (!found) throw badRequest(`Ainda não encontramos o script em ${blog.site}. Confira se ele está no cabeçalho do blog e tente de novo em alguns minutos.`, 'SCRIPT_NOT_FOUND');
    await run("UPDATE blogs SET script_verified_at = ?, status = CASE WHEN status = 'script' THEN 'ativo' ELSE status END WHERE id = ?", now(), blog.id);
    const user = await one('SELECT * FROM users WHERE id = ?', blog.user_id);
    queueMail(user.email, 'script_verificado', { blog: blog.name, site: blog.site, link: `${config.APP_URL}/#entrar` }, req.log);
    return { verified: true, blog: blogView(await one('SELECT * FROM blogs WHERE id = ?', blog.id)) };
  });

  app.post('/api/blogs/me/slots', async (req, reply) => {
    const blog = await myBlog(req, { verified: true });
    const d = parse(newSlot, req.body);
    const { slotMinPrice } = await getSettings();
    if (d.price < slotMinPrice * 100) throw badRequest(`O preço mínimo é R$ ${slotMinPrice},00 por semana.`);
    if (await one('SELECT 1 FROM slots WHERE blog_id = ? AND placement = ?', blog.id, d.placement)) throw conflict('Esse espaço já existe no seu blog.');
    const slotId = id();
    await run('INSERT INTO slots (id, blog_id, placement, price_cents, active) VALUES (?, ?, ?, ?, TRUE)', slotId, blog.id, d.placement, d.price);
    reply.code(201);
    return { slot: slotView(await one('SELECT * FROM slots WHERE id = ?', slotId)) };
  });

  app.patch('/api/blogs/me/slots/:id', async req => {
    const blog = await myBlog(req, { verified: true });
    const slot = await one('SELECT * FROM slots WHERE id = ? AND blog_id = ?', req.params.id, blog.id); // só o espaço do próprio blog
    if (!slot) throw notFound('Espaço não encontrado.');
    const d = parse(slotPatch, req.body);
    const { slotMinPrice } = await getSettings();
    if (d.price !== undefined && d.price < slotMinPrice * 100) throw badRequest(`O preço mínimo é R$ ${slotMinPrice},00 por semana.`);
    if (d.active === false && await one("SELECT 1 FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id WHERE cs.slot_id = ? AND c.status IN ('revisao', 'ativa')", slot.id)) {
      throw forbidden('Espaços alugados só podem ser pausados depois do fim do aluguel.');
    }
    await run('UPDATE slots SET price_cents = COALESCE(?::int, price_cents), active = COALESCE(?::boolean, active) WHERE id = ?', d.price ?? null, d.active ?? null, slot.id);
    await audit(blog.user_id, 'espaco_alterado', slot.id, d);
    return { slot: slotView(await one('SELECT * FROM slots WHERE id = ?', slot.id)) };
  });
}