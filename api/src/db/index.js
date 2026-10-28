// Banco local em SQLite (node:sqlite, sem dependência nativa). Em produção a ideia é PostgreSQL;
// as consultas ficam neste formato simples para a troca ser direta.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const here = dirname(fileURLToPath(import.meta.url));
const file = config.DB_FILE === ':memory:' ? ':memory:' : resolve(here, '../..', config.DB_FILE);
if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(readFileSync(resolve(here, 'schema.sql'), 'utf8'));

export const one = (sql, ...params) => db.prepare(sql).get(...params);
export const all = (sql, ...params) => db.prepare(sql).all(...params);
export const run = (sql, ...params) => db.prepare(sql).run(...params);
export const id = () => randomUUID();
export const now = () => new Date().toISOString();

// Executa várias escritas como uma só: ou tudo grava, ou nada.
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const DEFAULT_SETTINGS = { commissionPct: 20, rechargeMin: 100, installmentsFrom: 500, maxInstallments: 6, slotMinPrice: 50 };

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const saved = Object.fromEntries(rows.map(r => [r.key, Number(r.value)]));
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function saveSettings(values) {
  tx(() => {
    for (const [key, value] of Object.entries(values)) {
      run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, String(value));
    }
  });
}

export function audit(actorId, action, target, detail) {
  run('INSERT INTO audit_log (id, actor_id, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)', id(), actorId || null, action, target || null, detail ? JSON.stringify(detail) : null, now());
}