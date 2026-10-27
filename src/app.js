/* Protótipo navegável do BlogSim: três perfis, dados de exemplo, estado em memória. */
(function () {
  const { useState, useEffect } = React;
  const B = window.BlogSim, h = React.createElement;
  if (window.gsap && window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);

  // Animações com GSAP. Só rodam sem "reduzir movimento"; sem GSAP, tudo aparece no estado final.
  function useMotion(ref, fn, deps) {
    React.useLayoutEffect(() => {
      const g = window.gsap;
      if (!g || !ref.current) return;
      const mm = g.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => { fn(g, ref.current); });
      return () => mm.revert();
    }, deps);
  }
  // Conta o número de um MetricCard até o valor, mexendo só no texto que o React já criou.
  function countUp(g, el) {
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;
    const txt = node.nodeValue, n = parseFloat(txt.replace(/[^\d,-]/g, '').replace(',', '.'));
    if (isNaN(n) || n === 0) return;
    const dec = /,\d+/.test(txt) ? txt.split(',').pop().replace(/\D/g, '').length : 0;
    const fmt = txt.includes('R$') ? v => BRL.format(v)
      : txt.trim().endsWith('%') ? v => v.toFixed(dec).replace('.', ',') + '%'
      : v => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
    const o = { v: 0 };
    g.to(o, { v: n, duration: 1.1, ease: 'power2.out', onUpdate: () => { node.nodeValue = fmt(o.v); }, onComplete: () => { node.nodeValue = txt; } });
  }
  // Separa um texto em palavras com máscara, para a animação de entrada dos títulos.
  const Words = text => text.split(' ').map((w, i, all) => [h('span', { key: i, className: 'w' }, h('span', { className: 'wi' }, w)), i < all.length - 1 ? ' ' : null]);
  const from = (tl, targets, vars, pos) => { const list = [...targets].filter(Boolean); if (list.length) tl.from(list, vars, pos); return tl; };
  const RENT_FROM = { backgroundColor: 'rgba(255,255,255,0)', borderColor: '#8a90ab', color: '#585e7e', borderStyle: 'dashed' };

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const NUM = new Intl.NumberFormat('pt-BR');
  const COMPACT = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  const money = v => BRL.format(v);
  const count = v => NUM.format(v);
  const sum = (list, key) => list.reduce((t, x) => t + (x[key] || 0), 0);

  const PLACE = { popup: 'Pop-up', lateral: 'Lateral', banner: 'Banner topo', inline: 'No meio do post' };
  const OBJ_LABEL = { visitas: 'Visitas no site', conversas: 'Conversas no WhatsApp', vendas: 'Vendas' };
  const OBJ_TONE = { visitas: 'brand', conversas: 'teal', vendas: 'accent' };
  const ROLE_KEYS = ['anunciante', 'blogueiro', 'admin'];
  const ME = 'Passo Certo Calçados';
  const MY_BLOG = 'Viagem com Criança';
  const USER = { anunciante: ME, blogueiro: 'Renata · ' + MY_BLOG, admin: 'Equipe BlogSim' };
  const TODAY = '27/10/2026';

  // ---------- Dados de exemplo ----------
  const BLOGS = [
    { id: 'b1', name: 'Viagem com Criança', niche: 'Viagem', owner: 'Renata Alves', audience: 42000, city: 'Curitiba', uf: 'PR', color: '#0e7490', site: 'viagemcomcrianca.com.br', slots: [['lateral', 280], ['banner', 350]] },
    { id: 'b2', name: 'Cozinha da Vó Nena', niche: 'Culinária', owner: 'Nena Prado', audience: 18500, city: 'Belo Horizonte', uf: 'MG', color: '#b45309', site: 'cozinhadavonena.com.br', slots: [['popup', 190], ['inline', 160]] },
    { id: 'b3', name: 'Treino em Casa', niche: 'Fitness', owner: 'Diego Moura', audience: 61000, city: 'São Paulo', uf: 'SP', color: '#be123c', site: 'treinoemcasa.com.br', slots: [['inline', 420], ['lateral', 300]] },
    { id: 'b4', name: 'Grana no Bolso', niche: 'Finanças', owner: 'Paula Reis', audience: 73000, city: 'Rio de Janeiro', uf: 'RJ', color: '#15803d', site: 'granonobolso.com.br', slots: [['banner', 520], ['popup', 460]] },
    { id: 'b5', name: 'Pet Feliz', niche: 'Pets', owner: 'Caio Lima', audience: 27500, city: 'Porto Alegre', uf: 'RS', color: '#6d28d9', site: 'petfeliz.com.br', slots: [['lateral', 210]] },
    { id: 'b6', name: 'Código Simples', niche: 'Tecnologia', owner: 'Bruno Sato', audience: 39000, city: 'Florianópolis', uf: 'SC', color: '#1e293b', site: 'codigosimples.com.br', slots: [['inline', 330], ['banner', 380]] },
    { id: 'b7', name: 'Mãe de Primeira', niche: 'Maternidade', owner: 'Júlia Campos', audience: 55000, city: 'São Paulo', uf: 'SP', color: '#be185d', site: 'maedeprimeira.com.br', slots: [['popup', 390], ['lateral', 260]] },
    { id: 'b8', name: 'Bike Urbana', niche: 'Esportes', owner: 'Léo Martins', audience: 15800, city: 'Recife', uf: 'PE', color: '#0369a1', site: 'bikeurbana.com.br', slots: [['lateral', 150]], status: 'pendente' }
  ];
  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const initials = name => name.split(/\s+/).filter(w => w.length > 2 || /^[A-ZÁ-Ú]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const place = b => b.city ? b.city + ', ' + b.uf : b.uf || '';
  // Marca do blog: a logo enviada pelo blogueiro ou, sem logo, as iniciais na cor do blog.
  const logoOf = b => b.logo || { text: initials(b.name), color: b.color || '#585e7e' };
  function BlogLogo({ blog, size }) {
    const l = logoOf(blog);
    return typeof l === 'string'
      ? h('img', { className: 'blog-logo' + (size === 'lg' ? ' is-lg' : ''), src: l, alt: 'Logo do ' + blog.name })
      : h('span', { className: 'blog-logo' + (size === 'lg' ? ' is-lg' : ''), style: { background: l.color }, 'aria-hidden': true }, l.text);
  }  const SLOTS = BLOGS.flatMap(b => b.slots.map(([p, price]) => ({ id: b.id + '-' + p, blogId: b.id, blog: b.name, niche: b.niche, audience: b.audience, city: b.city, uf: b.uf, color: b.color, name: b.name, placement: p, price })));
  const NICHES = [...new Set(BLOGS.map(b => b.niche))];

  const CAMPAIGN_BLOGS = {
    c1: ['Treino em Casa', 'Grana no Bolso', 'Código Simples', 'Mãe de Primeira', 'Viagem com Criança', 'Pet Feliz'],
    c2: ['Mãe de Primeira', 'Grana no Bolso', 'Viagem com Criança', 'Treino em Casa'],
    c3: ['Viagem com Criança', 'Cozinha da Vó Nena', 'Treino em Casa', 'Grana no Bolso', 'Pet Feliz', 'Código Simples', 'Mãe de Primeira'],
    c4: ['Viagem com Criança', 'Mãe de Primeira', 'Treino em Casa'],
    c5: ['Mãe de Primeira', 'Viagem com Criança'],
    c6: ['Pet Feliz', 'Cozinha da Vó Nena', 'Mãe de Primeira'],
    c7: ['Grana no Bolso', 'Código Simples']
  };
  const INITIAL_CAMPAIGNS = [
    { id: 'c1', name: 'Black Friday – Tênis', advertiser: ME, objective: 'vendas', status: 'ativa', invested: 2400, clicks: 5320, results: 86, blogs: 6 },
    { id: 'c2', name: 'Consulta grátis', advertiser: 'Clínica Sorriso Leve', objective: 'conversas', status: 'ativa', invested: 980, clicks: 2140, results: 312, blogs: 4 },
    { id: 'c3', name: 'Lançamento do site', advertiser: ME, objective: 'visitas', status: 'pausada', invested: 1440, clicks: 10970, results: 9870, blogs: 9 },
    { id: 'c4', name: 'Cupom de inverno', advertiser: ME, objective: 'vendas', status: 'revisao', invested: 760, clicks: 0, results: 0, blogs: 3 },
    { id: 'c5', name: 'Matrícula 2027', advertiser: 'Escola Pequeno Mundo', objective: 'conversas', status: 'revisao', invested: 520, clicks: 0, results: 0, blogs: 2 },
    { id: 'c6', name: 'Ração premium', advertiser: 'PetShop Bom Pelo', objective: 'vendas', status: 'ativa', invested: 1760, clicks: 3980, results: 121, blogs: 3 },
    { id: 'c7', name: 'Atendimento pelo WhatsApp', advertiser: ME, objective: 'conversas', status: 'ativa', invested: 640, clicks: 1890, results: 204, blogs: 2 }
  ].map(c => ({ ...c, blogNames: CAMPAIGN_BLOGS[c.id], blogs: CAMPAIGN_BLOGS[c.id].length, views: Math.round(c.clicks * 34.5) }));
  const INITIAL_TXNS = [
    { date: '25/10/2026', desc: 'Recarga via Pix', value: 1000 },
    { date: '21/10/2026', desc: 'Cupom de inverno · 3 espaços', value: -760 },
    { date: '14/10/2026', desc: 'Atendimento pelo WhatsApp · 2 espaços', value: -640 },
    { date: '02/10/2026', desc: 'Recarga via cartão', value: 2500 }
  ];
  const INITIAL_MY_SLOTS = [
    { id: 'm1', placement: 'lateral', price: 280, active: true, rent: { adv: ME, until: '03/11/2026' } },
    { id: 'm2', placement: 'banner', price: 350, active: true, rent: { adv: 'Clínica Sorriso Leve', until: '10/11/2026' } },
    { id: 'm3', placement: 'inline', price: 220, active: false, rent: null }
  ];
  const INITIAL_PAYOUTS = [
    { id: 'r1', blog: 'Treino em Casa', value: 1980, date: '25/10/2026', status: 'pendente' },
    { id: 'r2', blog: 'Grana no Bolso', value: 2640, date: '24/10/2026', status: 'pendente' },
    { id: 'r3', blog: MY_BLOG, value: 1210, date: '10/10/2026', status: 'pago' },
    { id: 'r4', blog: 'Mãe de Primeira', value: 1730, date: '08/10/2026', status: 'pago' }
  ];
  const POSTS = [
    ['Roteiro de 5 dias em Gramado com crianças', 18400, 612],
    ['O que levar na mala do bebê', 15100, 498],
    ['Disney com orçamento curto', 11200, 455],
    ['Hotéis-fazenda perto de São Paulo', 12900, 377],
    ['Praias calmas no Nordeste', 9600, 241]
  ];

  const DATES = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(2026, 9, 27 - 13 + i);
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  });
  const series = (base, amp, seed, trend) => DATES.map((label, i) => ({
    label, value: Math.max(0, Math.round(base * (1 + trend * i / 13) + amp * Math.sin(i * 1.7 + seed) + amp * 0.5 * Math.cos(i * 0.9 + seed * 2)))
  }));
  const DAILY = {
    clicks: series(1150, 180, 1, 0.45),
    revenue: series(130, 28, 2, 0.35),
    volume: series(420, 90, 3, 0.4)
  };
  const spark = s => s.map(d => d.value);

  // ---------- Peças de layout ----------
  function Page({ title, subtitle, action, children }) {
    return h(React.Fragment, null,
      h('header', { className: 'app-head' },
        h('div', null, h('h1', null, title), subtitle ? h('p', null, subtitle) : null),
        action ? h('div', { className: 'app-head-actions' }, action) : null),
      children);
  }
  function Card({ title, extra, children }) {
    return h('section', { className: 'app-card' },
      (title || extra) ? h('div', { className: 'app-card-head' }, title ? h('h2', null, title) : h('span'), extra) : null,
      children);
  }
  function Section({ title, extra, children }) {
    return h('section', { className: 'app-section' }, h('div', { className: 'app-section-head' }, h('h2', null, title), extra), children);
  }
  function Chips({ label, options, value, onChange }) {
    return h('div', { className: 'app-chips', role: 'group', 'aria-label': label },
      h('span', { className: 'app-chips-label' }, label),
      h('div', { className: 'app-chips-row' }, options.map(([v, text]) =>
        h('button', { key: v, type: 'button', className: 'app-chip', 'aria-pressed': v === value, onClick: () => onChange(v) }, text))));
  }
  function Code({ label, text, notify }) {
    const id = 'code-' + label.replace(/\W+/g, '-').toLowerCase();
    function copy() {
      const fallback = () => {
        const el = document.getElementById(id);
        const r = document.createRange(); r.selectNodeContents(el);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        notify('Texto selecionado. Use Ctrl+C para copiar.');
      };
      try { navigator.clipboard.writeText(text).then(() => notify('Copiado'), fallback); } catch (e) { fallback(); }
    }
    return h('div', { className: 'app-section' },
      h('span', { className: 'app-code-label' }, label),
      h('div', { className: 'app-code' }, h('pre', { id }, text), h(B.Button, { variant: 'secondary', size: 'sm', onClick: copy }, 'Copiar')));
  }
  function Table({ cols, rows, empty }) {
    return h('div', { className: 'bs-table-wrap' },
      h('table', { className: 'bs-table' },
        h('thead', null, h('tr', null, cols.map((c, i) => h('th', { key: i, scope: 'col', className: c.num ? 'num' : undefined }, c.label)))),
        h('tbody', null, rows.length ? rows.map((r, i) => h('tr', { key: i }, r.map((cell, j) => h('td', { key: j, className: cols[j].num ? 'num' : undefined }, cell))))
          : h('tr', null, h('td', { colSpan: cols.length, className: 'bs-table-empty' }, empty)))));
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function BarChart({ data, isMoney, label }) {
    const ref = React.useRef(null);
    const [W, setW] = useState(640);
    React.useLayoutEffect(() => {
      const el = ref.current; if (!el) return;
      const measure = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
      measure();
      if (!window.ResizeObserver) return;
      const ro = new ResizeObserver(measure); ro.observe(el);
      return () => ro.disconnect();
    }, []);
    const H = 190, L = 56, R = 8, T = 24, Bm = 28;
    const max = niceMax(Math.max(...data.map(d => d.value)));
    const iw = W - L - R, ih = H - T - Bm, bw = iw / data.length;
    const short = v => (isMoney ? 'R$ ' : '') + COMPACT.format(v);
    const last = data.length - 1;
    return h('div', { ref, className: 'app-chart-box' }, h('svg', { className: 'app-chart', width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label },
      [0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = T + ih - t * ih;
        return h('g', { key: t }, h('line', { className: 'grid', x1: L, x2: W - R, y1: y, y2: y }), h('text', { x: L - 8, y: y + 4, textAnchor: 'end' }, short(t * max)));
      }),
      data.map((d, i) => {
        const bh = d.value / max * ih, x = L + i * bw + bw * 0.18, cx = x + bw * 0.32;
        return h('g', { key: i },
          h('rect', { className: i === last ? 'bar last' : 'bar', x, y: T + ih - bh, width: bw * 0.64, height: bh, rx: 3 }),
          i === last ? h('text', { className: 'val', x: cx, y: T + ih - bh - 6, textAnchor: 'middle' }, isMoney ? money(d.value) : count(d.value)) : null,
          (last - i) % 2 === 0 ? h('text', { x: cx, y: H - 8, textAnchor: 'middle' }, d.label) : null);
      })));
  }
  // ---------- Anunciante ----------
  function AdvPainel({ campaigns, go }) {
    const mine = campaigns.filter(c => c.advertiser === ME);
    const inv = sum(mine, 'invested'), clk = sum(mine, 'clicks'), res = sum(mine, 'results'), views = sum(mine, 'views');
    return h(Page, { title: 'Painel', subtitle: 'Últimos 14 dias · ' + ME, action: h(B.Button, { onClick: () => go('Criar campanha') }, 'Criar campanha') },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Investido', value: inv, format: 'money', delta: 12.4, hint: 'vs. 14 dias anteriores', spark: [3100, 3300, 3250, 3600, 3900, 4400, inv] }),
        h(B.MetricCard, { label: 'Cliques', value: clk, format: 'count', delta: 8.1, hint: 'vs. 14 dias anteriores', spark: spark(DAILY.clicks) }),
        h(B.MetricCard, { label: 'Visualizações', value: views, format: 'count', delta: 9.8, hint: 'vezes que seus anúncios apareceram' }),
        h(B.MetricCard, { label: 'Resultados', value: res, format: 'count', hint: (res ? money(inv / res) : 'R$ 0,00') + ' por resultado' })),
      h(Card, { title: 'Cliques por dia' }, h(BarChart, { data: DAILY.clicks, label: 'Cliques por dia nos últimos 14 dias' })),
      h(Section, { title: 'Campanhas ativas', extra: h(B.Button, { variant: 'ghost', size: 'sm', onClick: () => go('Campanhas') }, 'Ver todas') },
        h(B.CampaignTable, { rows: mine.filter(c => c.status === 'ativa') })));
  }

  function AdvCampanhas({ campaigns, go }) {
    const [f, setF] = useState('todas');
    const mine = campaigns.filter(c => c.advertiser === ME);
    const rows = f === 'todas' ? mine : mine.filter(c => c.status === f);
    return h(Page, { title: 'Campanhas', subtitle: mine.length + ' campanhas', action: h(B.Button, { onClick: () => go('Criar campanha') }, 'Criar campanha') },
      h(Chips, { label: 'Status', value: f, onChange: setF, options: [['todas', 'Todas'], ['ativa', 'Ativas'], ['pausada', 'Pausadas'], ['revisao', 'Em revisão'], ['encerrada', 'Encerradas']] }),
      h(B.CampaignTable, { rows, emptyText: 'Nenhuma campanha com esse status.' }));
  }

  function activeSlots(blogs) {
    const ok = new Set(blogs.filter(b => b.status === 'ativo').map(b => b.id));
    return SLOTS.filter(s => ok.has(s.blogId));
  }

  function SlotGrid({ list, cart, setCart, blogs }) {
    const byId = Object.fromEntries((blogs || BLOGS).map(b => [b.id, b]));
    const toggle = (id, on) => setCart(c => on ? [...c, id] : c.filter(x => x !== id));
    if (!list.length) return h('p', { className: 'app-empty' }, 'Nenhum blog encontrado. Tente outro nicho ou limpe a busca.');
    return h('div', { className: 'app-slots' }, list.map(s => h(B.SlotCard, {
      key: s.id, blog: s.blog, niche: s.niche, placement: s.placement, audience: s.audience, price: s.price,
      logo: logoOf(byId[s.blogId] || s), location: place(byId[s.blogId] || s),
      selected: cart.includes(s.id), onToggle: on => toggle(s.id, on)
    })));
  }

  function AdvExplorar({ cart, setCart, go, blogs }) {
    const [q, setQ] = useState('');
    const [n, setN] = useState('Todos');
    const [uf, setUf] = useState('');
    const [city, setCity] = useState('');
    const byId = Object.fromEntries(blogs.map(b => [b.id, b]));
    const ufs = [...new Set(blogs.filter(b => b.status === 'ativo').map(b => b.uf))].sort();
    const cities = [...new Set(blogs.filter(b => b.status === 'ativo' && (!uf || b.uf === uf)).map(b => b.city))].sort();
    const list = activeSlots(blogs).filter(s => {
      const b = byId[s.blogId] || s;
      return (n === 'Todos' || b.niche === n) && (!uf || b.uf === uf) && (!city || b.city === city) && b.name.toLowerCase().includes(q.trim().toLowerCase());
    });
    const sel = SLOTS.filter(s => cart.includes(s.id));
    return h(Page, { title: 'Explorar blogs', subtitle: 'Escolha por nicho e por região onde seu anúncio aparece. Preços por semana.' },
      h('div', { className: 'app-filters' },
        h(B.TextField, { id: 'busca-blog', label: 'Buscar blog', placeholder: 'Nome do blog', value: q, onChange: e => setQ(e.target.value) }),
        h('div', { className: 'bs-field app-select-field' },
          h('label', { className: 'bs-field-label', htmlFor: 'filtro-estado' }, 'Estado'),
          h('select', { id: 'filtro-estado', className: 'app-select', value: uf, onChange: e => { setUf(e.target.value); setCity(''); } },
            h('option', { value: '' }, 'Todos os estados'), ufs.map(x => h('option', { key: x, value: x }, x)))),
        h('div', { className: 'bs-field app-select-field' },
          h('label', { className: 'bs-field-label', htmlFor: 'filtro-cidade' }, 'Cidade'),
          h('select', { id: 'filtro-cidade', className: 'app-select', value: city, onChange: e => setCity(e.target.value) },
            h('option', { value: '' }, 'Todas as cidades'), cities.map(x => h('option', { key: x, value: x }, x))))),
      h(Chips, { label: 'Nicho', value: n, onChange: setN, options: ['Todos', ...NICHES].map(x => [x, x]) }),
      h(SlotGrid, { list, cart, setCart, blogs }),
      sel.length ? h('div', { className: 'app-cartbar' },
        h('span', null, h('b', null, sel.length + (sel.length > 1 ? ' espaços selecionados' : ' espaço selecionado')), ' · ', h('span', { className: 'app-money' }, money(sum(sel, 'price'))), ' por semana'),
        h(B.Button, { onClick: () => go('Criar campanha') }, 'Criar campanha com esses espaços')) : null);
  }

  const TRACK = {
    visitas: { label: 'Endereço do seu site', ph: 'https://www.seusite.com.br', hint: 'Instale o pixel em todas as páginas do site.', codeLabel: 'Seu Pixel BlogSim', code: '<script async src="https://px.blogsim.com.br/p.js" data-conta="BS-48213"></' + 'script>' },
    conversas: { label: 'Número do WhatsApp', ph: '+55 11 90000-0000', hint: 'O leitor passa pelo nosso link antes de abrir o WhatsApp. É assim que contamos as conversas.', codeLabel: 'Seu link redirecionador', code: 'https://wa.blogsim.com.br/r/BS-48213' },
    vendas: { label: 'Endereço da página de checkout', ph: 'https://www.seusite.com.br/checkout', hint: 'Instale o pixel na página de confirmação do pedido.', codeLabel: 'Seu pixel de checkout', code: '<script async src="https://px.blogsim.com.br/p.js" data-conta="BS-48213" data-evento="venda"></' + 'script>' }
  };
  const CTA = { visitas: 'Saiba mais', conversas: 'Chamar no WhatsApp', vendas: 'Comprar agora' };
  const BLOG_POST = {
    'Viagem com Criança': 'Roteiro de 5 dias em Gramado com crianças',
    'Cozinha da Vó Nena': 'Bolo de fubá cremoso da vó',
    'Treino em Casa': 'Treino de 20 minutos sem equipamento',
    'Grana no Bolso': 'Como montar uma reserva de emergência',
    'Pet Feliz': 'Quantas vezes por dia o cachorro deve comer',
    'Código Simples': 'Git para quem está começando',
    'Mãe de Primeira': 'O que ninguém conta sobre o primeiro mês',
    'Bike Urbana': 'Rotas seguras para pedalar na cidade'
  };
  const domain = name => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '') + '.com.br';

  function AdCard({ ad, vertical }) {
    return h('div', { className: 'pv-ad' + (vertical ? ' is-vertical' : '') + (ad.empty ? ' is-empty' : '') },
      ad.img ? h('img', { className: 'pv-ad-img', src: ad.img, alt: '' }) : h('div', { className: 'pv-ad-img' }, ad.empty ? 'Livre' : (ad.imgLabel || 'Imagem')),
      h('div', { className: 'pv-ad-body' },
        h('span', { className: 'pv-ad-tag' }, ad.empty ? 'Espaço BlogSim' : 'Patrocinado'),
        h('b', { className: 'pv-ad-title' }, ad.title || 'Título do anúncio'),
        h('span', { className: 'pv-ad-text' }, ad.text || 'O texto do anúncio aparece aqui.'),
        ad.cta ? h('span', { className: 'pv-ad-cta' }, ad.cta) : null));
  }

  // Página de blog fictícia, só para mostrar onde o anúncio aparece para o leitor.
  function BlogPreview({ blog, placement, ad }) {
    const slot = p => placement === p ? h(AdCard, { ad, vertical: p === 'lateral' || p === 'popup' }) : null;
    const lines = n => Array.from({ length: n }, (_, i) => h('div', { key: i, className: 'pv-line' }));
    return h('figure', { className: 'pv' },
      h('div', { className: 'pv-chrome' }, domain(blog)),
      h('div', { className: 'pv-page' },
        h('div', { className: 'pv-head' }, h('b', null, blog), h('span', null, 'Início · Sobre · Contato')),
        slot('banner'),
        h('div', { className: 'pv-body' },
          h('div', { className: 'pv-post' }, h('div', { className: 'pv-title' }, BLOG_POST[blog] || 'Post mais lido da semana'), lines(4), slot('inline'), lines(3)),
          h('div', { className: 'pv-side' }, slot('lateral'), h('div', { className: 'pv-side-box' }), h('div', { className: 'pv-side-box' }))),
        placement === 'popup' ? h('div', { className: 'pv-overlay' }, h('div', { className: 'pv-pop' }, h('span', { className: 'pv-close', 'aria-hidden': true }, '×'), slot('popup'))) : null),
      h('figcaption', { className: 'pv-caption' }, 'Como o leitor vê o anúncio em ', h('b', null, PLACE[placement]), '. Página de exemplo.'));
  }

  const STEPS = ['Objetivo', 'Blogs e espaços', 'Anúncio', 'Duração e nome', 'Rastreamento', 'Revisar'];

  function CreateCampaign({ cart, setCart, balance, onPublish, go, notify, blogs }) {
    const [step, setStep] = useState(0);
    const [obj, setObj] = useState('visitas');
    const [niche, setNiche] = useState('Todos');
    const [name, setName] = useState('');
    const [weeks, setWeeks] = useState('2');
    const [track, setTrack] = useState('');
    const [adTitle, setAdTitle] = useState('');
    const [adText, setAdText] = useState('');
    const [adImg, setAdImg] = useState(null);
    const [imgErr, setImgErr] = useState('');
    const [pv, setPv] = useState(null);
    const [tried, setTried] = useState(false);
    const [err, setErr] = useState('');
    const sel = SLOTS.filter(s => cart.includes(s.id));
    const weekly = sum(sel, 'price'), w = parseInt(weeks, 10) || 0, total = weekly * w;
    const reach = Math.round(sum(sel, 'audience') / 4.3 * w);
    const weeksOk = w >= 1 && w <= 12;
    const adOk = adTitle.trim().length > 0 && track.trim().length > 3;
    const valid = [true, sel.length > 0, adOk, name.trim().length > 0 && weeksOk, true, true][step];
    const t = TRACK[obj];
    const ad = { img: adImg, title: adTitle.trim(), text: adText.trim(), cta: CTA[obj] };
    const pvSlot = sel.find(s => s.id === pv) || sel[0];
    const bodyRef = React.useRef(null), prevStep = React.useRef(step);
    React.useLayoutEffect(() => {
      const g = window.gsap, dir = Math.sign(step - prevStep.current);
      prevStep.current = step;
      if (!g || !dir || !bodyRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const a = g.fromTo(bodyRef.current, { x: 28 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: .45, ease: 'power3.out', clearProps: 'transform,opacity' });
      const b = g.from(document.querySelectorAll('.app-steps .is-current span'), { scale: .5, duration: .45, ease: 'back.out(3)' });
      return () => { a.kill(); b.kill(); };
    }, [step]);

    function next() { if (!valid) { setTried(true); return; } setTried(false); setStep(step + 1); }
    function back() { setTried(false); setErr(''); setStep(step - 1); }
    function publish() {
      if (total > balance) { setErr(`Seu saldo é ${money(balance)}. Adicione ${money(total - balance)} em Faturamento para publicar.`); return; }
      onPublish({ name: name.trim(), objective: obj, total, blogs: new Set(sel.map(s => s.blogId)).size, blogNames: [...new Set(sel.map(s => s.blog))], slots: sel.length });
      setCart([]);
    }
    function onFile(e) {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      if (!f.type.startsWith('image/')) { setImgErr('Escolha um arquivo de imagem (JPG, PNG ou WebP).'); return; }
      if (f.size > 2 * 1024 * 1024) { setImgErr('A imagem tem mais de 2 MB. Escolha uma menor.'); return; }
      setImgErr('');
      const r = new FileReader();
      r.onload = () => setAdImg(r.result);
      r.readAsDataURL(f);
    }

    let body;
    if (step === 0) body = h(B.ObjectivePicker, { value: obj, onChange: v => { setObj(v); setTrack(''); } });
    if (step === 1) body = h(React.Fragment, null,
      h(Chips, { label: 'Nicho', value: niche, onChange: setNiche, options: ['Todos', ...NICHES].map(x => [x, x]) }),
      h(SlotGrid, { list: activeSlots(blogs).filter(s => niche === 'Todos' || s.niche === niche), cart, setCart, blogs }),
      h('p', { className: 'app-note' }, sel.length ? `${sel.length} ${sel.length > 1 ? 'espaços' : 'espaço'} · ${money(weekly)} por semana` : 'Nenhum espaço selecionado ainda.'),
      tried && !sel.length ? h('p', { className: 'app-error', role: 'alert' }, 'Escolha pelo menos um espaço para continuar.') : null);
    if (step === 2) body = h('div', { className: 'app-adstep' },
      h('div', { className: 'app-adform' },
        h('div', { className: 'bs-field' },
          h('label', { className: 'bs-field-label', htmlFor: 'ad-img' }, 'Imagem'),
          h('input', { id: 'ad-img', type: 'file', accept: 'image/*', className: 'app-file', onChange: onFile, 'aria-describedby': 'ad-img-hint' }),
          h('div', { id: 'ad-img-hint', className: imgErr ? 'app-error' : 'bs-field-hint' }, imgErr || 'JPG, PNG ou WebP até 2 MB. Imagem horizontal funciona melhor.')),
        h(B.TextField, { id: 'ad-titulo', label: 'Título', maxLength: 40, placeholder: 'Ex.: Tênis de corrida com 30% off', value: adTitle, onChange: e => setAdTitle(e.target.value), error: tried && !adTitle.trim() ? 'Escreva um título para o anúncio.' : undefined, hint: adTitle.length + '/40 caracteres' }),
        h(B.TextField, { id: 'ad-texto', label: 'Texto', maxLength: 90, placeholder: 'Ex.: Frete grátis para todo o Brasil até domingo.', value: adText, onChange: e => setAdText(e.target.value), hint: adText.length + '/90 caracteres · opcional' }),
        h(B.TextField, { id: 'camp-track-' + obj, label: t.label, placeholder: t.ph, value: track, onChange: e => setTrack(e.target.value), error: tried && track.trim().length <= 3 ? 'Diga para onde o leitor vai ao clicar no anúncio.' : undefined, hint: 'Para onde o leitor vai ao clicar em "' + CTA[obj] + '".' })),
      h('div', { className: 'app-adpreview' },
        sel.length > 1 ? h(Chips, { label: 'Ver prévia em', value: pvSlot.id, onChange: setPv, options: sel.map(s => [s.id, s.blog + ' · ' + PLACE[s.placement]]) }) : null,
        h(BlogPreview, { blog: pvSlot.blog, placement: pvSlot.placement, ad })));
    if (step === 3) body = h(React.Fragment, null,
      h('div', { className: 'app-fields' },
        h(B.TextField, { id: 'camp-nome', label: 'Nome da campanha', placeholder: 'Ex.: Black Friday – Tênis', value: name, onChange: e => setName(e.target.value), error: tried && !name.trim() ? 'Dê um nome à campanha para encontrá-la depois.' : undefined, hint: 'Só você e o admin veem esse nome.' }),
        h(B.TextField, { id: 'camp-semanas', label: 'Duração', type: 'number', min: 1, max: 12, inputMode: 'numeric', suffix: 'semanas', value: weeks, onChange: e => setWeeks(e.target.value), error: tried && !weeksOk ? 'Escolha de 1 a 12 semanas.' : undefined, hint: 'Começa depois da aprovação.' })),
      h('dl', { className: 'app-dl' },
        h('dt', null, 'Espaços'), h('dd', null, sel.length),
        h('dt', null, 'Custo por semana'), h('dd', { className: 'money' }, money(weekly)),
        h('dt', null, 'Total da campanha'), h('dd', { className: 'money' }, money(total)),
        h('dt', null, 'Alcance estimado'), h('dd', null, '~' + count(reach) + ' leitores')));
    if (step === 4) body = h(React.Fragment, null,
      h('p', null, 'Objetivo: ', h('b', null, OBJ_LABEL[obj]), '. ' + t.hint),
      h('dl', { className: 'app-dl' }, h('dt', null, t.label), h('dd', null, track)),
      h(Code, { label: t.codeLabel, text: t.code, notify }));
    if (step === 5) body = h(React.Fragment, null,
      h('dl', { className: 'app-dl' },
        h('dt', null, 'Campanha'), h('dd', null, name),
        h('dt', null, 'Objetivo'), h('dd', null, h(B.Badge, { tone: OBJ_TONE[obj] }, OBJ_LABEL[obj])),
        h('dt', null, 'Anúncio'), h('dd', null, ad.title + (adImg ? ' · com imagem' : ' · sem imagem')),
        h('dt', null, 'Espaços'), h('dd', null, sel.map(s => s.blog + ' (' + PLACE[s.placement] + ')').join(', ')),
        h('dt', null, 'Duração'), h('dd', null, w + (w > 1 ? ' semanas' : ' semana')),
        h('dt', null, t.label), h('dd', null, track),
        h('dt', null, 'Total'), h('dd', { className: 'money' }, money(total)),
        h('dt', null, 'Saldo atual'), h('dd', null, money(balance))),
      h('p', { className: 'app-note' }, 'A campanha passa por revisão do BlogSim antes de entrar no ar. O valor sai do seu saldo agora e volta se ela for recusada.'),
      err ? h('div', { className: 'app-actions' }, h('p', { className: 'app-error', role: 'alert' }, err), h(B.Button, { variant: 'secondary', size: 'sm', onClick: () => go('Faturamento') }, 'Ir para Faturamento')) : null);

    return h(Page, { title: 'Criar campanha', subtitle: `Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`, action: h(B.Button, { variant: 'ghost', onClick: () => go('Campanhas') }, 'Cancelar') },
      h('ol', { className: 'app-steps', 'aria-label': 'Passos' }, STEPS.map((s, i) =>
        h('li', { key: s, className: i < step ? 'is-done' : i === step ? 'is-current' : undefined, 'aria-current': i === step ? 'step' : undefined }, h('span', null, i + 1), s))),
      h(Card, null, h('div', { className: 'app-step-body', key: step, ref: bodyRef }, body),
        h('div', { className: 'app-wizard-foot' },
          step > 0 ? h(B.Button, { variant: 'secondary', onClick: back }, 'Voltar') : h('span'),
          step < STEPS.length - 1 ? h(B.Button, { onClick: next }, 'Continuar') : h(B.Button, { variant: 'accent', onClick: publish }, `Pagar ${money(total)} e publicar`))));
  }
  function AdvPixel({ notify }) {
    return h(Page, { title: 'Pixel e rastreamento', subtitle: 'Como o BlogSim mede os resultados das suas campanhas.' },
      h('div', { className: 'app-cols' },
        h(Card, { title: 'Pixel BlogSim', extra: h(B.Badge, { tone: 'success', dot: true }, 'Detectado') },
          h('p', null, 'Mede as visitas no seu site. Instalado em passocerto.com.br, último sinal há 4 minutos.'),
          h(Code, { label: 'Código do pixel', text: TRACK.visitas.code, notify })),
        h(Card, { title: 'Link redirecionador', extra: h(B.Badge, { tone: 'success', dot: true }, 'Ativo') },
          h('p', null, 'Conta cada conversa no WhatsApp iniciada a partir de um anúncio. 204 conversas nos últimos 14 dias.'),
          h(Code, { label: 'Seu link', text: TRACK.conversas.code, notify })),
        h(Card, { title: 'Pixel no checkout', extra: h(B.Badge, { tone: 'warning', dot: true }, 'Aguardando instalação') },
          h('p', null, 'Mede as vendas. Instale na página de confirmação do pedido.'),
          h(Code, { label: 'Código do checkout', text: TRACK.vendas.code, notify }),
          h('div', null, h(B.Button, { variant: 'secondary', size: 'sm', onClick: () => notify('Ainda não encontramos o pixel no checkout. A verificação pode levar até 10 minutos.') }, 'Verificar instalação')))));
  }

  function AdvBilling({ balance, txns, onAdd, campaigns, billing }) {
    const [amt, setAmt] = useState('250');
    const [method, setMethod] = useState('pix');
    const [parcelas, setParcelas] = useState('1');
    const spent = sum(campaigns.filter(c => c.advertiser === ME), 'invested');
    const value = Number(String(amt).replace(/\./g, '').replace(',', '.')) || 0;
    const tooLow = value < billing.min;
    const canSplit = method === 'cartao' && value >= billing.installFrom;
    const n = canSplit ? parseInt(parcelas, 10) || 1 : 1;
    const presets = [100, 250, 500, 1000].filter(v => v >= billing.min);
    return h(Page, { title: 'Faturamento', subtitle: 'Saldo pré-pago usado para alugar espaços.' },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Saldo disponível', value: balance, format: 'money', hint: 'usado ao publicar campanhas' }),
        h(B.MetricCard, { label: 'Investido em campanhas', value: spent, format: 'money', hint: 'desde o início' })),
      h(Card, { title: 'Adicionar saldo' },
        h(Chips, { label: 'Valor', value: presets.includes(value) ? String(value) : '', onChange: setAmt, options: presets.map(v => [String(v), money(v).replace(',00', '')]) }),
        h('div', { className: 'app-fields' },
          h(B.TextField, { id: 'recarga-valor', label: 'Ou digite o valor', prefix: 'R$', inputMode: 'decimal', value: amt, onChange: e => setAmt(e.target.value), error: tooLow ? `A recarga mínima é de ${money(billing.min)}.` : undefined, hint: `Mínimo de ${money(billing.min)}.` })),
        h(Chips, { label: 'Forma de pagamento', value: method, onChange: setMethod, options: [['pix', 'Pix'], ['cartao', 'Cartão de crédito']] }),
        method === 'cartao' ? (canSplit
          ? h('div', { className: 'bs-field app-select-field' },
              h('label', { className: 'bs-field-label', htmlFor: 'recarga-parcelas' }, 'Parcelas'),
              h('select', { id: 'recarga-parcelas', className: 'app-select', value: String(n), onChange: e => setParcelas(e.target.value) },
                Array.from({ length: billing.maxInstallments }, (_, i) => i + 1).map(k => h('option', { key: k, value: String(k) }, k === 1 ? `À vista · ${money(value)}` : `${k}x de ${money(value / k)}`))))
          : h('p', { className: 'app-note' }, `Parcelamento no cartão a partir de ${money(billing.installFrom)}.`)) : null,
        h('div', null, h(B.Button, { variant: 'accent', disabled: tooLow, onClick: () => onAdd(value, method, n) }, `Adicionar ${money(value)}` + (n > 1 ? ` em ${n}x` : '')))),
      h(Section, { title: 'Movimentações' },
        h(Table, { cols: [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Valor', num: true }], empty: 'Nenhuma movimentação.',
          rows: txns.map(t => [t.date, t.desc, (t.value > 0 ? '+' : '−') + money(Math.abs(t.value))]) })));
  }
  // ---------- Blogueiro ----------
  // Lê a logo enviada pelo blogueiro como data URL.
  function readLogo(e, ok, fail) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) { fail('Escolha um arquivo de imagem (PNG, JPG, WebP ou SVG).'); return; }
    if (f.size > 1024 * 1024) { fail('A logo tem mais de 1 MB. Escolha uma menor.'); return; }
    fail('');
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.readAsDataURL(f);
  }

  function BlogPainel({ mySlots, blog, fresh }) {
    const rented = mySlots.filter(s => s.rent);
    return h(Page, { title: 'Painel', subtitle: 'Últimos 14 dias · ' + blog.name },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Receita', value: fresh ? 0 : 2184, format: 'money', delta: fresh ? undefined : 18, hint: fresh ? 'nenhum aluguel ainda' : 'vs. 14 dias anteriores', spark: fresh ? undefined : spark(DAILY.revenue) }),
        h(B.MetricCard, { label: 'Visualizações dos anúncios', value: fresh ? 0 : 96400, format: 'count', delta: fresh ? undefined : 9.5, hint: fresh ? 'medidas pelo script' : 'vs. 14 dias anteriores' }),
        h(B.MetricCard, { label: 'Cliques', value: fresh ? 0 : 2870, format: 'count', delta: fresh ? undefined : 4.2, hint: fresh ? 'medidos pelo script' : 'vs. 14 dias anteriores' }),
        h(B.MetricCard, { label: 'CTR', value: fresh ? '0%' : '2,98%', hint: 'cliques ÷ visualizações' })),
      fresh ? h('p', { className: 'app-empty' }, 'A receita por dia aparece aqui quando o primeiro anúncio entrar no seu blog. Crie seus espaços em Meus espaços para começar.')
        : h(Card, { title: 'Receita por dia' }, h(BarChart, { data: DAILY.revenue, isMoney: true, label: 'Receita por dia nos últimos 14 dias' })),
      h(Section, { title: 'Anúncios no seu blog agora' },
        h(Table, { cols: [{ label: 'Anunciante' }, { label: 'Espaço' }, { label: 'Até' }, { label: 'Valor por semana', num: true }], empty: 'Nenhum espaço alugado agora.',
          rows: rented.map(s => [s.rent.adv, PLACE[s.placement], s.rent.until, money(s.price)]) })));
  }

  function BlogMeuBlog({ blog, onSave }) {
    const [logo, setLogo] = useState(blog.logo || null);
    const [logoErr, setLogoErr] = useState('');
    const [name, setName] = useState(blog.name);
    const [site, setSite] = useState(blog.site || '');
    const [niche, setNiche] = useState(blog.niche);
    const [uf, setUf] = useState(blog.uf || '');
    const [city, setCity] = useState(blog.city || '');
    const [desc, setDesc] = useState(blog.desc || '');
    const [tried, setTried] = useState(false);
    const errs = { name: name.trim() ? '' : 'Informe o nome do blog.', site: /\S+\.\S+/.test(site) ? '' : 'Informe o endereço do blog, como seublog.com.br.', city: city.trim() ? '' : 'Informe a cidade.', uf: uf ? '' : 'Escolha o estado.' };
    const draft = { ...blog, logo, name: name.trim() || blog.name, site, niche, uf, city: city.trim() };
    function save() { setTried(true); if (Object.values(errs).some(Boolean)) return; onSave({ logo, name: name.trim(), site: site.trim(), niche, uf, city: city.trim(), desc: desc.trim() }); }
    const sel = (id, label, value, set, opts, err) => h('div', { className: 'bs-field app-select-field' + (err ? ' bs-field-error' : '') },
      h('label', { className: 'bs-field-label', htmlFor: id }, label),
      h('select', { id, className: 'app-select', value, onChange: e => set(e.target.value) }, opts),
      err ? h('div', { className: 'bs-field-hint' }, err) : null);
    return h(Page, { title: 'Meu blog', subtitle: 'A marca e as informações que os anunciantes veem em Explorar blogs.' },
      h('div', { className: 'app-split' },
        h(Card, { title: 'Marca e informações' },
          h('div', { className: 'app-logo-row' },
            h(BlogLogo, { blog: draft, size: 'lg' }),
            h('div', { className: 'bs-field' },
              h('label', { className: 'bs-field-label', htmlFor: 'blog-logo' }, 'Logo do blog'),
              h('input', { id: 'blog-logo', type: 'file', accept: 'image/*', className: 'app-file', onChange: e => readLogo(e, setLogo, setLogoErr) }),
              h('div', { className: logoErr ? 'app-error' : 'bs-field-hint' }, logoErr || 'Quadrada, até 1 MB. Sem logo, usamos as iniciais do blog.'))),
          h('div', { className: 'app-fields' },
            h(B.TextField, { id: 'blog-nome', label: 'Nome do blog', value: name, onChange: e => setName(e.target.value), error: tried && errs.name || undefined }),
            h(B.TextField, { id: 'blog-site', label: 'Endereço', placeholder: 'seublog.com.br', value: site, onChange: e => setSite(e.target.value), error: tried && errs.site || undefined }),
            sel('blog-nicho', 'Nicho', niche, setNiche, NICHES.map(x => h('option', { key: x, value: x }, x))),
            sel('blog-uf', 'Estado', uf, setUf, [h('option', { key: '', value: '' }, 'Escolha'), ...UFS.map(x => h('option', { key: x, value: x }, x))], tried && errs.uf),
            h(B.TextField, { id: 'blog-cidade', label: 'Cidade', value: city, onChange: e => setCity(e.target.value), error: tried && errs.city || undefined })),
          h('div', { className: 'bs-field' },
            h('label', { className: 'bs-field-label', htmlFor: 'blog-desc' }, 'Sobre o blog'),
            h('textarea', { id: 'blog-desc', className: 'app-textarea', rows: 3, maxLength: 240, placeholder: 'Sobre o que você escreve e para quem.', value: desc, onChange: e => setDesc(e.target.value) }),
            h('div', { className: 'bs-field-hint' }, desc.length + '/240 caracteres')),
          h('div', null, h(B.Button, { onClick: save }, 'Salvar alterações'))),
        h(Card, { title: 'Como os anunciantes veem' },
          h('div', { className: 'lp-blog' },
            h('div', { className: 'lp-blog-brand' }, h(BlogLogo, { blog: draft, size: 'lg' }), h('div', null, h('b', null, draft.name), h('span', null, site || 'seublog.com.br'))),
            h('div', { className: 'lp-blog-meta' }, h(B.Badge, null, niche), city || uf ? h('span', { className: 'lp-loc' }, place(draft)) : null),
            desc ? h('p', null, desc) : null,
            h('span', null, (blog.audience ? count(blog.audience) : '—') + ' leitores por mês')))));
  }
  function SlotEditor({ slot, onChange, notify }) {
    const [price, setPrice] = useState(String(slot.price).replace('.', ','));
    const value = Number(price.replace(/\./g, '').replace(',', '.'));
    const bad = !(value >= 50);
    const status = slot.rent ? h(B.Badge, { tone: 'accent', dot: true }, 'Alugado até ' + slot.rent.until)
      : slot.active ? h(B.Badge, { tone: 'success', dot: true }, 'Disponível') : h(B.Badge, { dot: true }, 'Pausado');
    return h(Card, { title: PLACE[slot.placement], extra: status },
      slot.rent ? h('p', null, 'Anunciante: ' + slot.rent.adv + '.') : h('p', null, slot.active ? 'Aparece para anunciantes em Explorar blogs.' : 'Não aparece para anunciantes enquanto estiver pausado.'),
      h(B.TextField, { id: 'preco-' + slot.id, label: 'Preço', prefix: 'R$', suffix: '/semana', inputMode: 'decimal', value: price, onChange: e => setPrice(e.target.value), error: bad ? 'O preço mínimo é R$ 50,00 por semana.' : undefined, hint: 'Vale para os próximos aluguéis.' }),
      h('div', { className: 'app-actions' },
        h(B.Button, { size: 'sm', disabled: bad || value === slot.price, onClick: () => { onChange({ ...slot, price: value }); notify('Preço atualizado'); } }, 'Salvar preço'),
        h(B.Button, { size: 'sm', variant: 'secondary', disabled: !!slot.rent, onClick: () => { onChange({ ...slot, active: !slot.active }); notify(slot.active ? 'Espaço pausado' : 'Espaço ativado'); } }, slot.active ? 'Pausar espaço' : 'Ativar espaço')),
      slot.rent ? h('p', { className: 'app-note' }, 'Espaços alugados só podem ser pausados depois do fim do aluguel.') : null);
  }

  const EXAMPLE_ADS = {
    [ME]: { title: 'Tênis de corrida com 30% off', text: 'Frete grátis para todo o Brasil até domingo.', cta: 'Comprar agora' },
    'Clínica Sorriso Leve': { title: 'Avaliação odontológica gratuita', text: 'Agende pelo WhatsApp no melhor horário para você.', cta: 'Chamar no WhatsApp' }
  };

  function SpacesPreview({ mySlots, blog }) {
    const [pv, setPv] = useState(mySlots[0] && mySlots[0].id);
    const cur = mySlots.find(s => s.id === pv) || mySlots[0];
    if (!cur) return null;
    const ad = cur.rent ? (EXAMPLE_ADS[cur.rent.adv] || { title: cur.rent.adv, text: '', cta: 'Saiba mais' })
      : { empty: true, title: 'Espaço disponível', text: 'Quando alguém alugar este espaço, o anúncio aparece aqui.' };
    return h(Card, { title: 'Prévia no seu blog' },
      h('p', null, 'É assim que seus leitores veem os anúncios. O script do BlogSim coloca cada anúncio no espaço alugado.'),
      h(Chips, { label: 'Espaço', value: cur.id, onChange: setPv, options: mySlots.map(s => [s.id, PLACE[s.placement] + (s.rent ? ' · alugado' : s.active ? ' · livre' : ' · pausado')]) }),
      h(BlogPreview, { blog: blog.name, placement: cur.placement, ad }));
  }

  function BlogEspacos({ mySlots, setMySlots, notify, blog }) {
    const missing = Object.keys(PLACE).filter(p => !mySlots.some(s => s.placement === p));
    const update = s => setMySlots(list => list.map(x => x.id === s.id ? s : x));
    function add(p) { setMySlots(list => [...list, { id: 'm' + Date.now(), placement: p, price: 200, active: true, rent: null }]); notify('Espaço ' + PLACE[p] + ' criado'); }
    return h(Page, { title: 'Meus espaços', subtitle: 'Onde os anúncios aparecem no ' + blog.name + ' e quanto custam.' },
      mySlots.length ? h('div', { className: 'app-cols' }, mySlots.map(s => h(SlotEditor, { key: s.id, slot: s, onChange: update, notify })))
        : h('p', { className: 'app-empty' }, 'Você ainda não tem espaços. Escolha abaixo onde os anúncios podem aparecer no seu blog.'),
      h(SpacesPreview, { mySlots, blog }),
      missing.length ? h(Card, { title: 'Adicionar espaço' },
        h('p', null, 'Cada espaço novo aparece para os anunciantes assim que você o cria.'),
        h('div', { className: 'app-actions' }, missing.map(p => h(B.Button, { key: p, variant: 'secondary', size: 'sm', onClick: () => add(p) }, 'Adicionar ' + PLACE[p])))) : null);
  }
  function BlogReceita({ bloggerBalance, onWithdraw, payouts, pct, blog, fresh }) {
    const mine = payouts.filter(p => p.blog === blog.name);
    return h(Page, { title: 'Receita', subtitle: 'O que seus espaços renderam e seus saques.' },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Saldo disponível', value: bloggerBalance, format: 'money', hint: 'pronto para saque' }),
        h(B.MetricCard, { label: 'A liberar', value: fresh ? 0 : 544, format: 'money', hint: 'aluguéis ainda em andamento' }),
        h(B.MetricCard, { label: 'Recebido em 2026', value: fresh ? 0 : 18920, format: 'money', delta: fresh ? undefined : 32, hint: fresh ? 'desde o cadastro' : 'vs. 2025' })),
      h(Card, { title: 'Sacar' },
        h('p', null, `Você recebe o valor dos aluguéis menos a comissão de ${pct}% do BlogSim. O saque cai na sua conta em até 2 dias úteis.`),
        h('div', null, h(B.Button, { variant: 'accent', disabled: bloggerBalance <= 0, onClick: onWithdraw }, bloggerBalance > 0 ? 'Solicitar saque de ' + money(bloggerBalance) : 'Sem saldo para sacar'))),
      h(Section, { title: 'Saques' },
        h(Table, { cols: [{ label: 'Solicitado em' }, { label: 'Status' }, { label: 'Valor', num: true }], empty: 'Nenhum saque ainda.',
          rows: mine.map(p => [p.date, p.status === 'pago' ? h(B.Badge, { tone: 'success', dot: true }, 'Pago') : h(B.Badge, { tone: 'warning', dot: true }, 'Em processamento'), money(p.value)]) })));
  }

  function BlogInsights({ blog, fresh }) {
    if (fresh) return h(Page, { title: 'Insights', subtitle: 'Onde seus leitores mais clicam em anúncios.' },
      h('p', { className: 'app-empty' }, 'Os insights aparecem depois das primeiras visitas medidas pelo script: posts mais lidos, cliques em anúncios e CTR.'));
    return h(Page, { title: 'Insights', subtitle: 'Onde seus leitores mais clicam em anúncios.' },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Leitores por mês', value: blog.audience, format: 'count', delta: 6.3, hint: 'vs. mês anterior' }),
        h(B.MetricCard, { label: 'Espaço mais alugado', value: 'Lateral', hint: '9 de 10 semanas alugado' }),
        h(B.MetricCard, { label: 'Nicho', value: blog.niche, hint: '14 anunciantes buscaram este mês' })),
      h(Section, { title: 'Posts com mais cliques em anúncios' },
        h(Table, { cols: [{ label: 'Post' }, { label: 'Visualizações', num: true }, { label: 'Cliques', num: true }, { label: 'CTR', num: true }], empty: '',
          rows: POSTS.map(([t, v, c]) => [t, count(v), count(c), (c / v * 100).toFixed(2).replace('.', ',') + '%']) })));
  }

  function BlogScript({ notify, blog, verified, onVerify }) {
    const [checking, setChecking] = useState(false);
    function verify() {
      if (verified) { notify('Script encontrado. Seus espaços estão no ar.'); return; }
      setChecking(true);
      setTimeout(() => { setChecking(false); onVerify(); }, 900);
    }
    return h(Page, { title: 'Instalar script', subtitle: 'Instale este código no seu blog para os anúncios aparecerem nos espaços alugados.' },
      verified ? null : h('div', { className: 'app-gate' },
        h('b', null, 'Falta um passo para liberar seu painel'),
        h('p', null, 'Instale o script no ' + (blog.site || 'seu blog') + ' e clique em Verificar instalação. Depois disso você cria seus espaços, acompanha a receita e pede saques.')),
      h(Card, { title: 'Script do BlogSim', extra: verified ? h(B.Badge, { tone: 'success', dot: true }, 'Detectado em ' + (blog.site || 'seu blog')) : h(B.Badge, { tone: 'warning', dot: true }, 'Ainda não instalado') },
        h('ol', { className: 'app-ol' },
          h('li', null, 'Copie o código abaixo.'),
          h('li', null, 'Cole no cabeçalho do seu blog, antes do fechamento da tag head. No WordPress, use um plugin de cabeçalho.'),
          h('li', null, 'Clique em Verificar instalação.')),
        h(Code, { label: 'Código', text: '<script async src="https://cdn.blogsim.com.br/slots.js" data-blog="' + blog.id.toUpperCase() + '"></' + 'script>', notify }),
        h('div', null, h(B.Button, { variant: verified ? 'secondary' : 'primary', loading: checking, onClick: verify }, checking ? 'Verificando' : 'Verificar instalação'))));
  }
  // ---------- Admin master ----------
  function ReviewList({ campaigns, setCampaigns, notify }) {
    const queue = campaigns.filter(c => c.status === 'revisao');
    const decide = (id, status, msg) => { setCampaigns(list => list.map(c => c.id === id ? { ...c, status } : c)); notify(msg); };
    if (!queue.length) return h('p', { className: 'app-empty' }, 'Nenhuma campanha aguardando revisão.');
    return h('div', { className: 'app-review' }, queue.map(c => h('div', { key: c.id, className: 'app-review-row' },
      h('div', { className: 'app-review-main' }, h('b', null, c.name), h('span', null, `${c.advertiser} · ${money(c.invested)}`), c.blogNames ? h('span', null, 'Blogs: ' + c.blogNames.join(', ')) : null),
      h('div', { className: 'app-actions' },
        h(B.Badge, { tone: OBJ_TONE[c.objective] }, OBJ_LABEL[c.objective]),
        h(B.Button, { size: 'sm', onClick: () => decide(c.id, 'ativa', 'Campanha aprovada e no ar') }, 'Aprovar'),
        h(B.Button, { size: 'sm', variant: 'secondary', onClick: () => decide(c.id, 'encerrada', 'Campanha recusada. O anunciante foi avisado.') }, 'Recusar')))));
  }

  function AdminVisao({ campaigns, setCampaigns, blogs, pct, notify }) {
    const volume = sum(campaigns, 'invested');
    const advertisers = new Set(campaigns.map(c => c.advertiser)).size;
    const pending = blogs.filter(b => b.status === 'pendente').length;
    return h(Page, { title: 'Visão geral', subtitle: 'Outubro de 2026 · comissão de ' + pct + '%' },
      h('div', { className: 'app-metrics' },
        h(B.MetricCard, { label: 'Comissão da plataforma', value: volume * pct / 100, format: 'money', delta: 21, hint: 'vs. setembro', spark: spark(DAILY.volume) }),
        h(B.MetricCard, { label: 'Volume em aluguéis', value: volume, format: 'money', delta: 21, hint: 'vs. setembro' }),
        h(B.MetricCard, { label: 'Blogs ativos', value: blogs.length - pending, format: 'count', hint: pending ? pending + ' aguardando aprovação' : 'nenhum pendente' }),
        h(B.MetricCard, { label: 'Anunciantes', value: advertisers, format: 'count', hint: 'com pelo menos uma campanha' })),
      h(Card, { title: 'Volume em aluguéis por dia' }, h(BarChart, { data: DAILY.volume, isMoney: true, label: 'Volume em aluguéis por dia nos últimos 14 dias' })),
      h(Section, { title: 'Campanhas aguardando revisão' }, h(ReviewList, { campaigns, setCampaigns, notify })));
  }

  function AdminBlogs({ blogs, setBlogs, notify }) {
    const approve = id => { setBlogs(list => list.map(b => b.id === id ? { ...b, status: 'ativo' } : b)); notify('Blog aprovado. Os espaços já aparecem para os anunciantes.'); };
    const status = b => b.status === 'ativo' ? h(B.Badge, { tone: 'success', dot: true }, 'Ativo')
      : b.status === 'script' ? h(B.Badge, { dot: true }, 'Aguardando script')
      : h('div', { className: 'app-actions' }, h(B.Badge, { tone: 'warning', dot: true }, 'Pendente'), h(B.Button, { size: 'sm', onClick: () => approve(b.id) }, 'Aprovar'));
    return h(Page, { title: 'Blogs parceiros', subtitle: blogs.length + ' blogs cadastrados' },
      h(Table, { cols: [{ label: 'Blog' }, { label: 'Nicho' }, { label: 'Local' }, { label: 'Blogueiro' }, { label: 'Leitores/mês', num: true }, { label: 'Espaços', num: true }, { label: 'Status' }], empty: '',
        rows: blogs.map(b => [h('div', { className: 'app-blogcell' }, h(BlogLogo, { blog: b }), h('div', null, h('b', null, b.name), h('span', null, b.site || ''))),
          h(B.Badge, null, b.niche), place(b), b.owner, count(b.audience), b.slots, status(b)]) }));
  }
  function AdminAnunciantes({ campaigns }) {
    const by = {};
    campaigns.forEach(c => { const a = by[c.advertiser] || (by[c.advertiser] = { n: 0, live: 0, inv: 0 }); a.n++; a.inv += c.invested; if (c.status === 'ativa') a.live++; });
    return h(Page, { title: 'Anunciantes', subtitle: Object.keys(by).length + ' anunciantes' },
      h(Table, { cols: [{ label: 'Empresa' }, { label: 'Campanhas', num: true }, { label: 'Ativas', num: true }, { label: 'Investido', num: true }], empty: '',
        rows: Object.entries(by).sort((a, b) => b[1].inv - a[1].inv).map(([name, a]) => [h('b', null, name), a.n, a.live, money(a.inv)]) }));
  }

  function AdminCampanhas({ campaigns, setCampaigns, notify }) {
    return h(Page, { title: 'Campanhas', subtitle: campaigns.length + ' campanhas na plataforma' },
      h(Section, { title: 'Aguardando revisão' }, h(ReviewList, { campaigns, setCampaigns, notify })),
      h(Section, { title: 'Todas' }, h(B.CampaignTable, { rows: campaigns.map(c => ({ ...c, name: c.name + ' · ' + c.advertiser })) })));
  }

  function AdminSaques({ payouts, setPayouts, notify }) {
    const pay = id => { setPayouts(list => list.map(p => p.id === id ? { ...p, status: 'pago' } : p)); notify('Saque marcado como pago'); };
    const pending = payouts.filter(p => p.status === 'pendente');
    return h(Page, { title: 'Saques', subtitle: `Pedidos de saque dos blogueiros · ${pending.length} pendentes · ${money(sum(pending, 'value'))}` },
      h(Table, { cols: [{ label: 'Blog' }, { label: 'Solicitado em' }, { label: 'Valor', num: true }, { label: 'Status' }], empty: 'Nenhum saque solicitado.',
        rows: payouts.map(p => [h('b', null, p.blog), p.date, money(p.value),
          p.status === 'pago' ? h(B.Badge, { tone: 'success', dot: true }, 'Pago')
            : h('div', { className: 'app-actions' }, h(B.Badge, { tone: 'warning', dot: true }, 'Pendente'), h(B.Button, { size: 'sm', onClick: () => pay(p.id) }, 'Marcar como pago'))]) }));
  }

  function AdminConfig({ pct, setPct, billing, setBilling, notify }) {
    const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
    const [draft, setDraft] = useState(String(pct));
    const [min, setMin] = useState('50,00');
    const [rMin, setRMin] = useState(String(billing.min));
    const [rFrom, setRFrom] = useState(String(billing.installFrom));
    const [rMax, setRMax] = useState(String(billing.maxInstallments));
    const n = num(draft);
    const bad = !(draft.trim() !== '' && n >= 0 && n <= 50);
    const a = num(rMin), f = num(rFrom), m = parseInt(rMax, 10);
    const errMin = a >= 1 ? '' : 'Informe um valor maior que zero.';
    const errFrom = f >= a ? '' : 'Precisa ser igual ou maior que a recarga mínima.';
    const errMax = m >= 2 && m <= 12 ? '' : 'Use de 2 a 12 parcelas.';
    return h(Page, { title: 'Configurações', subtitle: 'Regras que valem para toda a plataforma.' },
      h(Card, { title: 'Comissão e limites' },
        h('div', { className: 'app-fields' },
          h(B.TextField, { id: 'cfg-comissao', label: 'Comissão do BlogSim', suffix: '%', inputMode: 'decimal', value: draft, onChange: e => setDraft(e.target.value), error: bad ? 'Use um valor entre 0 e 50%.' : undefined, hint: 'Descontada de cada aluguel antes do saque do blogueiro.' }),
          h(B.TextField, { id: 'cfg-minimo', label: 'Preço mínimo por espaço', prefix: 'R$', suffix: '/semana', inputMode: 'decimal', value: min, onChange: e => setMin(e.target.value) })),
        h('div', null, h(B.Button, { disabled: bad, onClick: () => { setPct(n); notify('Configurações salvas'); } }, 'Salvar configurações'))),
      h(Card, { title: 'Recarga de saldo do anunciante' },
        h('p', null, 'Valem para a tela Faturamento do anunciante. Pix e cartão de crédito aceitam qualquer valor a partir da recarga mínima; o parcelamento só aparece no cartão.'),
        h('div', { className: 'app-fields' },
          h(B.TextField, { id: 'cfg-recarga-min', label: 'Recarga mínima', prefix: 'R$', inputMode: 'decimal', value: rMin, onChange: e => setRMin(e.target.value), error: errMin || undefined }),
          h(B.TextField, { id: 'cfg-parcelar', label: 'Parcelar no cartão a partir de', prefix: 'R$', inputMode: 'decimal', value: rFrom, onChange: e => setRFrom(e.target.value), error: errFrom || undefined }),
          h(B.TextField, { id: 'cfg-parcelas', label: 'Máximo de parcelas', suffix: 'x', inputMode: 'numeric', value: rMax, onChange: e => setRMax(e.target.value), error: errMax || undefined })),
        h('div', null, h(B.Button, { disabled: !!(errMin || errFrom || errMax), onClick: () => { setBilling({ min: a, installFrom: f, maxInstallments: m }); notify('Regras de recarga salvas'); } }, 'Salvar regras de recarga'))));
  }  // ---------- Site e login ----------
  const ICON = d => h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', 'aria-hidden': true }, h('path', { d }));
  const ROLE_LABEL = { anunciante: 'Anunciante', blogueiro: 'Blogueiro', admin: 'Admin master' };
  const ROLE_TONE = { anunciante: 'brand', blogueiro: 'teal', admin: 'neutral' };
  const START_PAGE = { anunciante: 'Painel', blogueiro: 'Painel', admin: 'Visão geral' };
  // Contas de teste do protótipo (não há cadastro nem servidor).
  const ACCOUNTS = [
    { email: 'anunciante@blogsim.com.br', password: 'demo123', role: 'anunciante' },
    { email: 'blog@blogsim.com.br', password: 'demo123', role: 'blogueiro' },
    { email: 'admin@blogsim.com.br', password: 'demo123', role: 'admin' }
  ];
  const Wordmark = () => h('span', { className: 'bs-wordmark' }, 'Blog', h('b', null, 'Sim'));

  // Animação da landing: o anunciante cria a campanha e o anúncio aparece no blog.
  const DEMO_MS = [1300, 1300, 2600, 1800, 800, 1700, 2400];
  const DEMO_TOTAL = DEMO_MS.reduce((a, b) => a + b, 0);
  const DEMO_STEPS = ['Escolha o blog', 'Monte o anúncio', 'Publique', 'O anúncio aparece no blog'];
  const DEMO_AD = { title: 'Tênis de corrida com 30% off', text: 'Frete grátis até domingo.', cta: 'Comprar agora', imgLabel: '30% OFF' };

  function HeroDemo() {
    const reduce = (() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
    const [ms, setMs] = useState(reduce ? DEMO_TOTAL - 1 : 0);
    const [paused, setPaused] = useState(reduce);
    useEffect(() => {
      if (paused) return;
      const id = setInterval(() => setMs(m => (m + 80) % DEMO_TOTAL), 80);
      return () => clearInterval(id);
    }, [paused]);

    let phase = 0, local = ms, acc = 0;
    for (let i = 0; i < DEMO_MS.length; i++) { if (ms < acc + DEMO_MS[i]) { phase = i; local = ms - acc; break; } acc += DEMO_MS[i]; }
    const step = phase <= 1 ? 0 : phase === 2 ? 1 : phase === 3 ? 2 : 3;
    const onBlog = phase >= 4;
    const typed = DEMO_AD.title.slice(0, phase > 2 ? 99 : phase === 2 ? Math.floor(Math.min(1, local / 1800) * DEMO_AD.title.length) : 0);

    const row = (name, meta, price, sel, pressed) => h('div', { className: 'hd-row' + (sel ? ' is-sel' : '') },
      h('div', { className: 'hd-row-main' }, h('b', null, name), h('span', null, meta), h('span', { className: 'app-money' }, price)),
      h('span', { className: 'hd-btn ' + (sel ? 'is-secondary' : 'is-accent') + (pressed ? ' is-pressed' : '') }, sel ? 'Selecionado' : 'Alugar espaço'));

    let panel;
    if (phase <= 1) panel = h(React.Fragment, null,
      h('div', { className: 'hd-title' }, 'Onde seu anúncio vai aparecer?'),
      h('div', { className: 'hd-chips' }, h('span', { className: 'hd-chip is-on' }, 'Fitness'), h('span', { className: 'hd-chip' }, 'Finanças'), h('span', { className: 'hd-chip' }, 'Viagem')),
      row('Treino em Casa', 'Lateral · 61 mil leitores por mês', 'R$ 300,00 por semana', phase === 1, phase === 1 && local < 350),
      row('Grana no Bolso', 'Banner topo · 73 mil leitores por mês', 'R$ 520,00 por semana', false, false));
    else if (phase === 2) panel = h(React.Fragment, null,
      h('div', { className: 'hd-title' }, 'Monte o anúncio'),
      h('div', { className: 'hd-field' }, h('span', null, 'Título'), h('div', { className: 'hd-input' }, typed, h('i', { className: 'hd-caret' }))),
      h(AdCard, { ad: { ...DEMO_AD, title: typed || ' ', text: local > 1900 ? DEMO_AD.text : '\u00a0' } }));
    else panel = h(React.Fragment, null,
      h('div', { className: 'hd-title' }, 'Revise e publique'),
      h('dl', { className: 'app-dl' },
        h('dt', null, 'Espaço'), h('dd', null, 'Treino em Casa · Lateral'),
        h('dt', null, 'Objetivo'), h('dd', null, 'Vendas'),
        h('dt', null, 'Total'), h('dd', { className: 'money' }, 'R$ 600,00')),
      h('span', { className: 'hd-btn is-accent is-wide' + (local > 300 && local < 650 ? ' is-pressed' : '') }, 'Pagar R$ 600,00 e publicar'),
      local >= 650 ? h('div', { className: 'hd-toast' }, 'Campanha no ar') : null);

    const blog = h('div', { className: 'pv-page hd-blog' },
      h('div', { className: 'pv-head' }, h('b', null, 'Treino em Casa'), h('span', null, 'Início · Treinos')),
      h('div', { className: 'pv-body' },
        h('div', { className: 'pv-post' }, h('div', { className: 'pv-title' }, BLOG_POST['Treino em Casa']), ...[0, 1, 2, 3, 4, 5].map(i => h('div', { key: i, className: 'pv-line' }))),
        h('div', { className: 'pv-side' },
          phase >= 5 ? h('div', { className: 'hd-ad-in' + (phase === 6 && local < 350 ? ' is-clicked' : '') }, h(AdCard, { ad: DEMO_AD, vertical: true })) : h('div', { className: 'pv-side-box hd-slot' }))),
      phase === 6 && local >= 350 ? h('div', { className: 'hd-sale' }, '+1 venda contada') : null);

    return h('div', { className: 'hd' },
      h('div', { className: 'hd-frame', role: 'img', 'aria-label': 'Animação: o anunciante escolhe o blog Treino em Casa, escreve o anúncio, publica, e o anúncio aparece na lateral do blog. Um clique no anúncio conta uma venda.' },
        h('div', { className: 'hd-chrome', 'aria-hidden': true }, onBlog ? 'treinoemcasa.com.br' : 'BlogSim · Criar campanha'),
        h('div', { className: 'hd-stage', 'aria-hidden': true },
          h('div', { className: 'hd-scene hd-panel' + (onBlog ? '' : ' is-on') }, panel),
          h('div', { className: 'hd-scene' + (onBlog ? ' is-on' : '') }, blog))),
      h('div', { className: 'hd-foot' },
        h('ol', { className: 'hd-steps' }, DEMO_STEPS.map((s, i) => h('li', { key: s, className: i === step ? 'is-on' : i < step ? 'is-done' : undefined }, s))),
        h('button', { type: 'button', className: 'hd-pause', onClick: () => setPaused(p => !p) }, paused ? 'Reproduzir' : 'Pausar')));
  }

  const nicheOf = name => (BLOGS.find(b => b.name === name) || {}).niche;

  // Ilustração: uma página de blog em miniatura com os espaços de anúncio marcados.
  function MiniPage({ blog, slots = [], tags = {}, delay = 0, large }) {
    const has = p => slots.includes(p);
    const slot = p => h('div', { className: 'mp-slot mp-' + p, style: { '--d': (delay + slots.indexOf(p) * 0.3) + 's' } },
      h('span', null, 'Anúncio'), tags[p] ? h('em', null, tags[p]) : null);
    return h('div', { className: 'mp' + (large ? ' is-large' : '') },
      h('div', { className: 'mp-top' }, h('b', null, blog), h('i'), h('i'), h('i')),
      has('banner') ? slot('banner') : null,
      h('div', { className: 'mp-body' },
        h('div', { className: 'mp-post' },
          h('div', { className: 'mp-h' }, BLOG_POST[blog] || 'Post da semana'),
          h('i'), h('i'), h('i', { className: 's' }),
          has('inline') ? slot('inline') : null,
          h('i'), h('i', { className: 's' })),
        h('div', { className: 'mp-side' }, has('lateral') ? slot('lateral') : h('i', { className: 'box' }), h('i', { className: 'box' }))),
      has('popup') ? h('div', { className: 'mp-pop' }, slot('popup')) : null);
  }

  const ILL = {
    visitas: h('svg', { className: 'lp-ill', viewBox: '0 0 72 56', 'aria-hidden': true },
      h('rect', { className: 'ill-page', x: 2, y: 4, width: 60, height: 46, rx: 6 }),
      h('rect', { className: 'ill-line', x: 2, y: 4, width: 60, height: 10, rx: 6 }),
      h('rect', { className: 'ill-line', x: 9, y: 21, width: 34, height: 4, rx: 2 }),
      h('rect', { className: 'ill-line', x: 9, y: 29, width: 26, height: 4, rx: 2 }),
      h('rect', { className: 'ill-line', x: 9, y: 37, width: 30, height: 4, rx: 2 }),
      h('path', { className: 'ill-brand ill-edge', d: 'M44 26l20 8-8.5 2.6L52 45z' })),
    conversas: h('svg', { className: 'lp-ill', viewBox: '0 0 72 56', 'aria-hidden': true },
      h('path', { className: 'ill-teal-soft', d: 'M4 10a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H16l-8 6v-6.6A6 6 0 0 1 4 22z' }),
      h('path', { className: 'ill-teal', d: 'M26 30a6 6 0 0 1 6-6h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6v6l-8-6H32a6 6 0 0 1-6-6z' }),
      h('circle', { className: 'ill-on', cx: 38, cy: 36, r: 2.4 }), h('circle', { className: 'ill-on', cx: 47, cy: 36, r: 2.4 }), h('circle', { className: 'ill-on', cx: 56, cy: 36, r: 2.4 })),
    vendas: h('svg', { className: 'lp-ill', viewBox: '0 0 72 56', 'aria-hidden': true },
      h('path', { className: 'ill-page', d: 'M14 4h36v48l-6-4-6 4-6-4-6 4-6-4-6 4z' }),
      h('rect', { className: 'ill-line', x: 20, y: 12, width: 24, height: 4, rx: 2 }),
      h('rect', { className: 'ill-line', x: 20, y: 20, width: 18, height: 4, rx: 2 }),
      h('rect', { className: 'ill-accent', x: 20, y: 32, width: 24, height: 6, rx: 3 }),
      h('circle', { className: 'ill-accent', cx: 56, cy: 14, r: 10 }),
      h('path', { className: 'ill-check', d: 'M51 14l3.5 3.5L61 11' }))
  };


  // Entrada de cada tela dos painéis: cabeçalho, blocos em cascata, números contando, barras crescendo.
  function Reveal({ children }) {
    const ref = React.useRef(null);
    useMotion(ref, (g, root) => {
      const q = s => root.querySelectorAll(s);
      const tl = g.timeline({ defaults: { ease: 'power3.out', duration: .55 } });
      from(tl, q('.app-head h1, .app-head p, .app-head-actions'), { y: 14, opacity: 0, stagger: .05 });
      from(tl, [...root.children].filter(c => !c.classList.contains('app-head')), { y: 18, opacity: 0, stagger: .07 }, '-=.35');
      from(tl, q('.bs-metric'), { y: 12, opacity: 0, stagger: .06 }, '<');
      from(tl, q('.app-chart .bar'), { scaleY: 0, transformOrigin: '50% 100%', stagger: .025, duration: .5, ease: 'power2.out' }, '-=.3');
      from(tl, q('.bs-table tbody tr'), { x: -10, opacity: 0, stagger: .035, duration: .4 }, '-=.45');
      from(tl, q('.bs-slot, .app-review-row, .app-steps li'), { y: 10, opacity: 0, stagger: .04, duration: .45 }, '-=.45');
      q('.bs-metric-value').forEach(el => countUp(g, el));
    }, []);
    return h('div', { ref, className: 'app-content' }, children);
  }

  function useLandingMotion(ref) {
    useMotion(ref, (g, root) => {
      const q = s => [...root.querySelectorAll(s)];
      const ST = window.ScrollTrigger;
      const hero = g.timeline({ defaults: { ease: 'power4.out' } });
      from(hero, q('.lp-hero h1 .wi'), { yPercent: 112, duration: 1, stagger: .045 });
      from(hero, q('.lp-hero .lp-slotword'), { backgroundColor: 'rgba(255,234,220,0)', borderColor: 'rgba(242,106,27,0)', duration: .7, ease: 'power2.out' }, '-=.45');
      from(hero, q('.lp-hero-text > p, .lp-hero-text > .app-actions, .lp-proof'), { y: 18, opacity: 0, duration: .8, stagger: .08 }, '-=.65');
      from(hero, q('.lp-hero .hd'), { x: 56, opacity: 0, rotate: 1.5, duration: 1.3, ease: 'expo.out' }, .25);
      if (!ST) return;

      ST.create({ trigger: document.documentElement, start: 'top+=8 top', end: 'bottom top', toggleClass: { targets: q('.lp-nav'), className: 'is-scrolled' } });
      g.to(q('.lp-hero .hd'), { yPercent: -6, ease: 'none', scrollTrigger: { trigger: q('.lp-hero')[0], start: 'top top', end: 'bottom top', scrub: .6 } });

      q('.lp-section h2, .lp-band h2, .lp-close h2').forEach(el => g.from(el.querySelectorAll('.wi'), { yPercent: 112, duration: .9, stagger: .035, ease: 'power4.out', scrollTrigger: { trigger: el, start: 'top 86%' } }));
      q('.lp-sub, .lp-blogger p, .lp-close p').forEach(el => g.from(el, { y: 16, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));

      q('.lp-measure').forEach((m, i) => {
        const t = g.timeline({ delay: i * .12, defaults: { ease: 'power3.out' }, scrollTrigger: { trigger: m, start: 'top 84%' } });
        from(t, [m.querySelector('.lp-rule')], { scaleX: 0, transformOrigin: '0 50%', duration: .8, ease: 'power2.inOut' });
        from(t, [m.querySelector('.lp-ill')], { opacity: 0, duration: .3 }, '-=.35');
        if (m.classList.contains('lp-m-visitas')) from(t, [m.querySelector('.ill-brand')], { x: -18, y: -14, opacity: 0, duration: .7, ease: 'back.out(2)' }, '-=.05');
        if (m.classList.contains('lp-m-conversas')) {
          from(t, [m.querySelector('.ill-teal-soft')], { scale: 0, transformOrigin: '0% 100%', duration: .5, ease: 'back.out(2)' }, '-=.05');
          from(t, [m.querySelector('.ill-teal')], { scale: 0, transformOrigin: '100% 100%', duration: .5, ease: 'back.out(2)' }, '-=.2');
          from(t, m.querySelectorAll('.ill-on'), { y: 3, opacity: 0, stagger: .08, duration: .3 }, '-=.1');
        }
        if (m.classList.contains('lp-m-vendas')) {
          const check = m.querySelector('.ill-check');
          g.set(check, { strokeDasharray: 20 });
          from(t, [m.querySelector('.ill-page')], { y: -14, opacity: 0, duration: .6 }, '-=.05');
          from(t, [m.querySelector('circle.ill-accent')], { scale: 0, transformOrigin: '50% 50%', duration: .5, ease: 'back.out(2.5)' });
          from(t, [check], { strokeDashoffset: 20, duration: .35, ease: 'power1.out' });
        }
        from(t, [m.querySelector('b'), m.querySelector('p'), m.querySelector('.lp-eg')], { y: 12, opacity: 0, stagger: .06, duration: .6 }, '-=.45');
      });

      const big = q('.mp.is-large')[0];
      if (big) {
        const t = g.timeline({ scrollTrigger: { trigger: big, start: 'top 78%' } });
        from(t, [big], { y: 30, opacity: 0, duration: .9, ease: 'expo.out' });
        from(t, big.querySelectorAll('.mp-post > i, .mp-side > i'), { scaleX: 0, transformOrigin: '0 50%', stagger: .05, duration: .5, ease: 'power2.out' }, '-=.55');
        from(t, big.querySelectorAll('.mp-slot'), { ...RENT_FROM, stagger: .35, duration: .5, ease: 'power1.inOut' }, '-=.2');
        from(t, big.querySelectorAll('.mp-slot em'), { y: 8, opacity: 0, stagger: .35, duration: .4, ease: 'back.out(2)' }, '<.25');
      }
      q('.lp-facet').forEach((f, i) => g.from(f.querySelectorAll('.lp-tag'), { y: 8, opacity: 0, stagger: .04, duration: .4, delay: i * .1, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 90%' } }));
      q('.lp-checks').forEach(list => g.from(list.children, { x: -12, opacity: 0, stagger: .08, duration: .5, ease: 'power3.out', scrollTrigger: { trigger: list, start: 'top 88%' } }));

      const cards = q('.lp-blog');
      if (cards.length) {
        g.set(cards, { y: 28, opacity: 0 });
        ST.batch(cards, {
          start: 'top 90%',
          onEnter: els => {
            g.to(els, { y: 0, opacity: 1, stagger: .08, duration: .8, ease: 'power3.out', overwrite: true });
            g.from(els.map(e => e.querySelector('.blog-logo')).filter(Boolean), { scale: .6, opacity: 0, stagger: .08, delay: .3, duration: .5, ease: 'back.out(2)' });
          }
        });
      }

      const close = q('.lp-close')[0];
      if (close) {
        const t = g.timeline({ scrollTrigger: { trigger: close, start: 'top 82%' } });
        from(t, [close], { scale: .94, opacity: 0, duration: .9, ease: 'expo.out' });
        from(t, [close], { backgroundColor: 'rgba(255,234,220,0)', duration: .6 }, '-=.45');
        from(t, [close.querySelector('.lp-close-tag')], { y: 10, opacity: 0, duration: .5 }, '-=.45');
        from(t, close.querySelectorAll('.app-actions > *'), { y: 12, opacity: 0, stagger: .08, duration: .5 }, '-=.2');
      }
      if (document.fonts) document.fonts.ready.then(() => ST.refresh());
    }, []);
  }

  function Landing({ onLogin, onSignup, blogs }) {
    const ref = React.useRef(null);
    useLandingMotion(ref);
    const active = blogs.filter(b => b.status === 'ativo');
    const partners = active.map(b => ({ ...b, places: SLOTS.filter(s => s.blogId === b.id).map(s => s.placement) }));
    const facet = (label, items) => h('div', { className: 'lp-facet' }, h('b', null, label), h('div', { className: 'lp-tags' }, items.map(x => h('span', { key: x, className: 'lp-tag' }, x))));
    const pin = h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, 'aria-hidden': true }, h('path', { d: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z' }), h('circle', { cx: 12, cy: 9.5, r: 2.5 }));
    const readers = COMPACT.format(sum(active, 'audience'));
    const ctas = h('div', { className: 'app-actions' },
      h(B.Button, { onClick: () => onLogin('anunciante') }, 'Quero anunciar'),
      h(B.Button, { variant: 'secondary', onClick: () => onSignup() }, 'Tenho um blog'));
    const measures = [
      ['visitas', 'Visitas no site', 'O pixel do BlogSim no seu site conta cada leitor que chegou pelo anúncio.', '9.870 visitas'],
      ['conversas', 'Conversas no WhatsApp', 'O link redirecionador abre o seu WhatsApp e registra a conversa antes.', '204 conversas'],
      ['vendas', 'Vendas', 'O pixel na página de confirmação registra cada compra que começou num blog.', '86 vendas']
    ];
    return h('div', { ref, className: 'lp-page' },
      h('header', { className: 'lp-nav' }, h('div', { className: 'lp-wrap lp-nav-in' },
        Wordmark(),
        h('nav', { className: 'lp-links', 'aria-label': 'Seções' },
          h('a', { href: '#como-funciona' }, 'Como funciona'),
          h('a', { href: '#para-blogs' }, 'Para blogs'),
          h('a', { href: '#blogs-parceiros' }, 'Blogs parceiros')),
        h(B.Button, { variant: 'secondary', size: 'sm', onClick: () => onLogin() }, 'Entrar'))),
      h('main', null,
        h('section', { className: 'lp-hero lp-wrap' },
          h('div', { className: 'lp-hero-text' },
            h('h1', null, Words('Seu anúncio'), ' ', h('span', { className: 'lp-slotword' }, Words('no meio do post')), ' ', Words('que o seu cliente está lendo.')),
            h('p', null, 'O BlogSim junta blogs de vários nichos num lugar só. Você escolhe o blog e o espaço, paga por semana e vê quantas visitas, conversas e vendas cada anúncio trouxe.'),
            ctas,
            h('span', { className: 'lp-proof' }, `${active.length} blogs parceiros · ${readers} leitores por mês`)),
          h(HeroDemo)),
        h('section', { id: 'como-funciona', className: 'lp-section lp-wrap' },
          h('h2', null, Words('Você escolhe o que conta como resultado.')),
          h('div', { className: 'lp-measures' }, measures.map(([k, title, text, eg]) => h('div', { key: k, className: 'lp-measure lp-m-' + k },
            h('div', { className: 'lp-rule' }), ILL[k], h('b', null, title), h('p', null, text), h('span', { className: 'lp-eg' }, 'Exemplo: ' + eg))))),

        h('section', { id: 'para-blogs', className: 'lp-band' }, h('div', { className: 'lp-wrap lp-blogger' },
          h('div', null,
            h('h2', null, Words('Tem um blog? Alugue os espaços dele.')),
            h('p', null, 'Você marca onde os anúncios podem aparecer e quanto custa cada espaço por semana. O BlogSim traz os anunciantes e repassa o valor, já descontada a comissão.'),
            h('ul', { className: 'lp-checks' }, ['Instale um script no blog uma vez.', 'Pause um espaço quando quiser.', 'Peça o saque pelo painel.'].map(x => h('li', { key: x }, x))),
            h(B.Button, { variant: 'secondary', onClick: () => onSignup() }, 'Cadastrar meu blog')),
          h('div', { role: 'img', 'aria-label': 'Página do blog Viagem com Criança com três espaços de anúncio: banner no topo, lateral e no meio do post.' },
            h(MiniPage, { blog: 'Viagem com Criança', large: true, slots: ['banner', 'lateral', 'inline'], tags: { banner: 'Banner topo', lateral: 'Lateral', inline: 'No meio do post' } })))),

        h('section', { id: 'blogs-parceiros', className: 'lp-section lp-wrap' },
          h('h2', null, Words('Blogs por nicho e por região.')),
          h('p', { className: 'lp-sub' }, 'Escolha pelo assunto do blog e pelo lugar onde ele é lido, por estado e cidade. Depois escolha a posição do anúncio na página.'),
          h('div', { className: 'lp-facets' },
            facet('Nichos', [...new Set(active.map(b => b.niche))]),
            facet('Regiões', [...new Set(active.map(place))]),
            facet('Posições', Object.values(PLACE))),
          h('div', { className: 'lp-blogs' }, partners.map(b => h('div', { key: b.id, className: 'lp-blog' },
            h('div', { className: 'lp-blog-brand' }, h(BlogLogo, { blog: b, size: 'lg' }), h('div', null, h('b', null, b.name), h('span', null, b.site))),
            h('div', { className: 'lp-blog-meta' }, h(B.Badge, null, b.niche), h('span', { className: 'lp-loc' }, pin, place(b))),
            h('span', null, count(b.audience) + ' leitores por mês'),
            h('span', null, 'Espaços: ' + b.places.map(p => PLACE[p]).join(', ')))))),
        h('section', { className: 'lp-wrap lp-close-wrap' }, h('div', { className: 'lp-close' },
          h('span', { className: 'lp-close-tag' }, 'Espaço disponível'),
          h('h2', null, Words('Este espaço pode ser do seu anúncio.')),
          h('p', null, 'Ou, se você tem um blog, do anúncio de alguém que quer falar com os seus leitores.'),
          ctas))),
      h('footer', { className: 'lp-foot lp-wrap' }, 'BlogSim · protótipo para validação · outubro de 2026'));
  }

  const REMEMBER_KEY = 'blogsim-email';
  const readSaved = () => { try { return localStorage.getItem(REMEMBER_KEY) || ''; } catch (e) { return ''; } };

  function Login({ suggest, onLogin, onBack, onSignup }) {
    const [email, setEmail] = useState(readSaved);
    const [pw, setPw] = useState('');
    const [remember, setRemember] = useState(() => !!readSaved());
    const [err, setErr] = useState('');
    const [view, setView] = useState('login');
    const [resetEmail, setResetEmail] = useState('');
    const [resetErr, setResetErr] = useState('');
    function submit(e) {
      e.preventDefault();
      const acc = ACCOUNTS.find(a => a.email === email.trim().toLowerCase() && a.password === pw);
      if (!acc) { setErr('E-mail ou senha incorretos. Confira os dados ou escolha uma das contas abaixo.'); return; }
      // Guarda só o e-mail, e só neste navegador. A senha nunca é guardada.
      try { if (remember) localStorage.setItem(REMEMBER_KEY, acc.email); else localStorage.removeItem(REMEMBER_KEY); } catch (e2) {}
      onLogin(acc.role);
    }
    function fill(a) { setEmail(a.email); setPw(a.password); setErr(''); }
    function openForgot() { setResetEmail(email); setResetErr(''); setView('forgot'); }
    function sendReset(e) {
      e.preventDefault();
      if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim())) { setResetErr('Informe um e-mail válido, como nome@empresa.com.br.'); return; }
      setView('sent');
    }
    const ref = React.useRef(null);
    useMotion(ref, (g, root) => {
      const tl = g.timeline({ defaults: { ease: 'power3.out' } });
      from(tl, root.querySelectorAll('.lg-card'), { y: 24, opacity: 0, duration: .7 });
      from(tl, root.querySelectorAll('.lg-acc'), { y: 8, opacity: 0, stagger: .06, duration: .4 }, '-=.3');
      const scene = root.querySelector('.lg-scene');
      if (!scene) return;
      from(tl, [scene], { y: 30, opacity: 0, duration: 1, ease: 'expo.out' }, .15);
      // Loop: o espaço é alugado, o anúncio recebe um clique e a venda é contada.
      const slot = scene.querySelector('.mp-slot'), chip = scene.querySelector('.lg-result');
      const FILLED = { backgroundColor: '#f26a1b', borderColor: '#f26a1b', color: '#1d0d03', borderStyle: 'solid' };
      g.timeline({ repeat: -1, repeatDelay: .8, delay: .9 })
        .set(chip, { opacity: 0 }).set(slot, RENT_FROM)
        .to(slot, { ...FILLED, duration: .6, ease: 'power1.inOut' })
        .to(slot, { scale: .93, duration: .12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, '+=.5')
        .fromTo(chip, { y: 12, opacity: 0, scale: .9 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: 'back.out(2)' }, '-=.05')
        .to(chip, { opacity: 0, y: -8, duration: .4 }, '+=1.6');
    }, []);
    // Troca de passo dentro do card (entrar, esqueci a senha, e-mail enviado).
    const bodyRef = React.useRef(null), firstView = React.useRef(true);
    React.useLayoutEffect(() => {
      const g = window.gsap;
      if (firstView.current) { firstView.current = false; return; }
      if (!g || !bodyRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const tw = g.fromTo(bodyRef.current, { x: view === 'login' ? -20 : 20, opacity: 0 }, { x: 0, opacity: 1, duration: .4, ease: 'power3.out', clearProps: 'transform,opacity' });
      return () => tw.kill();
    }, [view]);
    const backToLogin = h('button', { type: 'button', className: 'lg-link', onClick: () => setView('login') }, 'Voltar para o login');

    let body;
    if (view === 'login') body = h(React.Fragment, null,
      h('h1', null, 'Entrar'),
      h('form', { className: 'lg-form', onSubmit: submit, noValidate: true },
        h(B.TextField, { id: 'login-email', label: 'E-mail', type: 'email', autoComplete: 'username', value: email, onChange: e => setEmail(e.target.value) }),
        h(B.TextField, { id: 'login-senha', label: 'Senha', type: 'password', autoComplete: 'current-password', value: pw, onChange: e => setPw(e.target.value) }),
        h('div', { className: 'lg-row' },
          h('label', { className: 'lg-check', htmlFor: 'login-lembrar' },
            h('input', { id: 'login-lembrar', type: 'checkbox', checked: remember, onChange: e => setRemember(e.target.checked) }),
            'Lembrar de mim'),
          h('button', { type: 'button', className: 'lg-link', onClick: openForgot }, 'Esqueci a senha')),
        err ? h('p', { className: 'app-error', role: 'alert' }, err) : null,
        h(B.Button, { type: 'submit', className: 'lg-submit' }, 'Entrar')),
      h('div', { className: 'lg-demo' },
        ACCOUNTS.map(a => h('button', { key: a.email, type: 'button', className: 'lg-acc' + (suggest === a.role ? ' is-suggested' : ''), onClick: () => fill(a) },
          h(B.Badge, { tone: ROLE_TONE[a.role] }, ROLE_LABEL[a.role]), h('span', null, a.email)))),
      h('p', { className: 'lg-alt' }, 'Tem um blog? ', h('button', { type: 'button', className: 'lg-link', onClick: onSignup }, 'Cadastre-se')));
    if (view === 'forgot') body = h(React.Fragment, null,
      h('h1', null, 'Recuperar senha'),
      h('p', { className: 'lg-text' }, 'Informe o e-mail da sua conta. Enviamos um link para você criar uma senha nova.'),
      h('form', { className: 'lg-form', onSubmit: sendReset, noValidate: true },
        h(B.TextField, { id: 'reset-email', label: 'E-mail', type: 'email', autoComplete: 'username', value: resetEmail, onChange: e => { setResetEmail(e.target.value); setResetErr(''); }, error: resetErr || undefined }),
        h(B.Button, { type: 'submit', className: 'lg-submit' }, 'Enviar link')),
      backToLogin);
    if (view === 'sent') body = h(React.Fragment, null,
      h('h1', null, 'Confira seu e-mail'),
      h('p', { className: 'lg-text', role: 'status' }, 'Se ', h('b', null, resetEmail.trim()), ' tiver uma conta no BlogSim, você vai receber um link para criar uma senha nova.'),
      h(B.Button, { className: 'lg-submit', onClick: () => setView('login') }, 'Voltar para o login'));

    return h('main', { className: 'lg', ref },
      h('div', { className: 'lg-card' },
        h('button', { type: 'button', className: 'lg-home', onClick: onBack, 'aria-label': 'Ir para o site do BlogSim' }, Wordmark()),
        h('div', { className: 'lg-body', ref: bodyRef }, body)),
      h('div', { className: 'lg-art', 'aria-hidden': true },
        h('div', { className: 'lg-scene' },
          h(MiniPage, { blog: 'Treino em Casa', slots: ['lateral'], large: true }),
          h('div', { className: 'lg-result' }, h('span', null, 'Tênis de corrida · Treino em Casa'), h('b', null, '+1 venda')))));
  }
  function SelectField({ id, label, value, onChange, options, error }) {
    return h('div', { className: 'bs-field app-select-field' + (error ? ' bs-field-error' : '') },
      h('label', { className: 'bs-field-label', htmlFor: id }, label),
      h('select', { id, className: 'app-select', value, onChange: e => onChange(e.target.value), 'aria-invalid': error ? true : undefined }, options),
      error ? h('div', { className: 'bs-field-hint' }, error) : null);
  }

  function Signup({ onSignup, onLogin, onBack }) {
    const [f, setF] = useState({ name: '', email: '', pw: '', blog: '', site: '', niche: NICHES[0], uf: '', city: '' });
    const [logo, setLogo] = useState(null);
    const [logoErr, setLogoErr] = useState('');
    const [tried, setTried] = useState(false);
    const set = k => v => setF(s => ({ ...s, [k]: v }));
    const errs = {
      name: f.name.trim() ? '' : 'Informe seu nome.',
      email: /^\S+@\S+\.\S+$/.test(f.email.trim()) ? '' : 'Informe um e-mail válido, como nome@seublog.com.br.',
      pw: f.pw.length >= 6 ? '' : 'Use pelo menos 6 caracteres.',
      blog: f.blog.trim() ? '' : 'Informe o nome do blog.',
      site: /\S+\.\S+/.test(f.site) ? '' : 'Informe o endereço do blog, como seublog.com.br.',
      uf: f.uf ? '' : 'Escolha o estado.',
      city: f.city.trim() ? '' : 'Informe a cidade.'
    };
    const err = k => (tried && errs[k]) || undefined;
    function submit(e) {
      e.preventDefault(); setTried(true);
      if (Object.values(errs).some(Boolean)) return;
      onSignup({ ...f, logo });
    }
    const ref = React.useRef(null);
    useMotion(ref, (g, root) => {
      const tl = g.timeline({ defaults: { ease: 'power3.out' } });
      from(tl, root.querySelectorAll('.lg-card'), { y: 24, opacity: 0, duration: .7 });
      from(tl, root.querySelectorAll('.lg-art .mp'), { y: 30, opacity: 0, duration: 1, ease: 'expo.out' }, .15);
    }, []);
    const field = (k, id, label, extra) => h(B.TextField, { id, label, value: f[k], onChange: e => set(k)(e.target.value), error: err(k), ...extra });
    return h('main', { className: 'lg is-signup', ref },
      h('div', { className: 'lg-card' },
        h('button', { type: 'button', className: 'lg-home', onClick: onBack, 'aria-label': 'Ir para o site do BlogSim' }, Wordmark()),
        h('div', { className: 'lg-body' },
          h('h1', null, 'Cadastre seu blog'),
          h('p', { className: 'lg-text' }, 'Depois do cadastro, você instala um script no blog. Assim que ele for verificado, o painel é liberado.'),
          h('form', { className: 'lg-form', onSubmit: submit, noValidate: true },
            h('div', { className: 'lg-grid' },
              field('name', 'su-nome', 'Seu nome', { autoComplete: 'name' }),
              field('email', 'su-email', 'E-mail', { type: 'email', autoComplete: 'email' }),
              field('pw', 'su-senha', 'Senha', { type: 'password', autoComplete: 'new-password', hint: 'Pelo menos 6 caracteres.' }),
              field('blog', 'su-blog', 'Nome do blog', {}),
              field('site', 'su-site', 'Endereço do blog', { placeholder: 'seublog.com.br' }),
              h(SelectField, { id: 'su-nicho', label: 'Nicho', value: f.niche, onChange: set('niche'), options: NICHES.map(x => h('option', { key: x, value: x }, x)) }),
              h(SelectField, { id: 'su-uf', label: 'Estado', value: f.uf, onChange: set('uf'), error: err('uf'), options: [h('option', { key: '', value: '' }, 'Escolha'), ...UFS.map(x => h('option', { key: x, value: x }, x))] }),
              field('city', 'su-cidade', 'Cidade', {})),
            h('div', { className: 'app-logo-row' },
              h(BlogLogo, { blog: { name: f.blog.trim() || 'Seu Blog', color: '#2a49de', logo }, size: 'lg' }),
              h('div', { className: 'bs-field' },
                h('label', { className: 'bs-field-label', htmlFor: 'su-logo' }, 'Logo do blog (opcional)'),
                h('input', { id: 'su-logo', type: 'file', accept: 'image/*', className: 'app-file', onChange: e => readLogo(e, setLogo, setLogoErr) }),
                h('div', { className: logoErr ? 'app-error' : 'bs-field-hint' }, logoErr || 'Quadrada, até 1 MB. Dá para trocar depois em Meu blog.'))),
            h(B.Button, { type: 'submit', className: 'lg-submit' }, 'Criar conta e continuar'))),
        h('p', { className: 'lg-alt' }, 'Já tem conta? ', h('button', { type: 'button', className: 'lg-link', onClick: onLogin }, 'Entrar'))),
      h('div', { className: 'lg-art', 'aria-hidden': true },
        h('div', { className: 'lg-scene' }, h(MiniPage, { blog: 'Viagem com Criança', slots: ['banner', 'lateral'], tags: { banner: 'Banner topo', lateral: 'Lateral' }, large: true }))));
  }

  // ---------- App ----------
  function App() {
    const [screen, setScreen] = useState(() => { try { return location.hash === '#entrar' ? 'login' : 'site'; } catch (e) { return 'site'; } });
    const [suggest, setSuggest] = useState(null);
    const [role, setRole] = useState('anunciante');
    const [page, setPage] = useState('Painel');
    const [campaigns, setCampaigns] = useState(INITIAL_CAMPAIGNS);
    const [cart, setCart] = useState([]);
    const [balance, setBalance] = useState(3000);
    const [txns, setTxns] = useState(INITIAL_TXNS);
    const [payouts, setPayouts] = useState(INITIAL_PAYOUTS);
    const [blogs, setBlogs] = useState(BLOGS.map(b => ({ ...b, slots: b.slots.length, status: b.status || 'ativo' })));
    const [pct, setPct] = useState(20);
    // Regras de recarga definidas pelo admin: mínimo, valor a partir do qual o cartão parcela e máximo de parcelas.
    const [billing, setBilling] = useState({ min: 100, installFrom: 500, maxInstallments: 6 });
    // Blogueiro logado: o de exemplo ou um recém-cadastrado, que só vê o painel completo depois de verificar o script.
    const [blogger, setBlogger] = useState({ blogId: 'b1', fresh: false, verified: true });
    const [slotsByBlog, setSlotsByBlog] = useState({ b1: INITIAL_MY_SLOTS });
    const [balByBlog, setBalByBlog] = useState({ b1: 1640 });
    const myBlog = blogs.find(b => b.id === blogger.blogId) || blogs[0];
    const mySlots = slotsByBlog[blogger.blogId] || [];
    const setMySlots = fn => setSlotsByBlog(m => ({ ...m, [blogger.blogId]: typeof fn === 'function' ? fn(m[blogger.blogId] || []) : fn }));
    const bloggerBalance = balByBlog[blogger.blogId] || 0;
    const [toast, setToast] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const sideRef = React.useRef(null);
    useMotion(sideRef, (g, root) => {
      g.from(root.querySelectorAll('.bs-wordmark, .bs-nav > .bs-badge, .bs-nav-item, .bs-nav-user'), { x: -12, opacity: 0, stagger: .035, duration: .45, ease: 'power3.out' });
    }, [screen, role, blogger.verified]);

    const notify = msg => setToast({ msg, k: Date.now() });
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t); }, [toast]);
    useEffect(() => { if (!menuOpen) return; const f = e => { if (e.key === 'Escape') setMenuOpen(false); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [menuOpen]);

    const top = () => { try { window.scrollTo(0, 0); } catch (e) {} };
    const go = p => { setMenuOpen(false); setPage(p); top(); };
    function openLogin(r) { setSuggest(r || null); setScreen('login'); top(); }
    function openSignup() { setScreen('cadastro'); top(); }
    function login(r) {
      if (r === 'blogueiro') setBlogger({ blogId: 'b1', fresh: false, verified: true });
      setRole(r); setPage(START_PAGE[r]); setMenuOpen(false); setScreen('app'); top();
    }
    function signup(d) {
      const id = 'b' + Date.now();
      setBlogs(list => [...list, { id, name: d.blog.trim(), niche: d.niche, owner: d.name.trim(), audience: 0, city: d.city.trim(), uf: d.uf, color: '#2a49de', site: d.site.trim(), logo: d.logo, desc: '', slots: 0, status: 'script' }]);
      setBlogger({ blogId: id, fresh: true, verified: false });
      setRole('blogueiro'); setPage('Instalar script'); setMenuOpen(false); setScreen('app'); top();
      notify('Conta criada. Instale o script no seu blog para liberar o painel.');
    }
    function verifyScript() {
      setBlogger(b => ({ ...b, verified: true }));
      setBlogs(list => list.map(b => b.id === blogger.blogId && b.status === 'script' ? { ...b, status: 'ativo' } : b));
      setPage('Meus espaços'); top();
      notify('Script encontrado. Seu painel está liberado.');
    }
    function saveBlog(patch) {
      const old = myBlog.name;
      setBlogs(list => list.map(b => b.id === blogger.blogId ? { ...b, ...patch } : b));
      if (patch.name && patch.name !== old) setPayouts(list => list.map(p => p.blog === old ? { ...p, blog: patch.name } : p));
      notify('Blog atualizado');
    }
    function logout() { setMenuOpen(false); setScreen('site'); top(); notify('Você saiu da sua conta.'); }

    function publishCampaign(c) {
      setCampaigns(list => [{ id: 'c' + Date.now(), name: c.name, advertiser: ME, objective: c.objective, status: 'revisao', invested: c.total, clicks: 0, results: 0, blogs: c.blogs, blogNames: c.blogNames }, ...list]);
      setBalance(b => b - c.total);
      setTxns(t => [{ date: TODAY, desc: `${c.name} · ${c.slots} ${c.slots > 1 ? 'espaços' : 'espaço'}`, value: -c.total }, ...t]);
      setPage('Campanhas');
      notify('Campanha enviada para revisão. Entre como admin para aprovar.');
    }
    function addBalance(v, method, n) {
      const how = method === 'cartao' ? 'cartão de crédito' + (n > 1 ? ` em ${n}x` : '') : 'Pix';
      setBalance(b => b + v);
      setTxns(t => [{ date: TODAY, desc: 'Recarga via ' + how, value: v }, ...t]);
      notify('Saldo adicionado: ' + money(v));
    }
    function withdraw() {
      setPayouts(list => [{ id: 'r' + Date.now(), blog: myBlog.name, value: bloggerBalance, date: TODAY, status: 'pendente' }, ...list]);
      setBalByBlog(m => ({ ...m, [blogger.blogId]: 0 }));
      notify('Saque solicitado. O valor cai em até 2 dias úteis.');
    }

    const toastEl = h('div', { className: 'app-toast', role: 'status', 'aria-live': 'polite', hidden: !toast }, toast ? toast.msg : '');
    const toSite = () => { setScreen('site'); top(); };
    if (screen === 'site') return h('div', { className: 'lp-root' }, h(Landing, { onLogin: openLogin, onSignup: openSignup, blogs }), toastEl);
    if (screen === 'login') return h('div', { className: 'lp-root' }, h(Login, { suggest, onLogin: login, onBack: toSite, onSignup: openSignup }), toastEl);
    if (screen === 'cadastro') return h('div', { className: 'lp-root' }, h(Signup, { onSignup: signup, onLogin: () => openLogin('blogueiro'), onBack: toSite }), toastEl);

    const ctx = { go, notify, campaigns, setCampaigns, cart, setCart, balance, blogs };
    const screens = {
      anunciante: {
        'Painel': () => h(AdvPainel, ctx),
        'Campanhas': () => h(AdvCampanhas, ctx),
        'Criar campanha': () => h(CreateCampaign, { ...ctx, onPublish: publishCampaign }),
        'Explorar blogs': () => h(AdvExplorar, ctx),
        'Pixel e rastreamento': () => h(AdvPixel, ctx),
        'Faturamento': () => h(AdvBilling, { balance, txns, onAdd: addBalance, campaigns, billing })
      },
      blogueiro: {
        'Painel': () => h(BlogPainel, { mySlots, blog: myBlog, fresh: blogger.fresh }),
        'Meu blog': () => h(BlogMeuBlog, { key: myBlog.id, blog: myBlog, onSave: saveBlog }),
        'Meus espaços': () => h(BlogEspacos, { mySlots, setMySlots, notify, blog: myBlog }),
        'Receita': () => h(BlogReceita, { bloggerBalance, onWithdraw: withdraw, payouts, pct, blog: myBlog, fresh: blogger.fresh }),
        'Insights': () => h(BlogInsights, { blog: myBlog, fresh: blogger.fresh }),
        'Instalar script': () => h(BlogScript, { notify, blog: myBlog, verified: blogger.verified, onVerify: verifyScript })
      },
      admin: {
        'Visão geral': () => h(AdminVisao, { campaigns, setCampaigns, blogs, pct, notify }),
        'Blogs parceiros': () => h(AdminBlogs, { blogs: blogs.map(b => slotsByBlog[b.id] ? { ...b, slots: slotsByBlog[b.id].length } : b), setBlogs, notify }),
        'Anunciantes': () => h(AdminAnunciantes, { campaigns }),
        'Campanhas': () => h(AdminCampanhas, { campaigns, setCampaigns, notify }),
        'Saques': () => h(AdminSaques, { payouts, setPayouts, notify }),
        'Configurações': () => h(AdminConfig, { pct, setPct, billing, setBilling, notify })
      }
    };
    const screenFn = screens[role][page];

    return h('div', { className: 'app-root' },
      h('div', { className: 'app-shell' },
        h('header', { className: 'app-mobilebar' },
          Wordmark(),
          h('button', { type: 'button', className: 'app-burger', 'aria-expanded': menuOpen, 'aria-controls': 'app-nav', 'aria-label': 'Abrir menu', onClick: () => setMenuOpen(true) }, ICON('M4 6h16M4 12h16M4 18h16'))),
        menuOpen ? h('div', { className: 'app-backdrop', onClick: () => setMenuOpen(false) }) : null,
        h('aside', { id: 'app-nav', ref: sideRef, className: 'app-side' + (menuOpen ? ' is-open' : '') },
          h('button', { type: 'button', className: 'app-drawer-close', 'aria-label': 'Fechar menu', onClick: () => setMenuOpen(false) }, ICON('M6 6l12 12M18 6L6 18')),
          h(B.SideNav, {
            key: role + blogger.verified, role, active: page === 'Criar campanha' ? 'Campanhas' : page, onNavigate: go, onLogout: logout,
            items: role === 'blogueiro' ? (blogger.verified ? ['Painel', 'Meu blog', 'Meus espaços', 'Receita', 'Insights', 'Instalar script'] : ['Instalar script', 'Meu blog']) : undefined,
            user: role === 'blogueiro' ? myBlog.owner.split(' ')[0] + ' · ' + myBlog.name : USER[role]
          })),
        h('main', { className: 'app-main', key: role + page }, h(Reveal, null, screenFn ? screenFn() : null))),
      toastEl);
  }

  ReactDOM.createRoot(document.getElementById('app')).render(h(App));
})();