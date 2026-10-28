// Sobe a API: cria as tabelas que faltam, põe dados de exemplo no computador e começa a escutar.
// Separado de server.js para funcionar igual com node, npm start e gerenciadores como pm2 e aaPanel.
import { config } from './config.js';
import { migrate, closeDb } from './db/index.js';
import { seed } from './db/seed.js';
import { buildApp } from './server.js';

await migrate();
// No computador o banco começa com as contas de QA e os dados de exemplo; em produção começa vazio.
if (!config.isProd && config.QA_ADMIN_PASSWORD) await seed({ quiet: true });
const app = await buildApp();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); await closeDb(); process.exit(0); });
await app.listen({ host: config.HOST, port: config.PORT });
console.log(`BlogSim API em ${config.APP_URL} (porta ${config.PORT})`);
if (!config.isProd) console.log(`E-mails (templates e caixa de saída): ${config.APP_URL}/dev/emails`);
