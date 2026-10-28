// Tudo que o painel da pessoa logada precisa, num formato igual ao que o front já usa.
// Cada perfil recebe só os próprios dados; o admin recebe a visão da plataforma.
import { one, all, getSettings } from '../db/index.js';
import { requireUser } from '../lib/security.js';
import { profile } from './auth.js';
import { blogView, slotView } from './blogs.js';
import { campaignView } from './campaigns.js';
import { balanceCents, txView } from './billing.js';
import { availableCents, payoutView } from './payouts.js';
import { signupView } from './admin.js';
import { reais, brDate } from '../lib/format.js';

const BLOGS = `SELECT b.*, u.name AS owner, (SELECT COUNT(*) FROM slots s WHERE s.blog_id = b.id) AS slot_count FROM blogs b LEFT JOIN users u ON u.id = b.user_id`;
const PAYOUTS = 'SELECT p.*, b.name AS blog_name FROM payouts p JOIN blogs b ON b.id = p.blog_id';

// Espaços no formato da lista de exploração do front (com os dados do blog junto).
function marketSlots() {
  return all(`SELECT s.*, b.name, b.niche, b.audience, b.city, b.uf, b.color FROM slots s JOIN blogs b ON b.id = s.blog_id WHERE b.status = 'ativo' AND s.active = 1`)
    .map(s => ({ ...slotView(s), blog: s.name, name: s.name, niche: s.niche, audience: s.audience, city: s.city, uf: s.uf, color: s.color }));
}

export default async function state(app) {
  app.get('/api/state', async req => {
    const user = requireUser(req);
    const settings = getSettings();
    const base = { me: profile(user), settings };

    if (user.role === 'anunciante') {
      return { ...base,
        blogs: all(`${BLOGS} WHERE b.status = 'ativo'`).map(blogView), slots: marketSlots(),
        campaigns: all('SELECT * FROM campaigns WHERE advertiser_id = ? ORDER BY created_at DESC', user.id).map(campaignView),
        balance: reais(balanceCents(user.id)),
        txns: all('SELECT * FROM wallet_tx WHERE user_id = ? ORDER BY created_at DESC', user.id).map(txView) };
    }

    if (user.role === 'blogueiro') {
      const blog = one(`${BLOGS} WHERE b.user_id = ?`, user.id);
      const mySlots = all('SELECT * FROM slots WHERE blog_id = ? ORDER BY placement', blog.id).map(s => {
        const rent = one(`SELECT c.ends_at, co.trade_name FROM campaign_slots cs JOIN campaigns c ON c.id = cs.campaign_id JOIN companies co ON co.user_id = c.advertiser_id
                          WHERE cs.slot_id = ? AND c.status = 'ativa' ORDER BY c.ends_at DESC LIMIT 1`, s.id);
        return { ...slotView(s), rent: rent ? { adv: rent.trade_name, until: brDate(rent.ends_at) } : null };
      });
      const earned = one('SELECT COALESCE(SUM(amount_cents), 0) AS v, COUNT(*) AS n FROM earnings WHERE blog_id = ?', blog.id);
      return { ...base, blog: blogView(blog), mySlots, fresh: earned.n === 0, received: reais(earned.v),
        balance: reais(availableCents(blog.id)),
        payouts: all(`${PAYOUTS} WHERE p.blog_id = ? ORDER BY p.requested_at DESC`, blog.id).map(payoutView) };
    }

    // admin
    return { ...base,
      users: all("SELECT * FROM users WHERE role <> 'admin' ORDER BY created_at DESC").map(signupView),
      blogs: all(`${BLOGS} ORDER BY b.created_at`).map(blogView), slots: marketSlots(),
      campaigns: all('SELECT * FROM campaigns ORDER BY created_at DESC').map(campaignView),
      payouts: all(`${PAYOUTS} ORDER BY p.requested_at DESC`).map(payoutView),
      pendingRecharges: all("SELECT w.*, co.trade_name FROM wallet_tx w JOIN companies co ON co.user_id = w.user_id WHERE w.kind = 'recarga' AND w.status = 'pendente' ORDER BY w.created_at")
        .map(t => ({ ...txView(t), advertiser: t.trade_name })) };
  });
}