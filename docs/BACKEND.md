# Back-end do BlogSim

**Situação: planejado, ainda não construído.** O site em `blogsim.com.br` é só front-end: cadastro, login, aprovação e painéis funcionam simulados no navegador, e tudo some ao recarregar a página. Este documento é o plano do back-end que vai substituir essa simulação.

## O que o front já faz e o que o back-end precisa fazer

| Fluxo | No front hoje (simulado) | No back-end (a fazer) |
|---|---|---|
| Cadastro com escolha de perfil | Tela "Criar conta": Tenho um blog / Quero anunciar, com dados do blog ou da empresa (CNPJ validado) | Gravar conta, blog ou empresa; senha com argon2id; enviar e-mails |
| Status do cadastro | Pendente → Aprovado ou Negado (com motivo) | Mesmos status no banco; só `aprovado` cria sessão |
| Aprovação | Admin → Cadastros: Aprovar / Negar com motivo | Rotas de admin + e-mail para a pessoa |
| Aviso ao admin | Banner "N cadastros aguardando aprovação" | E-mail para o admin a cada cadastro novo |
| Login | E-mail e senha conferidos com SHA-256 no navegador | Sessão em cookie `httpOnly`; senha conferida no servidor |
| Lembrar de mim | Guarda só o e-mail no navegador | Mesmo comportamento; a sessão dura mais (30 dias) quando marcado |
| Esqueci a senha | Telas de pedir link e "confira seu e-mail" | Token de uso único por e-mail + tela "criar senha nova" |
| Blogueiro aprovado | Painel travado em Instalar script e Meu blog até verificar o script | O servidor visita o blog e confere o script antes de liberar |

## Fluxo de cadastro

1. A pessoa escolhe **Tenho um blog** ou **Quero anunciar** e preenche os dados.
2. A conta nasce com status **pendente**. O sistema envia:
   - para a pessoa: e-mail de boas-vindas dizendo que a análise leva até 24 horas;
   - para o admin (`ADMIN_NOTIFY_EMAIL`): "Novo blogueiro" ou "Novo anunciante", com o link para a tela Cadastros.
3. Enquanto estiver pendente, o login responde "Seu cadastro ainda está em análise" (só depois de conferir a senha, para não revelar quem tem conta).
4. O admin abre **Cadastros** e:
   - **aprova** → status `aprovado` e e-mail "Cadastro aprovado" com link para entrar;
   - **nega com motivo** → status `negado` e e-mail com o motivo. O login passa a mostrar o motivo.
5. Blogueiro aprovado entra e vê só **Instalar script** e **Meu blog**. Ao clicar em **Verificar instalação**, o servidor baixa a página do blog e procura o script com o `data-blog` dele. Achou → `script_verified_at` preenchido, blog `ativo` e painel liberado.
6. Anunciante aprovado entra direto no painel (saldo zero, sem campanhas).

## Arquitetura

Front e back-end separados, no mesmo domínio:

```
navegador ──https──▶ nginx (blogsim.com.br)
                      ├── /        → arquivos estáticos (dist/index.html)
                      └── /api/    → proxy para a API em 127.0.0.1:4100
                                      └── PostgreSQL (local, só 127.0.0.1)
```

- **API:** Node.js 20 LTS + TypeScript + Fastify. Validação com `zod`. Banco PostgreSQL com migrações (Drizzle ou Prisma). Processo gerido pelo `systemd` (ou PM2, que o aaPanel já usa).
- **Mesmo domínio para front e API**: o cookie de sessão não precisa de CORS nem de `SameSite=None`.
- **Pastas propostas:**

```
api/
  src/
    server.ts            # Fastify, headers de segurança, rate limit, rotas
    config.ts            # lê e valida o .env (falha ao subir se faltar algo)
    db/                  # conexão, schema, migrações, seed das contas de QA
    modules/
      auth/              # cadastro, login, logout, sessão, recuperar senha
      users/             # perfil da pessoa logada
      blogs/             # meu blog, espaços, verificação do script
      companies/         # dados da empresa do anunciante
      campaigns/         # campanhas, revisão pelo admin
      billing/           # saldo, recargas, regras de parcelamento
      payouts/           # saques dos blogueiros
      admin/             # cadastros, aprovações, configurações
    lib/
      mailer.ts          # nodemailer com o SMTP da Hostinger
      security.ts        # hash de senha, tokens, guards de papel e de dono
    emails/              # templates HTML + texto de cada e-mail
  .env.example
```

## Modelo de dados (principal)

| Tabela | Campos importantes |
|---|---|
| `users` | `id` (uuid), `role` (`admin` · `anunciante` · `blogueiro`), `name`, `email` (único, minúsculo), `password_hash`, `status` (`pendente` · `aprovado` · `negado`), `denial_reason`, `approved_by`, `approved_at`, `created_at` |
| `blogs` | `id`, `user_id` (único), `name`, `site`, `niche`, `city`, `uf`, `audience_estimate`, `logo_path`, `description`, `script_token`, `script_verified_at`, `status` |
| `companies` | `id`, `user_id` (único), `trade_name`, `legal_name`, `cnpj` (14 dígitos, único), `site`, `phone`, `city`, `uf` |
| `sessions` | `id`, `user_id`, `token_hash`, `expires_at`, `created_at`, `ip`, `user_agent` |
| `password_resets` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at` |
| `slots`, `campaigns`, `campaign_slots` | espaços dos blogs e campanhas que os alugam |
| `wallet_transactions`, `payouts` | recargas e gastos do anunciante; saques do blogueiro |
| `settings` | comissão, recarga mínima, parcelar a partir de, máximo de parcelas |
| `audit_log` | quem fez o quê no admin (aprovar, negar, pagar saque, mudar configuração) |

`role` e `status` **nunca** vêm do formulário: o cadastro sempre grava `pendente`, e só uma rota de admin muda o status.

## Rotas da API

| Método e rota | Quem pode | O que faz |
|---|---|---|
| `POST /api/auth/signup` | público | Cria conta pendente + blog ou empresa; envia boas-vindas e aviso ao admin |
| `POST /api/auth/login` | público | Confere senha; `pendente`/`negado` → 403 com o status; `aprovado` → cria sessão |
| `POST /api/auth/logout` | logado | Apaga a sessão |
| `GET /api/auth/me` | logado | Dados da pessoa logada e do blog ou empresa dela |
| `POST /api/auth/forgot-password` | público | Sempre responde 200 (não revela se o e-mail existe); envia link se existir |
| `POST /api/auth/reset-password` | público com token | Troca a senha, invalida o token e todas as sessões |
| `GET/PUT /api/blogs/me` | blogueiro dono | Ver e editar Meu blog (logo, endereço, nicho, cidade, estado) |
| `POST /api/blogs/me/verify-script` | blogueiro aprovado | Visita o site do blog e confere o script |
| `GET/POST/PATCH /api/blogs/me/slots` | blogueiro com script verificado | Espaços e preços |
| `GET /api/blogs` | anunciante aprovado | Explorar blogs (só ativos), filtros de nicho, estado e cidade |
| `GET/POST /api/campaigns` | anunciante aprovado | Campanhas dele |
| `GET /api/billing` · `POST /api/billing/recharges` | anunciante aprovado | Saldo e recarga, respeitando mínimo e parcelamento |
| `GET /api/payouts/me` · `POST /api/payouts` | blogueiro com script verificado | Saques |
| `GET /api/admin/signups?status=` | admin | Lista de cadastros |
| `POST /api/admin/signups/:id/approve` | admin | Aprova e envia e-mail |
| `POST /api/admin/signups/:id/deny` | admin | Nega com motivo obrigatório e envia e-mail |
| `GET/PUT /api/admin/settings` | admin | Comissão e regras de recarga |
| `POST /api/admin/campaigns/:id/approve` · `deny` | admin | Revisão de campanhas |
| `POST /api/admin/payouts/:id/paid` | admin | Marca saque como pago |

## Segurança

- **Senhas:** `argon2id` (parâmetros mínimos da OWASP: 19 MiB de memória, 2 iterações, paralelismo 1). Nunca SHA-256 puro. O SHA-256 do front atual existe só para o protótipo não ter senha legível no código.
- **Regra de senha:** 8 caracteres ou mais, com letras e números (a mesma do front). Bloquear as senhas mais vazadas.
- **Sessão:** token aleatório de 32 bytes num cookie `__Host-blogsim_session` com `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. No banco fica só o hash do token. Validade de 7 dias (30 com "Lembrar de mim"); um token novo a cada login.
- **CSRF:** `SameSite=Lax` + conferência do cabeçalho `Origin` em toda requisição que altera dados.
- **Autorização em toda rota:** um guard por papel (`requireRole('admin')`) e um guard de **dono**: qualquer rota com `:id` confere se o recurso é da pessoa logada (evita um anunciante ver a campanha de outro trocando o id na URL).
- **Status no servidor:** pendente e negado não recebem sessão; blogueiro sem script verificado só acessa as rotas de Instalar script e Meu blog.
- **Validação:** `zod` em toda entrada, rejeitando campos que não estão no schema (ninguém consegue mandar `role` ou `status` no cadastro). CNPJ conferido pelos dígitos verificadores.
- **Limites de tentativa:** login 5 por minuto por IP e por e-mail, com bloqueio progressivo; cadastro e "esqueci a senha" 3 por hora por IP.
- **Recuperar senha:** token de 32 bytes, guarda só o hash, vale 30 minutos e uma vez; ao trocar a senha, todas as sessões caem.
- **Upload da logo:** só PNG, JPG, WebP (confere os primeiros bytes, não a extensão), até 1 MB, reprocessada no servidor, nome aleatório, guardada fora da pasta pública da API. SVG fica de fora (pode carregar script).
- **Verificação do script:** o servidor só visita o domínio cadastrado do blog, com timeout curto, sem seguir redirecionamento para IP interno (evita SSRF).
- **Cabeçalhos:** HSTS, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `frame-ancestors 'none'`.
- **Erros:** mensagem genérica para o usuário; detalhe só no log do servidor. Logs nunca com senha, token ou dados de cartão.
- **Segredos:** só no `.env` do servidor (`chmod 600`, fora do git). No repositório vai apenas o `.env.example` sem valores.
- **Banco:** PostgreSQL ouvindo só em `127.0.0.1`, usuário da aplicação sem permissão de superusuário, backup diário.
- **LGPD:** coletar só o necessário, página de privacidade, e o admin ver CNPJ e telefone só na tela de Cadastros.

## E-mails pelo SMTP da Hostinger

`.env.example`:

```
APP_URL=https://blogsim.com.br
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=naoresponda@blogsim.com.br
SMTP_PASS=
MAIL_FROM="BlogSim <naoresponda@blogsim.com.br>"
ADMIN_NOTIFY_EMAIL=
```

A senha (`SMTP_PASS`) vai só no `.env` do servidor. Ela circulou num print de WhatsApp: trocar na Hostinger antes de ir para produção.

**E-mails a criar (templates em HTML + versão texto):**

| E-mail | Quando | Para |
|---|---|---|
| Cadastro recebido (boas-vindas) | Ao se cadastrar | Pessoa |
| Novo cadastro para analisar | Ao se cadastrar | Admin |
| Cadastro aprovado | Admin aprova | Pessoa |
| Cadastro não aprovado (com motivo) | Admin nega | Pessoa |
| Criar senha nova | Esqueci a senha | Pessoa |
| Senha alterada | Depois de trocar a senha | Pessoa |
| Campanha aprovada / recusada | Revisão de campanha | Anunciante |
| Saque pago | Admin marca como pago | Blogueiro |

**DNS do e-mail (Cloudflare):** MX e SPF da Hostinger já estão configurados. **Faltam o DKIM e o DMARC.** Sem eles os e-mails tendem a cair no spam. Os valores do DKIM ficam no painel de e-mail da Hostinger; o DMARC pode começar com `v=DMARC1; p=none; rua=mailto:<e-mail do admin>`.

## Deploy da API (quando for a hora)

1. PostgreSQL no servidor, ouvindo só em `127.0.0.1`.
2. API em `/www/wwwroot/blogsim-api`, rodando como usuário sem privilégio, com `systemd` ou o gerenciador Node do aaPanel, na porta `127.0.0.1:4100`.
3. No site do aaPanel, acrescentar:

```
location /api/ {
    proxy_pass http://127.0.0.1:4100;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

4. Ligar "Force HTTPS" no aaPanel e incluir `www.blogsim.com.br` no certificado.

## Contas de QA

As três contas de QA (admin master, anunciante e blogueiro) estão em `QA_CONTAS.md`, só na máquina local (no `.gitignore`). No back-end elas entram por um seed com senha via variável de ambiente, nunca no código.

## Checklist

- [ ] Projeto `api/` com Fastify, TypeScript, zod e migrações
- [ ] Tabelas `users`, `blogs`, `companies`, `sessions`, `password_resets`, `audit_log`
- [ ] Cadastro, login, logout, `me`, com argon2id e cookie de sessão
- [ ] Status pendente / aprovado / negado e rotas de aprovação do admin
- [ ] Esqueci a senha com token de uso único + tela de senha nova no front
- [ ] Mailer com SMTP da Hostinger e os templates da tabela acima
- [ ] Verificação do script do blog no servidor
- [ ] Rate limit, cabeçalhos de segurança, validação, guards de papel e de dono
- [ ] Trocar o front simulado por chamadas à API (`fetch('/api/...', { credentials: 'same-origin' })`)
- [ ] DKIM e DMARC na Cloudflare; trocar a senha do SMTP
- [ ] Deploy da API atrás do nginx, backup do banco