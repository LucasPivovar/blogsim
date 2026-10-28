// Peças do layout dos e-mails. HTML em tabelas e estilos inline, que é o que os clientes de e-mail entendem.
// Tudo que vem do usuário passa por esc() antes de entrar no HTML.
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const C = { ink: '#121633', muted: '#585e7e', line: '#d8dce9', bg: '#f5f6fa', brand: '#2a49de', accent: '#f26a1b', soft: '#eceef5' };
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

export const BRL = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
export const NUM = v => new Intl.NumberFormat('pt-BR').format(v);

// Blocos: cada um devolve { html, text }.
export const p = text => ({ html: `<p style="margin:0 0 16px;font:16px/24px ${FONT};color:${C.ink}">${text}</p>`, text: strip(text) });
export const muted = text => ({ html: `<p style="margin:0 0 16px;font:14px/21px ${FONT};color:${C.muted}">${text}</p>`, text: strip(text) });
export const button = (label, href) => ({
  html: `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:10px;background:${C.brand}">
    <a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font:bold 15px/20px ${FONT};color:#ffffff;text-decoration:none;border-radius:10px">${esc(label)}</a></td></tr></table>`,
  text: `${label}: ${href}`
});
export const info = rows => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
    ${rows.map(([k, v], i) => `<tr><td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:14px/20px ${FONT};color:${C.muted};width:42%">${esc(k)}</td>
      <td style="padding:12px 16px;${i ? `border-top:1px solid ${C.line};` : ''}font:bold 14px/20px ${FONT};color:${C.ink}">${esc(v)}</td></tr>`).join('')}</table>`,
  text: rows.map(([k, v]) => `${k}: ${v}`).join('\n')
});
export const table = (head, rows) => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ${C.line};border-radius:12px;border-collapse:separate">
    <tr>${head.map((h, i) => `<th align="${i ? 'right' : 'left'}" style="padding:10px 12px;background:${C.soft};font:bold 12px/16px ${FONT};color:${C.muted};text-transform:uppercase;letter-spacing:.04em">${esc(h)}</th>`).join('')}</tr>
    ${rows.map(r => `<tr>${r.map((v, i) => `<td align="${i ? 'right' : 'left'}" style="padding:10px 12px;border-top:1px solid ${C.line};font:14px/20px ${FONT};color:${C.ink}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table>`,
  text: [head.join(' | '), ...rows.map(r => r.join(' | '))].join('\n')
});
export const highlight = (label, value) => ({
  html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="padding:18px 20px;background:${C.soft};border-radius:12px">
    <div style="font:13px/18px ${FONT};color:${C.muted}">${esc(label)}</div>
    <div style="font:bold 28px/34px ${FONT};color:${C.ink}">${esc(value)}</div></td></tr></table>`,
  text: `${label}: ${value}`
});

function strip(html) { return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

// Monta o e-mail inteiro: cabeçalho com a marca, título, blocos e rodapé.
export function layout({ preheader, title, blocks, footer }) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 4px 20px;font:bold 24px/28px ${FONT};letter-spacing:-.5px;color:${C.ink}">Blog<span style="color:${C.brand}">Sim</span></td></tr>
    <tr><td style="background:#ffffff;border:1px solid ${C.line};border-radius:16px;padding:32px 28px">
      <h1 style="margin:0 0 20px;font:bold 24px/30px ${FONT};color:${C.ink}">${esc(title)}</h1>
      ${blocks.map(b => b.html).join('\n')}
    </td></tr>
    <tr><td style="padding:20px 4px 0;font:12px/18px ${FONT};color:${C.muted}">
      ${esc(footer || 'Você recebeu este e-mail porque tem uma conta no BlogSim.')} Este endereço só envia mensagens; respostas não são lidas.<br>BlogSim · Anúncios nos blogs que o seu cliente já lê.
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = [`BlogSim`, '', title, '', ...blocks.map(b => b.text), '', 'Este endereço só envia mensagens; respostas não são lidas.'].join('\n');
  return { html, text };
}