// Senhas, sessões, tokens de e-mail e as checagens de acesso usadas em todas as rotas.
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { one, run, id, now } from '../db/index.js';
import { unauthorized, forbidden } from './errors.js';

// argon2id com os parâmetros mínimos recomendados pela OWASP.
const ARGON = { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
export const hashPassword = password => hash(password, ARGON);
export const verifyPassword = async (stored, password) => { try { return await verify(stored, password); } catch { return false; } };

// Hash fixo para comparar quando o e-mail não existe: a resposta demora o mesmo tempo e não revela quem tem conta.
let dummyHash;
export async function verifyOrWaste(stored, password) {
  if (stored) return verifyPassword(stored, password);
  dummyHash ??= await hashPassword('senha-que-nao-existe-123');
  await verifyPassword(dummyHash, password);
  return false;
}

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => { const token = randomBytes(32).toString('base64url'); return { token, hash: sha256(token) }; };

// ----- Sessão em cookie httpOnly. No banco fica só o hash do token. -----
export const COOKIE = config.cookieSecure ? '__Host-blogsim_session' : 'blogsim_session';
const DAY = 24 * 60 * 60 * 1000;

export async function startSession(req, reply, userId, remember) {
  const { token, hash: tokenHash } = newToken();
  const ttl = (remember ? 30 : 7) * DAY;
  await run('INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id(), userId, tokenHash, new Date(Date.now() + ttl).toISOString(), now(), req.ip, String(req.headers['user-agent'] || '').slice(0, 200));
  reply.setCookie(COOKIE, token, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: Math.floor(ttl / 1000) });
}

export async function endSession(req, reply) {
  const token = req.cookies[COOKIE];
  if (token) await run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  reply.clearCookie(COOKIE, { path: '/' });
}

// Troca de senha ou cadastro negado: derruba as sessões e volta a pedir o código em todo navegador.
export async function endAllSessions(userId) {
  await run('DELETE FROM sessions WHERE user_id = ?', userId);
  await run('DELETE FROM trusted_devices WHERE user_id = ?', userId);
}

// ----- Navegador confiável: depois do código, a pessoa pode pular a verificação por 30 dias. -----
const DEVICE = config.cookieSecure ? '__Host-blogsim_device' : 'blogsim_device';

export async function trustDevice(reply, userId) {
  const { token, hash: tokenHash } = newToken();
  const ttl = 30 * DAY;
  await run('INSERT INTO trusted_devices (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)', id(), userId, tokenHash, new Date(Date.now() + ttl).toISOString(), now());
  reply.setCookie(DEVICE, token, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: '/', maxAge: Math.floor(ttl / 1000) });
}

export async function isTrustedDevice(req, userId) {
  const token = req.cookies[DEVICE];
  if (!token) return false;
  return Boolean(await one('SELECT 1 FROM trusted_devices WHERE token_hash = ? AND user_id = ? AND expires_at > ?', sha256(token), userId, now()));
}

// Carrega a pessoa logada. Conta que deixou de estar aprovada perde a sessão na hora.
export async function loadUser(req) {
  const token = req.cookies[COOKIE];
  if (!token) return null;
  const row = await one(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                   WHERE s.token_hash = ? AND s.expires_at > ?`, sha256(token), now());
  return row && row.status === 'aprovado' && row.email_verified_at ? row : null;
}

// ----- Proteção contra CSRF: requisição que altera dados precisa vir do próprio site. -----
export function sameOrigin(req) {
  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
  return origin === config.appOrigin;
}

// ----- Guardas de acesso -----
export function requireUser(req) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireRole(req, ...roles) {
  const user = requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}

// Blog da pessoa logada; o blogueiro só mexe no próprio.
export async function myBlog(req, { verified = false } = {}) {
  const user = requireRole(req, 'blogueiro');
  const blog = await one('SELECT * FROM blogs WHERE user_id = ?', user.id);
  if (!blog) throw forbidden('Sua conta não tem blog vinculado.');
  if (verified && !blog.script_verified_at) throw forbidden('Instale e verifique o script do BlogSim para liberar esta parte.', 'SCRIPT_NOT_VERIFIED');
  return blog;
}

export const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));