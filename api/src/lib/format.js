// Conversões para o formato que o front já usa: reais (não centavos) e datas dd/mm/aaaa no fuso de Brasília.
export const reais = cents => Math.round(cents) / 100;
export const brDate = iso => iso ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso)) : '';
export const addDays = (iso, days) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();