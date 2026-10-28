// Servidor da API do BlogSim. Em desenvolvimento também serve o front (dist/index.html),
// para front e API ficarem na mesma origem: o cookie de sessão funciona sem CORS.
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { HttpError, forbidden } from './lib/errors.js';
import { loadUser, sameOrigin } from './lib/security.js';
import { uploadDir } from './lib/uploads.js';
import auth from './modules/auth.js';
import admin from './modules/admin.js';
import blogs from './modules/blogs.js';
import billing from './modules/billing.js';
import campaigns from './modules/campaigns.js';
import payouts from './modules/payouts.js';
import state from './modules/state.js';
import dev from './modules/dev.js';
import ads from './modules/ads.js';

const here = dirname(fileURLToPath(import.meta.url));
const frontDir = resolve(here, '../../dist');

export async function buildApp() {
  const app = Fastify({
    logger: config.isTest ? false : { level: config.isProd ? 'info' : 'warn' },
    bodyLimit: 2 * 1024 * 1024,
    trustProxy: config.isProd
  });

  await app.register(helmet, {
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: config.cookieSecure ? [] : null
    } },
    hsts: config.cookieSecure ? { maxAge: 31536000 } : false,
    crossOriginEmbedderPolicy: false
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 300, timeWindow: '1 minute',
    // Nos testes o limite fica desligado, menos quando o teste quer justamente verificá-lo.
    allowList: req => config.isTest && req.headers['x-test-rate-limit'] !== 'on',
    errorResponseBuilder: (req, ctx) => ({ statusCode: 429, code: 'RATE_LIMIT', message: `Muitas tentativas. Tente de novo em ${Math.ceil(ctx.ttl / 1000)} segundos.` })
  });

  app.addHook('onRequest', async req => {
    req.user = await loadUser(req);
    const changes = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (changes && req.url.startsWith('/api/') && !sameOrigin(req)) throw forbidden('Requisição de outra origem bloqueada.', 'BAD_ORIGIN');
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) return reply.code(err.status).send({ error: { code: err.code, message: err.message, ...err.extra } });
    if (err.statusCode === 429) return reply.code(429).send({ error: { code: 'RATE_LIMIT', message: err.message } });
    if (err.statusCode === 413) return reply.code(413).send({ error: { code: 'TOO_LARGE', message: 'O envio passou do tamanho permitido.' } });
    if (err.statusCode && err.statusCode < 500) return reply.code(err.statusCode).send({ error: { code: 'INVALID', message: 'Requisição inválida.' } });
    req.log.error(err);
    return reply.code(500).send({ error: { code: 'SERVER', message: 'Algo deu errado do nosso lado. Tente de novo em instantes.' } });
  });

  app.get('/api/health', async () => ({ ok: true, api: true, dev: !config.isProd, smtp: config.smtpEnabled }));
  for (const mod of [auth, admin, blogs, billing, campaigns, payouts, state, ads, dev]) await app.register(mod);

  app.setNotFoundHandler((req, reply) => reply.code(404).send(req.url.startsWith('/api/') ? { error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } } : 'Página não encontrada.'));

  if (existsSync(frontDir)) await app.register(fastifyStatic, { root: frontDir, prefix: '/', index: ['index.html'] });
  await app.register(fastifyStatic, { root: uploadDir, prefix: '/uploads/', decorateReply: false, setHeaders: res => res.setHeader('X-Content-Type-Options', 'nosniff') });

  return app;
}