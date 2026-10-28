// Dados iniciais: contas de QA (senhas vêm do .env), blogs de exemplo e algumas campanhas.
// Roda só com o banco vazio. Para recomeçar: apague data/blogsim.db e rode de novo.
import { randomBytes } from 'node:crypto';
import { config } from '../config.js';
import { db, one, run, id, tx } from './index.js';
import { hashPassword } from '../lib/security.js';

const DAY = 86400000;
const ago = days => new Date(Date.now() - days * DAY).toISOString();
const ahead = days => new Date(Date.now() + days * DAY).toISOString();

export async function seed({ quiet = false } = {}) {
  if (one('SELECT 1 FROM users LIMIT 1')) { if (!quiet) console.log('O banco já tem dados. Nada foi feito.'); return false; }
  const missing = ['QA_ADMIN_PASSWORD', 'QA_ANUNCIANTE_PASSWORD', 'QA_BLOGUEIRO_PASSWORD'].filter(k => !config[k]);
  if (missing.length) throw new Error(`Defina no .env: ${missing.join(', ')} (as senhas das contas de QA).`);

  const pw = {
    admin: await hashPassword(config.QA_ADMIN_PASSWORD),
    anunciante: await hashPassword(config.QA_ANUNCIANTE_PASSWORD),
    blogueiro: await hashPassword(config.QA_BLOGUEIRO_PASSWORD),
    locked: await hashPassword(randomBytes(24).toString('hex')) // contas de exemplo: ninguém sabe a senha
  };

  tx(() => {
    const user = (role, name, email, hash, status, extra = {}) => {
      const uid = id();
      run('INSERT INTO users (id, role, name, email, password_hash, status, denial_reason, email_verified_at, approved_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        uid, role, name, email, hash, status, extra.reason || null, ago(extra.days ?? 20), status === 'aprovado' ? ago((extra.days ?? 20) - 1) : null, ago(extra.days ?? 20));
      return uid;
    };
    const admin = user('admin', 'Equipe BlogSim', 'admin.qa@blogsim.com.br', pw.admin, 'aprovado', { days: 30 });
    const adv = user('anunciante', 'Carla Mendes', 'anunciante.qa@blogsim.com.br', pw.anunciante, 'aprovado', { days: 25 });
    const blogger = user('blogueiro', 'Renata Alves', 'blogueiro.qa@blogsim.com.br', pw.blogueiro, 'aprovado', { days: 28 });
    const leo = user('blogueiro', 'Léo Martins', 'leo@bikeurbana.com.br', pw.locked, 'pendente', { days: 1 });
    const otica = user('anunciante', 'Beatriz Souza', 'marketing@oticavisaoclara.com.br', pw.locked, 'pendente', { days: 1 });
    const aposta = user('anunciante', 'Rafael Costa', 'contato@apostaganha.bet', pw.locked, 'negado', { days: 6, reason: 'Apostas não são aceitas como anunciantes no BlogSim.' });

    const company = (uid, trade, legal, cnpj, site, phone, city, uf) =>
      run('INSERT INTO companies (id, user_id, trade_name, legal_name, cnpj, site, phone, city, uf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id(), uid, trade, legal, cnpj, site, phone, city, uf);
    company(adv, 'Passo Certo Calçados', 'Passo Certo Calçados Ltda.', '11444777000161', 'passocerto.com.br', '11980001234', 'São Paulo', 'SP');
    company(otica, 'Ótica Visão Clara', 'Visão Clara Comércio Óptico Ltda.', '27394651000160', 'oticavisaoclara.com.br', '31998765432', 'Belo Horizonte', 'MG');
    company(aposta, 'Aposta Ganha', 'AG Entretenimento Ltda.', '40512883000133', 'apostaganha.bet', '21977770000', 'Rio de Janeiro', 'RJ');

    // Blogs: os mesmos da landing. O primeiro é da blogueira de QA; o Bike Urbana espera aprovação.
    const BLOGS = [
      [blogger, 'Viagem com Criança', 'viagemcomcrianca.com.br', 'Viagem', 'Curitiba', 'PR', 42000, '#0e7490', [['lateral', 280], ['banner', 350], ['inline', 220]]],
      [null, 'Cozinha da Vó Nena', 'cozinhadavonena.com.br', 'Culinária', 'Belo Horizonte', 'MG', 18500, '#b45309', [['popup', 190], ['inline', 160]]],
      [null, 'Treino em Casa', 'treinoemcasa.com.br', 'Fitness', 'São Paulo', 'SP', 61000, '#be123c', [['inline', 420], ['lateral', 300]]],
      [null, 'Grana no Bolso', 'granonobolso.com.br', 'Finanças', 'Rio de Janeiro', 'RJ', 73000, '#15803d', [['banner', 520], ['popup', 460]]],
      [null, 'Pet Feliz', 'petfeliz.com.br', 'Pets', 'Porto Alegre', 'RS', 27500, '#6d28d9', [['lateral', 210]]],
      [null, 'Código Simples', 'codigosimples.com.br', 'Tecnologia', 'Florianópolis', 'SC', 39000, '#1e293b', [['inline', 330], ['banner', 380]]],
      [null, 'Mãe de Primeira', 'maedeprimeira.com.br', 'Maternidade', 'São Paulo', 'SP', 55000, '#be185d', [['popup', 390], ['lateral', 260]]],
      [leo, 'Bike Urbana', 'bikeurbana.com.br', 'Esportes', 'Recife', 'PE', 15800, '#0369a1', [['lateral', 150]]]
    ];
    const slotOf = {};
    for (const [owner, name, site, niche, city, uf, audience, color, slots] of BLOGS) {
      const bid = id();
      const pending = owner === leo;
      run(`INSERT INTO blogs (id, user_id, name, site, niche, city, uf, audience, color, script_token, script_verified_at, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, bid, owner, name, site, niche, city, uf, audience, color,
        'BL-' + randomBytes(4).toString('hex').toUpperCase(), pending ? null : ago(25), pending ? 'pendente' : 'ativo', ago(30));
      for (const [placement, price] of slots) {
        const sid = id();
        run('INSERT INTO slots (id, blog_id, placement, price_cents, active) VALUES (?, ?, ?, ?, 1)', sid, bid, placement, price * 100);
        slotOf[`${name}:${placement}`] = { id: sid, blogId: bid, price: price * 100 };
      }
    }

    // Saldo e campanhas do anunciante de QA.
    run("INSERT INTO wallet_tx (id, user_id, kind, amount_cents, method, status, description, created_at, paid_at) VALUES (?, ?, 'recarga', 500000, 'pix', 'pago', 'Recarga via Pix', ?, ?)", id(), adv, ago(20), ago(20));
    const campaign = (name, objective, status, weeks, slotKeys, stats, startedDaysAgo) => {
      const cid = id();
      const chosen = slotKeys.map(k => slotOf[k]);
      const total = chosen.reduce((t, s) => t + s.price, 0) * weeks;
      const starts = status === 'revisao' ? null : ago(startedDaysAgo);
      const ends = status === 'revisao' ? null : status === 'encerrada' ? ago(1) : ahead(weeks * 7 - startedDaysAgo);
      run(`INSERT INTO campaigns (id, advertiser_id, name, objective, status, weeks, total_cents, ad_title, ad_text, ad_link, views, clicks, results, reviewed_by, starts_at, ends_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, cid, adv, name, objective, status, weeks, total, 'Tênis de corrida com 30% off', 'Frete grátis até domingo.', 'passocerto.com.br',
        stats[0], stats[1], stats[2], status === 'revisao' ? null : admin, starts, ends, ago((startedDaysAgo || 0) + 1));
      for (const s of chosen) {
        run('INSERT INTO campaign_slots (campaign_id, slot_id, price_cents) VALUES (?, ?, ?)', cid, s.id, s.price);
        if (status !== 'revisao') run('INSERT INTO earnings (id, blog_id, campaign_id, amount_cents, created_at) VALUES (?, ?, ?, ?, ?)', id(), s.blogId, cid, Math.round(s.price * weeks * 0.8), starts);
      }
      run("INSERT INTO wallet_tx (id, user_id, kind, amount_cents, status, description, campaign_id, created_at) VALUES (?, ?, 'campanha', ?, 'pago', ?, ?, ?)",
        id(), adv, -total, `${name} · ${chosen.length} ${chosen.length > 1 ? 'espaços' : 'espaço'}`, cid, ago((startedDaysAgo || 0) + 1));
    };
    campaign('Black Friday – Tênis', 'vendas', 'ativa', 2, ['Treino em Casa:lateral', 'Viagem com Criança:banner'], [41200, 1380, 46], 5);
    campaign('Atendimento pelo WhatsApp', 'conversas', 'ativa', 1, ['Grana no Bolso:banner'], [3120, 94, 21], 3);
    campaign('Lançamento do site', 'visitas', 'encerrada', 2, ['Código Simples:inline', 'Viagem com Criança:lateral'], [52300, 2210, 1890], 15);
    campaign('Cupom de inverno', 'vendas', 'revisao', 1, ['Mãe de Primeira:popup'], [0, 0, 0], 0);

    // Um saque já pago da blogueira de QA.
    const b1 = slotOf['Viagem com Criança:lateral'].blogId;
    run("INSERT INTO payouts (id, blog_id, amount_cents, status, requested_at, paid_at) VALUES (?, ?, 40000, 'pago', ?, ?)", id(), b1, ago(8), ago(7));
  });
  if (!quiet) console.log('Dados iniciais criados: 3 contas de QA, 8 blogs, 4 campanhas.');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  await seed();
  db.close();
}