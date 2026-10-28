// Configuração lida do .env e validada na subida: se faltar algo obrigatório, a API não sobe.
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform(v => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4100),
  APP_URL: z.url().default('http://localhost:4100'),
  // postgres://usuario:senha@127.0.0.1:5432/blogsim em produção; pglite:data/pg roda um Postgres embutido no computador.
  DATABASE_URL: z.string().default('pglite:data/pg'),
  PG_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  PG_SSL: bool.default('false'),
  // Assina os links de visualização e clique dos anúncios. Em produção, um texto aleatório longo.
  TRACK_SECRET: z.string().min(32).default('somente-para-desenvolvimento-local-0000000000'),
  // Endereço do script que o blogueiro instala. Vazio: <APP_URL>/slots.js.
  SCRIPT_URL: z.url().optional(),
  UPLOAD_DIR: z.string().default('data/uploads'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: bool.default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('BlogSim <naoresponda@blogsim.com.br>'),
  ADMIN_NOTIFY_EMAIL: z.email().optional(),
  // Fora de produção, e-mail de verdade só sai para estes domínios ou endereços (separados por vírgula).
  // Os outros ficam como 'simulado' na caixa de saída, para contas de exemplo nunca receberem nada.
  MAIL_ONLY_TO: z.string().default('blogsim.com.br'),
  // Texto antes do assunto, para separar e-mails de teste (ex.: "[TESTE] ").
  MAIL_SUBJECT_PREFIX: z.string().optional(),
  // Em desenvolvimento os blogs de exemplo não existem de verdade; isto aceita a verificação do script sem visitar o site.
  DEV_FAKE_SCRIPT_CHECK: bool.default('true'),
  QA_ADMIN_PASSWORD: z.string().min(8).optional(),
  QA_ANUNCIANTE_PASSWORD: z.string().min(8).optional(),
  QA_BLOGUEIRO_PASSWORD: z.string().min(8).optional()
});

// Campo vazio no .env (ex.: ADMIN_NOTIFY_EMAIL=) vale como não preenchido.
const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')));
if (!parsed.success) {
  console.error('Configuração inválida no .env:\n' + parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

const env = parsed.data;
export const config = {
  ...env,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  appOrigin: new URL(env.APP_URL).origin,
  cookieSecure: env.APP_URL.startsWith('https://'),
  smtpEnabled: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  scriptUrl: env.SCRIPT_URL || new URL('/slots.js', env.APP_URL).href,
  mailOnlyTo: env.NODE_ENV === 'production' ? [] : env.MAIL_ONLY_TO.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
  fakeScriptCheck: env.NODE_ENV !== 'production' && env.DEV_FAKE_SCRIPT_CHECK
};

if (config.isProd && config.fakeScriptCheck) throw new Error('DEV_FAKE_SCRIPT_CHECK não pode valer em produção.');
if (config.isProd && config.TRACK_SECRET.startsWith('somente-para')) throw new Error('Defina TRACK_SECRET no .env de produção.');
if (config.isProd && !config.cookieSecure) throw new Error('Em produção o APP_URL precisa ser https.');