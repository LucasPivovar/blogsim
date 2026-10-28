// Só em desenvolvimento: a página com todos os templates de e-mail e a caixa de saída,
// um blog de teste com o script instalado, e a simulação de pagamento confirmado (no lugar do webhook do gateway).
import { config } from '../config.js';
import { one, all } from '../db/index.js';
import { requireRole } from '../lib/security.js';
import { notFound, forbidden } from '../lib/errors.js';
import { TEMPLATES, render } from '../emails/templates.js';
import { esc } from '../emails/layout.js';
import { confirmRecharge, txView } from './billing.js';
import { runDailyReport } from '../jobs/daily-report.js';
import { spDay } from '../lib/format.js';

const page = (title, body) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#f5f6fa;color:#121633;font:15px/22px Arial,sans-serif}main{max-width:1200px;margin:0 auto;padding:32px 20px}
h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:40px 0 12px}p.sub{color:#585e7e;margin:0 0 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px}.card{background:#fff;border:1px solid #d8dce9;border-radius:14px;overflow:hidden}
.card header{padding:14px 16px;border-bottom:1px solid #d8dce9}.card b{display:block}.card small{color:#585e7e}iframe{width:100%;height:520px;border:0;background:#f5f6fa}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d8dce9;border-radius:12px}td,th{padding:10px 12px;border-top:1px solid #d8dce9;text-align:left;font-size:14px}
th{background:#eceef5;border-top:0}a{color:#2a49de}.st{font-weight:bold}</style></head><body><main>${body}</main></body></html>`;

// Um post de blog de mentira, com os quatro lugares marcados, para ver os anúncios e testar a contagem.
const blogPage = (blog, token) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(blog)} · blog de teste</title>
<style>body{margin:0;background:#fff;color:#222;font:17px/28px Georgia,serif}.top{padding:14px 20px;border-bottom:1px solid #eee;font:bold 20px Arial}
.wrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:40px;max-width:1080px;margin:0 auto;padding:24px 20px}@media(max-width:800px){.wrap{grid-template-columns:1fr}}
aside{font:15px/22px Arial}aside h3{font-size:14px;text-transform:uppercase;color:#888}.note{margin:0 0 20px;padding:10px 14px;background:#fff7e6;border-radius:8px;font:14px/20px Arial}</style>
</head><body>
<div class="top">${esc(blog)}</div>
<div data-blogsim="banner"></div>
<div class="wrap"><article>
<p class="note">Blog de teste local. Os anúncios abaixo vêm do script do BlogSim; cada um que aparece na tela conta uma visualização e cada clique conta um clique (uma vez por pessoa por dia).</p>
<h1>Cinco dicas para a próxima viagem em família</h1>
<p>Planejar com antecedência faz toda a diferença: reserve hospedagem perto das atrações e deixe espaço no roteiro para imprevistos.</p>
<p>Leve lanches e uma muda de roupa na bolsa de mão. Criança com fome ou molhada transforma qualquer passeio em maratona.</p>
<p>Escolha passeios curtos, alterne programas de adulto com programas de criança e respeite o horário do cochilo.</p>
<p>Fotografe menos e aproveite mais. As melhores lembranças costumam ser as que ninguém planejou.</p>
<p>Por fim, combine as regras antes de sair: tempo de tela, doces e hora de dormir. Fica mais fácil para todo mundo.</p>
</article><aside><h3>Patrocinado</h3><div data-blogsim="lateral"></div></aside></div>
<script async src="${esc(config.scriptUrl)}" data-blog="${esc(token)}"></script>
</body></html>`;

export default async function dev(app) {
  if (config.isProd) return;

  app.get('/dev/emails', async (req, reply) => {
    const outbox = await all('SELECT id, to_email, template, subject, status, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 50');
    const cards = Object.entries(TEMPLATES).map(([key, t]) => `<section class="card"><header><b>${esc(t.label)}</b><small>Para: ${esc(t.to)} · Quando: ${esc(t.when)}</small><br><small>Assunto: ${esc(t.subject(t.sample))}</small></header>
      <iframe src="/dev/emails/${key}" title="${esc(t.label)}" loading="lazy"></iframe></section>`).join('');
    const rows = outbox.map(o => `<tr><td>${esc(new Date(o.created_at).toLocaleString('pt-BR'))}</td><td>${esc(o.to_email)}</td><td><a href="/dev/outbox/${o.id}" target="_blank" rel="noopener">${esc(o.subject)}</a></td><td class="st">${esc(o.status)}</td></tr>`).join('');
    const smtp = config.smtpEnabled
      ? `SMTP ligado: e-mails para ${esc(config.mailOnlyTo.join(', ') || 'qualquer endereço')} saem de verdade; os outros ficam como "simulado".`
      : 'SMTP desligado: os e-mails ficam só na caixa de saída abaixo.';
    reply.type('text/html').send(page('E-mails do BlogSim', `<h1>E-mails do BlogSim</h1><p class="sub">Página local, só em desenvolvimento. ${smtp} <a href="/dev/blog">Blogs de teste com o script →</a></p>
      <h2>Caixa de saída (últimos 50)</h2>${rows ? `<table><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Situação</th></tr>${rows}</table>` : '<p class="sub">Nenhum e-mail gerado ainda.</p>'}
      <h2>Templates (${Object.keys(TEMPLATES).length})</h2><div class="grid">${cards}</div>`));
  });

  app.get('/dev/emails/:key', async (req, reply) => {
    const t = TEMPLATES[req.params.key];
    if (!t) throw notFound('Template não encontrado.');
    reply.type('text/html').send(render(req.params.key, t.sample).html);
  });

  app.get('/dev/outbox/:id', async (req, reply) => {
    const row = await one('SELECT html FROM email_outbox WHERE id = ?', req.params.id);
    if (!row) throw notFound('E-mail não encontrado.');
    reply.type('text/html').send(row.html);
  });

  // Lista dos blogs ativos com o número de anúncios no ar e os números de hoje.
  app.get('/dev/blog', async (req, reply) => {
    const blogs = await all(`SELECT b.name, b.script_token,
        (SELECT COUNT(DISTINCT c.id) FROM slots s JOIN campaign_slots cs ON cs.slot_id = s.id JOIN campaigns c ON c.id = cs.campaign_id WHERE s.blog_id = b.id AND c.status = 'ativa') AS live,
        (SELECT COALESCE(SUM(st.views), 0) FROM ad_stats st JOIN slots s ON s.id = st.slot_id WHERE s.blog_id = b.id AND st.day = ?) AS views,
        (SELECT COALESCE(SUM(st.clicks), 0) FROM ad_stats st JOIN slots s ON s.id = st.slot_id WHERE s.blog_id = b.id AND st.day = ?) AS clicks
      FROM blogs b WHERE b.status = 'ativo' ORDER BY b.name`, spDay(), spDay());
    const rows = blogs.map(b => `<tr><td><a href="/dev/blog/${esc(b.script_token)}" target="_blank" rel="noopener">${esc(b.name)}</a></td><td>${b.live}</td><td>${b.views}</td><td>${b.clicks}</td></tr>`).join('');
    reply.type('text/html').send(page('Blogs de teste', `<h1>Blogs de teste</h1><p class="sub">Cada link abre um post de mentira com o script do BlogSim instalado. <a href="/dev/emails">← E-mails</a></p>
      <table><tr><th>Blog</th><th>Campanhas no ar</th><th>Visualizações hoje</th><th>Cliques hoje</th></tr>${rows}</table>`));
  });

  app.get('/dev/blog/:token', async (req, reply) => {
    const blog = await one('SELECT name, script_token FROM blogs WHERE script_token = ?', req.params.token);
    if (!blog) throw notFound('Blog não encontrado.');
    reply.type('text/html').send(blogPage(blog.name, blog.script_token));
  });

  // Simula o banco confirmando o pagamento de uma recarga do próprio anunciante.
  app.post('/api/dev/recharges/:id/confirm', async req => {
    const user = requireRole(req, 'anunciante', 'admin');
    const t = await one("SELECT * FROM wallet_tx WHERE id = ? AND kind = 'recarga'", req.params.id);
    if (!t || (user.role !== 'admin' && t.user_id !== user.id)) throw forbidden();
    return { recharge: txView(await confirmRecharge(t.id, user.id, req.log)) };
  });

  // Dispara o relatório do dia na hora, para testar.
  app.post('/api/dev/reports/daily', async req => { requireRole(req, 'admin'); return runDailyReport(req.log); });
}
