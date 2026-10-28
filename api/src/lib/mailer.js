// Gera o e-mail pelo template, registra na caixa de saída e envia pelo SMTP quando ele está configurado.
// Sem SMTP (desenvolvimento), o e-mail fica só na caixa de saída, visível em /dev/emails.
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { run, id, now, detached } from '../db/index.js';
import { render } from '../emails/templates.js';

const transport = config.smtpEnabled
  ? nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT ?? 465, secure: config.SMTP_SECURE, auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } })
  : null;

// Fora de produção, só os domínios ou endereços de MAIL_ONLY_TO recebem e-mail de verdade.
function allowed(to) {
  if (!config.mailOnlyTo.length) return true;
  const addr = to.toLowerCase();
  return config.mailOnlyTo.some(rule => rule.includes('@') ? addr === rule : addr.endsWith('@' + rule));
}

export async function sendMail(to, template, data, log = console) {
  if (!to) return;
  const { subject, html, text } = render(template, data);
  const outboxId = id();
  const live = transport && allowed(to);
  await run('INSERT INTO email_outbox (id, to_email, template, subject, html, text, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    outboxId, to, template, subject, html, text, live ? 'enviado' : 'simulado', now());
  if (!live) return;
  try {
    await transport.sendMail({ from: config.MAIL_FROM, to, subject, html, text });
  } catch (err) {
    // Falha de e-mail não derruba a ação da pessoa; fica registrada para reenviar.
    await run("UPDATE email_outbox SET status = 'falhou', error = ? WHERE id = ?", String(err.message).slice(0, 300), outboxId);
    log.error({ err: err.message, template }, 'falha ao enviar e-mail');
  }
}

// Envia sem esperar: a resposta da API não fica presa no tempo do SMTP.
export const queueMail = (to, template, data, log) => { detached(() => sendMail(to, template, data, log).catch(err => log?.error?.({ err: err.message }, 'falha ao registrar e-mail'))); };