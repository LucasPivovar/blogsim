-- Esquema do BlogSim (PostgreSQL). Dinheiro sempre em centavos (inteiro). Datas com fuso (timestamptz).
-- Só CREATE ... IF NOT EXISTS: a API roda este arquivo na subida e ele não apaga nada.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'anunciante', 'blogueiro')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'negado')),
  denial_reason TEXT,
  email_verified_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  ip TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Tokens de uso único enviados por e-mail: confirmar e-mail e criar senha nova.
CREATE TABLE IF NOT EXISTS email_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS blogs (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  site TEXT NOT NULL,
  niche TEXT NOT NULL,
  city TEXT NOT NULL,
  uf TEXT NOT NULL CHECK (length(uf) = 2),
  audience INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#2a49de',
  logo_path TEXT,
  description TEXT NOT NULL DEFAULT '',
  script_token TEXT NOT NULL,
  script_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'script', 'ativo', 'negado')),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  trade_name TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  cnpj TEXT NOT NULL UNIQUE CHECK (length(cnpj) = 14),
  site TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  uf TEXT NOT NULL CHECK (length(uf) = 2)
);

CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  blog_id TEXT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  placement TEXT NOT NULL CHECK (placement IN ('popup', 'lateral', 'banner', 'inline')),
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (blog_id, placement)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  advertiser_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  objective TEXT NOT NULL CHECK (objective IN ('visitas', 'conversas', 'vendas')),
  status TEXT NOT NULL DEFAULT 'revisao' CHECK (status IN ('revisao', 'ativa', 'pausada', 'encerrada', 'recusada')),
  weeks INTEGER NOT NULL CHECK (weeks BETWEEN 1 AND 12),
  total_cents INTEGER NOT NULL,
  ad_title TEXT NOT NULL,
  ad_text TEXT NOT NULL DEFAULT '',
  ad_link TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  results INTEGER NOT NULL DEFAULT 0,
  review_note TEXT,
  reviewed_by TEXT REFERENCES users(id),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS campaigns_advertiser ON campaigns(advertiser_id);

CREATE TABLE IF NOT EXISTS campaign_slots (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL REFERENCES slots(id),
  price_cents INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, slot_id)
);

-- Saldo do anunciante: recargas (+), gastos com campanha (-) e estornos (+).
CREATE TABLE IF NOT EXISTS wallet_tx (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('recarga', 'campanha', 'estorno')),
  amount_cents INTEGER NOT NULL,
  method TEXT CHECK (method IN ('pix', 'cartao')),
  installments INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'pago', 'falhou')),
  description TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wallet_user ON wallet_tx(user_id);

-- Ganhos do blogueiro por campanha (já sem a comissão) e saques.
CREATE TABLE IF NOT EXISTS earnings (
  id TEXT PRIMARY KEY,
  blog_id TEXT NOT NULL REFERENCES blogs(id),
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  blog_id TEXT NOT NULL REFERENCES blogs(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago')),
  requested_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

-- Todo e-mail gerado fica registrado: enviado pelo SMTP, simulado (sem SMTP) ou com falha.
CREATE TABLE IF NOT EXISTS email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  template TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('enviado', 'simulado', 'falhou')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS campaign_slots_slot ON campaign_slots(slot_id);
CREATE INDEX IF NOT EXISTS earnings_blog ON earnings(blog_id);
CREATE INDEX IF NOT EXISTS payouts_blog ON payouts(blog_id);
CREATE INDEX IF NOT EXISTS email_tokens_user ON email_tokens(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS blogs_script_token ON blogs(script_token);

-- Medição feita pelo script do blog: visualizações e cliques por campanha, espaço e dia (horário de Brasília).
CREATE TABLE IF NOT EXISTS ad_stats (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  slot_id TEXT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, slot_id, day)
);

-- Quem já foi contado hoje (hash de IP + navegador + anúncio). Recarregar a página não infla o número.
CREATE TABLE IF NOT EXISTS ad_seen (
  key TEXT PRIMARY KEY,
  day DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS ad_seen_day ON ad_seen(day);