// Logo do blog: aceita só PNG, JPG e WebP conferindo os primeiros bytes (não a extensão), até 1 MB.
// SVG fica de fora porque pode carregar script. O arquivo ganha um nome aleatório.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { badRequest } from './errors.js';

const here = dirname(fileURLToPath(import.meta.url));
export const uploadDir = resolve(here, '../..', config.UPLOAD_DIR);
mkdirSync(uploadDir, { recursive: true });

const KINDS = [
  { ext: 'png', test: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', test: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', test: b => b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' }
];

export function saveLogo(dataUrl) {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw badRequest('A logo precisa ser PNG, JPG ou WebP.');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 1024 * 1024) throw badRequest('A logo tem mais de 1 MB. Escolha uma menor.');
  const kind = KINDS.find(k => k.test(bytes));
  if (!kind) throw badRequest('A logo precisa ser PNG, JPG ou WebP.');
  mkdirSync(uploadDir, { recursive: true });
  const name = `${randomUUID()}.${kind.ext}`;
  writeFileSync(resolve(uploadDir, name), bytes);
  return `/uploads/${name}`;
}