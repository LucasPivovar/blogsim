// Só em desenvolvimento: a página com todos os templates de e-mail e a caixa de saída,
// e a simulação de pagamento confirmado (no lugar do webhook do gateway).
import { config } from '../config.js';
import { one, all } from '../db/index.js';
import { requireRole } from '../lib/security.js';
import { notFound, forbidden } from '../lib/errors.js';
import { TEMPLATES, render } from '../emails/templates.js';
import { esc } from '../emails/layout.js';
import { confirmRecharge, txView } from './billing.js';
import { runDailyReport } from '../jobs/daily-report.js';

const page = body => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mails do BlogSim</title>
<style>body{margin:0;background:#f5f6fa;color:#121633;font:15px/22px Arial,sans-serif}main{max-width:1200px;margin:0 auto;padding:32px 20px}
h1{font-size:28px;margin:0 0 6px}h2{font-size:18px;margin:40px 0 12px}p.sub{color:#585e7e;margin:0 0 24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px}.card{background:#fff;border:1px solid #d8dce9;border-radius:14px;overflow:hidden}
.card header{padding:14px 16px;border-bottom:1px solid #d8dce9}.card b{display:block}.card small{color:#585e7e}iframe{width:100%;height:520px;border:0;background:#f5f6fa}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #d8dce9;border-radius:12px}td,th{padding:10px 12px;border-top:1px solid #d8dce9;text-align:left;font-size:14px}
th{background:#eceef5;border-top:0}a{color:#2a49de}.st{font-weight:bold}</style></head><body><main>${body}</main></body></html>`;

export default async function dev(app) {
  if (config.isProd) return;

  app.get('/dev/emails', async (req, reply) => {
    const outbox = all('SELECT id, to_email, template, subject, status, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 50');
    const cards = Object.entries(TEMPLATES).map(([key, t]) => `<section class="card"><header><b>${esc(t.label)}</b><small>Para: ${esc(t.to)} · Quando: ${esc(t.when)}</small><br><small>Assunto: ${esc(t.subject(t.sample))}</small></header>
      <iframe src="/dev/emails/${key}" title="${esc(t.label)}" loading="lazy"></iframe></section>`).join('');
    const rows = outbox.map(o => `<tr><td>${esc(new Date(o.created_at).toLocaleString('pt-BR'))}</td><td>${esc(o.to_email)}</td><td><a href="/dev/outbox/${o.id}" target="_blank" rel="noopener">${esc(o.subject)}</a></td><td class="st">${esc(o.status)}</td></tr>`).join('');
    reply.type('text/html').send(page(`<h1>E-mails do BlogSim</h1><p class="sub">Página local, só em desenvolvimento. ${config.smtpEnabled ? 'SMTP ligado: os e-mails estão saindo de verdade.' : 'SMTP desligado: os e-mails ficam só na caixa de saída abaixo.'}</p>
      <h2>Caixa de saída (últimos 50)</h2>${rows ? `<table><tr><th>Quando</th><th>Para</th><th>Assunto</th><th>Situação</th></tr>${rows}</table>` : '<p class="sub">Nenhum e-mail gerado ainda.</p>'}
      <h2>Templates (${Object.keys(TEMPLATES).length})</h2><div class="grid">${cards}</div>`));
  });

  app.get('/dev/emails/:key', async (req, reply) => {
    const t = TEMPLATES[req.params.key];
    if (!t) throw notFound('Template não encontrado.');
    reply.type('text/html').send(render(req.params.key, t.sample).html);
  });

  app.get('/dev/outbox/:id', async (req, reply) => {
    const row = one('SELECT html FROM email_outbox WHERE id = ?', req.params.id);
    if (!row) throw notFound('E-mail não encontrado.');
    reply.type('text/html').send(row.html);
  });

  // Simula o banco confirmando o pagamento de uma recarga do próprio anunciante.
  app.post('/api/dev/recharges/:id/confirm', async req => {
    const user = requireRole(req, 'anunciante');
    const t = one("SELECT * FROM wallet_tx WHERE id = ? AND kind = 'recarga'", req.params.id);
    if (!t || t.user_id !== user.id) throw forbidden();
    return { recharge: txView(confirmRecharge(t.id, user.id, req.log)) };
  });

  // Dispara o relatório do dia na hora, para testar.
  app.post('/api/dev/reports/daily', async req => { requireRole(req, 'admin'); return runDailyReport(req.log); });
}