// Testa o SMTP: confere login e senha no servidor de e-mail e manda um e-mail de boas-vindas de exemplo.
// Uso: npm run mail:test -- seu@email.com
// Não abre o banco, então roda mesmo com a API ligada.
import nodemailer from 'nodemailer';
import { config } from '../config.js';
import { render, TEMPLATES } from '../emails/templates.js';

const to = process.argv[2];
if (!to || !/^\S+@\S+\.\S+$/.test(to)) { console.error('Informe o destino: npm run mail:test -- seu@email.com'); process.exit(1); }
if (!config.smtpEnabled) { console.error('SMTP desligado: preencha SMTP_HOST, SMTP_USER e SMTP_PASS no .env.'); process.exit(1); }

const transport = nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT ?? 465, secure: config.SMTP_SECURE, auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } });
try {
  await transport.verify();
  console.log(`Login no SMTP ok (${config.SMTP_USER} em ${config.SMTP_HOST}).`);
  const { subject, html, text } = render('boas_vindas', TEMPLATES.boas_vindas.sample);
  const info = await transport.sendMail({ from: config.MAIL_FROM, to, subject: `[Teste] ${subject}`, html, text });
  console.log(`E-mail de teste enviado para ${to}. Resposta do servidor: ${info.response}`);
} catch (err) {
  console.error(`Falhou: ${err.message}`);
  process.exitCode = 1;
}
