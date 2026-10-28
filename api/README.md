# API do BlogSim (só local)

Back-end do BlogSim: cadastro com aprovação, login, blogs e espaços, saldo, campanhas, saques, e-mails e relatório do dia. Por enquanto roda só no seu computador; o site publicado continua em modo demonstração.

## Rodar

Precisa do Node 24 ou mais novo.

```bash
cd api
npm install
cp .env.example .env      # no Windows: copy .env.example .env
```

No `.env`, preencha as três senhas de QA (`QA_ADMIN_PASSWORD`, `QA_ANUNCIANTE_PASSWORD`, `QA_BLOGUEIRO_PASSWORD`). Deixe `SMTP_PASS` vazio para os e-mails ficarem só na caixa de saída local.

```bash
npm run seed   # cria o banco em data/blogsim.db com as contas de QA e dados de exemplo
npm run dev    # sobe em http://localhost:4100
```

Antes, gere o front com `python build.py` na raiz: a API serve o `dist/index.html`. Abrindo `http://localhost:4100`, o front percebe a API e passa a usar dados reais.

| Endereço | O que é |
| --- | --- |
| `http://localhost:4100` | O BlogSim usando a API |
| `http://localhost:4100/dev/emails` | Prévia dos 17 modelos de e-mail e a caixa de saída (cada e-mail "enviado") |
| Admin → Configurações → Ambiente local | Confirmar pagamento de recarga e mandar o relatório do dia na hora |

Para recomeçar do zero, apague `data/blogsim.db` e rode `npm run seed` de novo.

## Testes

```bash
npm test
```

Rodam com banco em memória: rotas sem sessão (401), perfil errado (403), espaço de outro blog (IDOR), campos extras ignorados, CSRF por Origin, limite de tentativas no login, link de senha nova de uso único e o fluxo completo de cadastro até o saque.

## Segurança

- Senha com argon2id. O banco guarda só o hash da sessão e dos links de e-mail.
- Sessão em cookie `httpOnly` e `SameSite=Lax` (`__Host-` e `Secure` em https).
- Todo POST, PUT e PATCH confere o `Origin`. Cada rota confere perfil e dono do dado.
- Entrada validada com zod; campos fora do esperado são descartados.
- Login não revela se o e-mail existe; o status do cadastro só aparece com a senha certa.
- Logo só PNG, JPG ou WebP até 1 MB, conferido pelos bytes do arquivo.
- `.env`, `data/` e `node_modules/` ficam fora do git. Senha do SMTP nunca vai para o código.

## Organização

| Caminho | O que é |
| --- | --- |
| `src/server.js` | Monta o Fastify: helmet, cookies, limite de tentativas, checagem de Origin, rotas |
| `src/config.js` | Lê e valida o `.env` |
| `src/db/` | Esquema SQLite, helpers e seed |
| `src/lib/` | Segurança, validação, e-mail, formatos, upload |
| `src/modules/` | Rotas por assunto: auth, admin, blogs, billing, campaigns, payouts, state, dev |
| `src/emails/` | Layout e os 17 modelos de e-mail |
| `src/jobs/daily-report.js` | Relatório do dia (`npm run report:daily`) |
| `test/` | Testes com `node:test` |