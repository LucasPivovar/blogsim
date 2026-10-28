// Regras de campo compartilhadas pelos schemas (zod) das rotas.
import { z } from 'zod';

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
export const NICHES = ['Viagem', 'Culinária', 'Fitness', 'Finanças', 'Pets', 'Tecnologia', 'Maternidade', 'Esportes'];
export const PLACEMENTS = ['popup', 'lateral', 'banner', 'inline'];

export function cnpjOk(value) {
  const n = String(value).replace(/\D/g, '');
  if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
  const dv = len => { let s = 0, w = len - 7; for (let i = 0; i < len; i++) { s += Number(n[i]) * w--; if (w < 2) w = 9; } const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === Number(n[12]) && dv(13) === Number(n[13]);
}

const text = (min, max, msg) => z.string({ error: msg }).trim().min(min, msg).max(max, `Use no máximo ${max} caracteres.`);
export const email = z.string({ error: 'Informe o e-mail.' }).trim().toLowerCase().max(160).pipe(z.email('Informe um e-mail válido.'));
export const password = z.string({ error: 'Informe a senha.' }).min(8, 'Use pelo menos 8 caracteres, com letras e números.').max(128)
  .refine(v => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use pelo menos 8 caracteres, com letras e números.');
export const personName = text(2, 80, 'Informe seu nome.');
export const site = z.string().trim().toLowerCase().max(120).regex(/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/, 'Informe o endereço, como seublog.com.br.')
  .transform(v => v.replace(/^https?:\/\//, '').replace(/\/+$/, ''));
export const optionalSite = z.union([z.literal(''), site]).default('');
export const uf = z.enum(UFS, { error: 'Escolha o estado.' });
export const city = text(2, 60, 'Informe a cidade.');
export const niche = z.enum(NICHES, { error: 'Escolha um nicho da lista.' });
export const cnpj = z.string().transform(v => v.replace(/\D/g, '')).refine(cnpjOk, 'Informe um CNPJ válido.');
export const phone = z.string().transform(v => v.replace(/\D/g, '')).refine(v => v.length >= 10 && v.length <= 11, 'Informe um telefone com DDD.');
export const money = z.coerce.number().positive('Informe um valor maior que zero.').max(1_000_000).transform(v => Math.round(v * 100));
export const reason = text(3, 240, 'Escreva o motivo.');
export const logo = z.string().max(1_500_000, 'A logo passa de 1 MB.').optional().nullable();
export { text };