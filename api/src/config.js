// Configuração lida do .env e validada na subida: se faltar algo obrigatório, a API não sobe.
import { z } from 'zod';

const bool = z.enum(['true', 'false']).transform(v => v === 'true');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4100),
  APP_URL: z.url().default('http://localhost:4100'),
  DB_FILE: z.string().default('data/blogsim.db'),
  UPLOAD_DIR: z.string().default('data/uploads'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: bool.default('true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('BlogSim <naoresponda@blogsim.com.br>'),
  ADMIN_NOTIFY_EMAIL: z.email().optional(),
  // Em desenvolvimento os blogs de exemplo não existem de verdade; isto aceita a verificação do script sem visitar o site.
  DEV_FAKE_SCRIPT_CHECK: bool.default('true'),
  QA_ADMIN_PASSWORD: z.string().min(8).optional(),
  QA_ANUNCIANTE_PASSWORD: z.string().min(8).optional(),
  QA_BLOGUEIRO_PASSWORD: z.string().min(8).optional()
});

const parsed = schema.safeParse(process.env);
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
  fakeScriptCheck: env.NODE_ENV !== 'production' && env.DEV_FAKE_SCRIPT_CHECK
};

if (config.isProd && config.fakeScriptCheck) throw new Error('DEV_FAKE_SCRIPT_CHECK não pode valer em produção.');