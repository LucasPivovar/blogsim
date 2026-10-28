// Cria uma conta de admin e manda para ela o e-mail "Criar senha nova". A senha é escolhida
// pela própria pessoa no link; ninguém precisa digitar senha no terminal.
// Uso: npm run admin:create -- email@blogsim.com.br "Nome da Pessoa"
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { one, run, id, now, migrate, closeDb } from '../db/index.js';
import { hashPassword, newToken } from '../lib/security.js';
import { sendMail } from '../lib/mailer.js';

const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(' ').trim();
if (!email || !/^\S+@\S+\.\S+$/.test(email) || name.length < 3) {
  console.error('Uso: npm run admin:create -- email@blogsim.com.br "Nome da Pessoa"');
  process.exit(1);
}
if (!config.smtpEnabled) { console.error('Ligue o SMTP antes (SMTP_PASS no .env): o link para criar a senha vai por e-mail.'); process.exit(1); }

await migrate();
const addr = email.toLowerCase();
let user = await one('SELECT * FROM users WHERE email = ?', addr);
if (user && user.role !== 'admin') { console.error('Esse e-mail já é de um anunciante ou blogueiro.'); process.exitCode = 1; }
else {
  if (!user) {
    // Senha aleatória que ninguém sabe: a conta só entra depois do link.
    await run(`INSERT INTO users (id, role, name, email, password_hash, status, email_verified_at, approved_at, created_at)
               VALUES (?, 'admin', ?, ?, ?, 'aprovado', ?, ?, ?)`, id(), name, addr, await hashPassword(randomBytes(24).toString('hex')), now(), now(), now());
    user = await one('SELECT * FROM users WHERE email = ?', addr);
  }
  const { token, hash } = newToken();
  await run('INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id(), user.id, 'reset_password', hash, new Date(Date.now() + 30 * 60000).toISOString(), now());
  await sendMail(addr, 'recuperar_senha', { name: user.name, link: `${config.APP_URL}/#nova-senha=${token}` });
  const sent = await one('SELECT status, error FROM email_outbox WHERE to_email = ? ORDER BY created_at DESC LIMIT 1', addr);
  console.log(sent.status === 'enviado' ? `Admin ${addr} pronto. O link para criar a senha foi enviado e vale 30 minutos (depois, use "Esqueci a senha" no login).` : `Admin criado, mas o e-mail falhou: ${sent.error || sent.status}`);
}
await closeDb();
