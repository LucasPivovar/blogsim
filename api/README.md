# API do BlogSim

Back-end do BlogSim: cadastro com aprovação, login, blogs e espaços, saldo, campanhas, saques, medição dos anúncios nos blogs, e-mails e relatório do dia. Por enquanto roda só no computador; o site publicado continua em modo demonstração.

## Rodar no computador

Precisa do Node 22.13 ou mais novo. Não precisa instalar banco: no computador a API usa um PostgreSQL embutido (PGlite), guardado em `data/pg`.

```bash
cd api
npm install
cp .env.example .env      # no Windows: copy .env.example .env
```

No `.env`, preencha as três senhas de QA (`QA_ADMIN_PASSWORD`, `QA_ANUNCIANTE_PASSWORD`, `QA_BLOGUEIRO_PASSWORD`). Antes, gere o front com `python build.py` na raiz: a API serve o `dist/index.html`.

```bash
npm run dev    # sobe em http://localhost:4100 e, na primeira vez, cria as contas de QA e os dados de exemplo
```

| Endereço | O que é |
| --- | --- |
| `http://localhost:4100` | O BlogSim usando a API |
| `http://localhost:4100/dev/emails` | Prévia dos 17 modelos de e-mail e a caixa de saída |
| `http://localhost:4100/dev/blog` | Blogs de teste com o script instalado: mostra os anúncios no ar e conta visualizações e cliques |
| Admin → Configurações → Ambiente local | Confirmar pagamento de recarga e mandar o relatório do dia na hora |

Para recomeçar do zero, pare a API e apague a pasta `data/pg`. O banco embutido só aceita um processo por vez; com a API ligada, use os botões do admin em vez de `npm run seed` ou `npm run report:daily`.

## E-mail (SMTP da Hostinger)

O `.env` já vem com `smtp.hostinger.com`, porta 465 e o usuário `naoresponda@blogsim.com.br`. Falta só a senha:

1. Cole a senha da caixa em `SMTP_PASS=` no `.env` (o arquivo nunca vai para o git).
2. Teste: `npm run mail:test -- seu@email.com`. O comando confere o login e manda um e-mail de exemplo.
3. Reinicie a API.

Fora de produção, e-mail de verdade só sai para os domínios de `MAIL_ONLY_TO` (padrão: `blogsim.com.br`). Os outros ficam como "simulado" em `/dev/emails`, para as contas de exemplo (que usam domínios de empresas reais) nunca receberem nada. Para receber no seu Gmail durante os testes, acrescente o endereço: `MAIL_ONLY_TO=blogsim.com.br,voce@gmail.com`.

## Medição nos blogs

O blogueiro instala `<script async src="https://blogsim.com.br/slots.js" data-blog="BL-XXXX">` no cabeçalho do blog. O script:

- busca os anúncios no ar daquele blog (`GET /api/ads/BL-XXXX`) e coloca cada um no lugar dele: banner no topo, meio do post depois do segundo parágrafo, pop-up após 4 segundos (uma vez por visita) e lateral onde o blog marcar `<div data-blogsim="lateral"></div>`;
- conta uma **visualização** quando metade do anúncio aparece na tela e um **clique** quando o leitor clica (o clique passa por `/c/...` e segue para o site do anunciante);
- conta cada pessoa uma vez por anúncio por dia (hash de IP e navegador, sem guardar o IP), ignora robôs e só aceita links assinados com `TRACK_SECRET`.

Os números ficam por dia na tabela `ad_stats` e somados na campanha. O relatório do dia (`npm run report:daily`, de preferência às 23h) manda os números de hoje e o total.

## Testes

```bash
npm test
```

Rodam com um Postgres em memória: rotas sem sessão (401), perfil errado (403), espaço de outro blog (IDOR), campos extras ignorados, CSRF por Origin, limite de tentativas, link de senha nova de uso único, fluxo completo de cadastro até o saque e a medição (script, visualização, clique, robô, link adulterado e relatório).

## Subir para produção (quando for a hora)

No servidor:

1. **PostgreSQL** (feito em 28/10/2026): PostgreSQL 14 instalado pelo apt, escutando só em 127.0.0.1. Usuário e banco `blogsim` criados, com as tabelas. O `DATABASE_URL` completo, com a senha, está em `/root/blogsim-db.env` no servidor (só o root lê); copie a linha para o `.env` de produção. Fora do aaPanel: o banco não aparece na aba Bancos de Dados do painel.
2. **Node 22** (o servidor tem o 20; o aaPanel instala outra versão no gerenciador de Node).
3. **Porta**: a 4100 já é usada pelo criptobot.pro. Use `PORT=4110`, por exemplo.
4. **`.env` de produção**: `NODE_ENV=production`, `APP_URL=https://blogsim.com.br`, `DATABASE_URL=postgres://blogsim:SENHA@127.0.0.1:5432/blogsim`, `TRACK_SECRET` (gerado), `SMTP_PASS`, `ADMIN_NOTIFY_EMAIL`. A API não sobe em produção sem https, sem `TRACK_SECRET` ou com banco embutido.
5. **nginx**: mandar para `127.0.0.1:4110` os caminhos `/api/`, `/c/`, `/slots.js` e `/uploads/`; o resto continua servindo o `dist/index.html`.
6. `npm ci --omit=dev`, subir com o gerenciador de Node do aaPanel (ou pm2) e agendar `npm run report:daily` no cron às 23h.
7. Criar as contas reais de admin (as contas de QA e os dados de exemplo não são criados em produção).

Enquanto isso não acontece, o front publicado continua em modo demonstração: sem `/api/health`, ele não chama a API.

## Segurança

- Senha com argon2id. O banco guarda só o hash da sessão e dos links de e-mail.
- Sessão em cookie `httpOnly` e `SameSite=Lax` (`__Host-` e `Secure` em https).
- Todo POST, PUT e PATCH confere o `Origin`. Cada rota confere perfil e dono do dado.
- Dinheiro protegido contra cliques duplos e abas simultâneas: saldo e saque travam a linha durante a conta; aprovar, recusar, confirmar recarga e pagar saque só mudam o que ainda está pendente.
- Entrada validada com zod; campos fora do esperado são descartados.
- Login não revela se o e-mail existe; o status do cadastro só aparece com a senha certa.
- Anúncio no blog entra só como texto, dentro de shadow DOM; o link de destino só aceita http(s).
- `.env`, `data/` e `node_modules/` ficam fora do git. Senha do SMTP nunca vai para o código.

## Organização

| Caminho | O que é |
| --- | --- |
| `src/server.js` | Monta o Fastify: helmet, cookies, limite de tentativas, checagem de Origin, rotas |
| `src/config.js` | Lê e valida o `.env` |
| `src/db/` | Conexão PostgreSQL (ou PGlite no computador), esquema e seed |
| `src/lib/` | Segurança, validação, e-mail, formatos, upload |
| `src/modules/` | Rotas por assunto: auth, admin, blogs, billing, campaigns, payouts, state, ads (script e medição), dev |
| `src/emails/` | Layout e os 17 modelos de e-mail |
| `src/jobs/` | Relatório do dia e teste de SMTP |
| `test/` | Testes com `node:test` |
