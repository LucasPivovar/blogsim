/* @ds-bundle: {"format":4,"namespace":"BlogSim","components":[{"name":"Button"},{"name":"Badge"},{"name":"TextField"},{"name":"MetricCard"},{"name":"ObjectivePicker"},{"name":"SlotCard"},{"name":"CampaignTable"},{"name":"SideNav"}]} */
(function () {
  var React = window.React, h = React.createElement;
  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(' '); }
  function omit(p, keys) { var o = {}; for (var k in p) if (keys.indexOf(k) < 0) o[k] = p[k]; return o; }
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var NUM = new Intl.NumberFormat('pt-BR');
  var PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  function money(v) { return typeof v === 'number' ? BRL.format(v) : v; }
  function count(v) { return typeof v === 'number' ? NUM.format(v) : v; }
  function icon(d, extra) {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: d }), extra);
  }

  function Button(p) {
    var rest = omit(p, ['variant', 'size', 'loading', 'className', 'children']);
    return h('button', Object.assign({ type: 'button' }, rest, {
      className: cx('bs-btn', 'bs-btn-' + (p.variant || 'primary'), p.size === 'sm' && 'bs-btn-sm', p.className),
      disabled: !!(p.disabled || p.loading),
      'aria-busy': p.loading ? true : undefined
    }), p.loading ? h('span', { className: 'bs-spin', 'aria-hidden': true }) : null, p.children);
  }

  function Badge(p) {
    return h('span', { className: cx('bs-badge', 'bs-badge-' + (p.tone || 'neutral'), p.dot && 'bs-badge-dot', p.className) }, p.children);
  }

  function TextField(p) {
    var auto = React.useId();
    var id = p.id || auto, hid = id + '-hint', msg = p.error || p.hint;
    var rest = omit(p, ['label', 'hint', 'error', 'prefix', 'suffix', 'className', 'id']);
    return h('div', { className: cx('bs-field', p.error && 'bs-field-error', p.className) },
      h('label', { className: 'bs-field-label', htmlFor: id }, p.label),
      h('div', { className: 'bs-input-wrap' },
        p.prefix ? h('span', { className: 'bs-input-affix' }, p.prefix) : null,
        h('input', Object.assign({}, rest, { id: id, className: 'bs-input', 'aria-invalid': p.error ? true : undefined, 'aria-describedby': msg ? hid : undefined })),
        p.suffix ? h('span', { className: 'bs-input-affix' }, p.suffix) : null),
      msg ? h('div', { id: hid, className: 'bs-field-hint' }, msg) : null);
  }

  function Spark(p) {
    var d = p.data; if (!d || d.length < 2) return null;
    var w = 200, ht = 40, min = Math.min.apply(null, d), max = Math.max.apply(null, d), r = (max - min) || 1;
    var line = d.map(function (v, i) { return (i ? 'L' : 'M') + (i * w / (d.length - 1)).toFixed(1) + ' ' + (ht - 3 - (v - min) / r * (ht - 6)).toFixed(1); }).join(' ');
    return h('svg', { className: 'bs-spark', viewBox: '0 0 ' + w + ' ' + ht, preserveAspectRatio: 'none', 'aria-hidden': true },
      h('path', { className: 'bs-spark-area', d: line + ' L' + w + ' ' + ht + ' L0 ' + ht + ' Z' }),
      h('path', { className: 'bs-spark-line', d: line }));
  }

  function MetricCard(p) {
    var val = p.format === 'money' ? money(p.value) : p.format === 'count' ? count(p.value) : p.value;
    var delta = null;
    if (typeof p.delta === 'number') {
      var up = p.delta >= 0, good = p.invertDelta ? !up : up;
      delta = h('span', { className: cx('bs-metric-delta', good ? 'is-good' : 'is-bad') }, (up ? '▲ +' : '▼ ') + PCT.format(p.delta) + '%');
    }
    return h('div', { className: cx('bs-metric', p.className) },
      h('div', { className: 'bs-metric-label' }, p.label),
      h('div', { className: 'bs-metric-value' }, val),
      (delta || p.hint) ? h('div', { className: 'bs-metric-foot' }, delta, p.hint ? h('span', null, p.hint) : null) : null,
      p.spark ? h(Spark, { data: p.spark }) : null);
  }

  var OBJECTIVES = [
    { id: 'visitas', title: 'Visitas no site', desc: 'Leve leitores dos blogs para o seu site.', track: 'Pixel BlogSim no seu site', d: 'M5 3l6.5 17 2.4-7.1L21 10.5z' },
    { id: 'conversas', title: 'Conversas no WhatsApp', desc: 'Leitores iniciam uma conversa com você no WhatsApp.', track: 'Link redirecionador BlogSim', d: 'M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.4A8.5 8.5 0 1 1 21 11.5z' },
    { id: 'vendas', title: 'Vendas', desc: 'Leve o leitor ao produto e conte cada venda no checkout.', track: 'Pixel no checkout', d: 'M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 7H6' }
  ];

  function ObjectivePicker(p) {
    var st = React.useState(p.defaultValue || 'visitas');
    var value = p.value !== undefined ? p.value : st[0];
    var refs = React.useRef([]);
    function set(v) { if (p.value === undefined) st[1](v); if (p.onChange) p.onChange(v); }
    function onKey(e, i) {
      var n = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % 3;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + 2) % 3;
      if (n !== null) { e.preventDefault(); set(OBJECTIVES[n].id); if (refs.current[n]) refs.current[n].focus(); }
    }
    return h('div', { className: cx('bs-obj-grid', p.className), role: 'radiogroup', 'aria-label': p.label || 'Objetivo da campanha' },
      OBJECTIVES.map(function (o, i) {
        var on = o.id === value;
        var extra = o.id === 'vendas' ? [h('circle', { key: 'a', cx: 9, cy: 20, r: 1.4 }), h('circle', { key: 'b', cx: 18, cy: 20, r: 1.4 })] : null;
        return h('button', {
          key: o.id, ref: function (el) { refs.current[i] = el; }, type: 'button', role: 'radio', 'aria-checked': on, tabIndex: on ? 0 : -1,
          className: 'bs-obj bs-obj-' + o.id, onClick: function () { set(o.id); }, onKeyDown: function (e) { onKey(e, i); }
        },
          h('span', { className: 'bs-obj-icon' }, icon(o.d, extra)),
          h('span', { className: 'bs-obj-title' }, o.title),
          h('span', { className: 'bs-obj-desc' }, o.desc),
          h('span', { className: 'bs-obj-track' }, o.track));
      }));
  }

  var PLACEMENTS = {
    popup: { label: 'Pop-up', r: [14, 14, 38, 24] },
    lateral: { label: 'Lateral', r: [46, 16, 14, 30] },
    banner: { label: 'Banner topo', r: [6, 6, 54, 8] },
    inline: { label: 'No meio do post', r: [6, 28, 36, 8] }
  };

  function SlotCard(p) {
    var st = React.useState(!!p.defaultSelected);
    var sel = p.selected !== undefined ? p.selected : st[0];
    function toggle() { var n = !sel; if (p.selected === undefined) st[1](n); if (p.onToggle) p.onToggle(n); }
    var pl = PLACEMENTS[p.placement] || PLACEMENTS.lateral, r = pl.r;
    return h('article', { className: cx('bs-slot', sel && 'is-selected', p.className) },
      h('svg', { className: 'bs-wf', viewBox: '0 0 66 52', role: 'img', 'aria-label': 'Posição: ' + pl.label },
        h('rect', { className: 'bs-wf-page', x: 1, y: 1, width: 64, height: 50, rx: 6 }),
        [18, 23, 40, 45].map(function (y, i) { return h('rect', { key: i, className: 'bs-wf-text', x: 6, y: y, width: i % 2 ? 28 : 36, height: 3, rx: 1.5 }); }),
        p.placement !== 'lateral' ? h('rect', { className: 'bs-wf-text', x: 46, y: 16, width: 14, height: 30, rx: 2 }) : null,
        h('rect', { className: 'bs-wf-slot', x: r[0], y: r[1], width: r[2], height: r[3], rx: 2 })),
      h('div', { className: 'bs-slot-body' },
        h('div', { className: 'bs-slot-head' }, h('h3', { className: 'bs-slot-blog' }, p.blog), p.niche ? h(Badge, null, p.niche) : null),
        h('div', { className: 'bs-slot-meta' }, pl.label + (p.audience ? ' · ' + count(p.audience) + ' leitores/mês' : '')),
        h('div', { className: 'bs-slot-price' }, h('strong', null, money(p.price)), ' / ' + (p.period || 'semana'))),
      h(Button, { variant: sel ? 'secondary' : 'accent', size: 'sm', 'aria-pressed': sel, onClick: toggle }, sel ? 'Selecionado' : 'Alugar espaço'));
  }

  var OBJ_META = { visitas: ['brand', 'Visitas no site', 'visitas'], conversas: ['teal', 'Conversas no WhatsApp', 'conversas'], vendas: ['accent', 'Vendas', 'vendas'] };
  var STATUS = { ativa: ['success', 'Ativa'], pausada: ['warning', 'Pausada'], revisao: ['neutral', 'Em revisão'], encerrada: ['neutral', 'Encerrada'] };

  function CampaignTable(p) {
    var rows = p.rows || [];
    var head = ['Campanha', 'Objetivo', 'Status', 'Investido', 'Cliques', 'Resultados', 'Custo por resultado'];
    return h('div', { className: cx('bs-table-wrap', p.className) },
      h('table', { className: 'bs-table' },
        h('thead', null, h('tr', null, head.map(function (t, i) { return h('th', { key: t, className: i > 2 ? 'num' : undefined, scope: 'col' }, t); }))),
        h('tbody', null, rows.length ? rows.map(function (r, i) {
          var o = OBJ_META[r.objective] || OBJ_META.visitas, s = STATUS[r.status] || STATUS.revisao;
          return h('tr', { key: r.id || i },
            h('td', null, h('div', { className: 'bs-table-name' }, r.name), r.blogNames && r.blogNames.length ? h('div', { className: 'bs-table-sub bs-table-blogs' }, r.blogNames.join(', ')) : r.blogs ? h('div', { className: 'bs-table-sub' }, r.blogs + (r.blogs === 1 ? ' blog' : ' blogs')) : null),
            h('td', null, h(Badge, { tone: o[0] }, o[1])),
            h('td', null, h(Badge, { tone: s[0], dot: true }, s[1])),
            h('td', { className: 'num' }, money(r.invested)),
            h('td', { className: 'num' }, count(r.clicks)),
            h('td', { className: 'num' }, count(r.results) + ' ' + o[2]),
            h('td', { className: 'num' }, r.results ? money(r.invested / r.results) : '—'));
        }) : h('tr', null, h('td', { colSpan: 7, className: 'bs-table-empty' }, p.emptyText || 'Nenhuma campanha ainda. Crie a primeira para começar a anunciar.')))));
  }

  var ROLES = {
    admin: { label: 'Admin master', tone: 'neutral', items: ['Visão geral', 'Blogs parceiros', 'Anunciantes', 'Campanhas', 'Repasses', 'Configurações'] },
    anunciante: { label: 'Anunciante', tone: 'brand', items: ['Painel', 'Campanhas', 'Explorar blogs', 'Pixel e rastreamento', 'Faturamento'] },
    blogueiro: { label: 'Dono do blog', tone: 'teal', items: ['Painel', 'Meus espaços', 'Receita', 'Insights', 'Instalar script'] }
  };

  function RoleSwitch(p) {
    var st = React.useState(false), open = st[0], setOpen = st[1];
    var ref = React.useRef(null);
    var cur = ROLES[p.role] || ROLES.anunciante;
    React.useEffect(function () {
      if (!open) return;
      function down(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
      function key(e) { if (e.key === 'Escape') setOpen(false); }
      document.addEventListener('mousedown', down);
      document.addEventListener('keydown', key);
      return function () { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
    }, [open]);
    return h('div', { className: 'bs-nav-role', ref: ref },
      h('button', { type: 'button', className: 'bs-nav-role-btn', 'aria-haspopup': 'true', 'aria-expanded': open, 'aria-label': 'Perfil: ' + cur.label + '. Trocar perfil', onClick: function () { setOpen(!open); } },
        h(Badge, { tone: cur.tone }, cur.label),
        h('svg', { className: 'bs-nav-role-chev', width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: 'm6 9 6 6 6-6' }))),
      open ? h('ul', { className: 'bs-nav-role-menu' }, Object.keys(ROLES).map(function (k) {
        var r = ROLES[k], on = k === p.role;
        return h('li', { key: k }, h('button', {
          type: 'button', className: 'bs-nav-role-opt', 'aria-current': on ? 'true' : undefined,
          onClick: function () { setOpen(false); if (!on) p.onChange(k); }
        }, h(Badge, { tone: r.tone }, r.label), on ? h('span', { className: 'bs-nav-role-now' }, 'Atual') : null));
      })) : null);
  }

  function SideNav(p) {
    var role = ROLES[p.role] || ROLES.anunciante, items = p.items || role.items;
    var st = React.useState(items[0]);
    var active = p.active !== undefined ? p.active : st[0];
    return h('nav', { className: cx('bs-nav', p.className), 'aria-label': 'Navegação principal' },
      h('span', { className: 'bs-wordmark' }, 'Blog', h('b', null, 'Sim')),
      p.onRoleChange ? h(RoleSwitch, { role: p.role, onChange: p.onRoleChange }) : h(Badge, { tone: role.tone }, role.label),
      h('ul', { className: 'bs-nav-list' }, items.map(function (it) {
        return h('li', { key: it }, h('button', {
          type: 'button', className: 'bs-nav-item', 'aria-current': it === active ? 'page' : undefined,
          onClick: function () { if (p.active === undefined) st[1](it); if (p.onNavigate) p.onNavigate(it); }
        }, it));
      })),
      p.user ? h('div', { className: 'bs-nav-user' }, h('span', { className: 'bs-nav-avatar', 'aria-hidden': true }, p.user.charAt(0)), h('span', { className: 'bs-nav-name' }, p.user), p.onLogout ? h('button', { type: 'button', className: 'bs-nav-logout', onClick: p.onLogout }, 'Sair') : null) : null);
  }

  window.BlogSim = Object.assign(window.BlogSim || {}, {
    Button: Button, Badge: Badge, TextField: TextField, MetricCard: MetricCard,
    ObjectivePicker: ObjectivePicker, SlotCard: SlotCard, CampaignTable: CampaignTable, SideNav: SideNav
  });
})();