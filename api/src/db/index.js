// Banco PostgreSQL. Em produção, um Postgres de verdade (DATABASE_URL=postgres://...).
// No computador, DATABASE_URL=pglite:caminho roda um Postgres embutido (PGlite) no próprio processo,
// sem instalar nada; a API fala com ele pelo mesmo driver e protocolo usados em produção.
import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const here = dirname(fileURLToPath(import.meta.url));

// Contagens e somas chegam como número; datas, como texto ISO (UTC).
pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);
pg.types.setTypeParser(1184, v => new Date(v).toISOString());
pg.types.setTypeParser(1082, v => v);

let embedded = null;

// O banco embutido só aceita um processo por vez: dois abrindo a mesma pasta corrompem os dados.
function lockDir(dir) {
  const lock = resolve(dir, '..', `${basename(dir)}.lock`);
  try {
    writeFileSync(lock, String(process.pid), { flag: 'wx' });
  } catch {
    const pid = Number(readFileSync(lock, 'utf8'));
    let alive = false;
    try { process.kill(pid, 0); alive = pid !== process.pid; } catch {}
    if (alive) throw new Error(`O banco local (${dir}) já está aberto pela API (processo ${pid}). Pare a API antes ou use os botões de Admin → Configurações → Ambiente local.`);
    writeFileSync(lock, String(process.pid));
  }
  process.once('exit', () => { try { if (readFileSync(lock, 'utf8') === String(process.pid)) rmSync(lock); } catch {} });
}
async function connectionString() {
  if (!config.DATABASE_URL.startsWith('pglite:')) return config.DATABASE_URL;
  if (config.isProd) throw new Error('Em produção use um PostgreSQL de verdade no DATABASE_URL.');
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const target = config.DATABASE_URL.slice('pglite:'.length);
  const dataDir = target === 'memory' ? undefined : resolve(here, '../..', target);
  if (dataDir) { mkdirSync(dataDir, { recursive: true }); lockDir(dataDir); }
  const instance = await PGlite.create(dataDir);
  const server = new PGLiteSocketServer({ db: instance, port: 0, host: '127.0.0.1', maxConnections: 1 });
  await server.start();
  embedded = { instance, server };
  return `postgres://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`;
}

export const pool = new pg.Pool({
  connectionString: await connectionString(),
  // O PGlite atende uma conexão por vez.
  max: embedded ? 1 : config.PG_POOL_MAX,
  ssl: config.PG_SSL ? { rejectUnauthorized: false } : undefined
});
pool.on('error', err => console.error('Erro na conexão com o banco:', err.message));

// Dentro de tx(), todas as consultas usam a mesma conexão (a da transação), sem precisar passá-la adiante.
const txConn = new AsyncLocalStorage();
const numbered = sql => { let n = 0; return sql.replace(/\?/g, () => '$' + ++n); };
const query = (sql, params) => (txConn.getStore() || pool).query(numbered(sql), params);

export const one = async (sql, ...params) => (await query(sql, params)).rows[0];
export const all = async (sql, ...params) => (await query(sql, params)).rows;
export const run = async (sql, ...params) => ({ changes: (await query(sql, params)).rowCount });
export const id = () => randomUUID();
export const now = () => new Date().toISOString();

// Executa várias escritas como uma só: ou tudo grava, ou nada.
export async function tx(fn) {
  if (txConn.getStore()) return fn();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await txConn.run(client, fn);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Trabalho que segue depois da resposta (e-mail, por exemplo) não pode herdar a conexão da transação.
export const detached = fn => txConn.exit(fn);

// Cria as tabelas que faltam. Roda na subida da API; o esquema só usa CREATE ... IF NOT EXISTS.
export const migrate = () => pool.query(readFileSync(resolve(here, 'schema.sql'), 'utf8'));

export async function closeDb() {
  await pool.end();
  if (embedded) { await embedded.server.stop(); await embedded.instance.close(); embedded = null; }
}

const DEFAULT_SETTINGS = { commissionPct: 20, rechargeMin: 100, installmentsFrom: 500, maxInstallments: 6, slotMinPrice: 50 };

export async function getSettings() {
  const rows = await all('SELECT key, value FROM settings');
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map(r => [r.key, Number(r.value)])) };
}

export function saveSettings(values) {
  return tx(async () => {
    for (const [key, value] of Object.entries(values)) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', key, String(value));
    }
  });
}

export const audit = (actorId, action, target, detail) =>
  run('INSERT INTO audit_log (id, actor_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', id(), actorId || null, action, target || null, detail ? JSON.stringify(detail) : null, now());