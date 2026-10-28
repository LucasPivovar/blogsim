// Templates dos e-mails do BlogSim. Cada um tem: assunto, quem recebe, quando é enviado,
// o corpo e um exemplo de dados para a página de visualização (/dev/emails).
import { layout, p, muted, button, info, table, highlight, esc, BRL, NUM } from './layout.js';

const ROLE = { anunciante: 'anunciante', blogueiro: 'blogueiro' };
const PLACE = { popup: 'Pop-up', lateral: 'Lateral', banner: 'Banner topo', inline: 'No meio do post' };
const first = name => esc(String(name || '').split(' ')[0]);

export const TEMPLATES = {
  confirmar_email: {
    label: 'Confirmação de conta', to: 'Pessoa que se cadastrou', when: 'Logo depois do cadastro',
    subject: () => 'Confirme seu e-mail no BlogSim',
    body: d => ({
      preheader: 'Falta um clique para enviar seu cadastro para análise.',
      title: 'Confirme seu e-mail',
      blocks: [p(`Olá, ${first(d.name)}. Recebemos o seu cadastro no BlogSim.`),
        p('Confirme que este e-mail é seu para a gente enviar o cadastro para análise.'),
        button('Confirmar e-mail', d.link), muted('O link vale por 24 horas. Se você não se cadastrou no BlogSim, ignore este e-mail.')]
    }),
    sample: { name: 'Marina Lopes', link: 'https://blogsim.com.br/api/auth/verify-email?token=exemplo' }
  },

  boas_vindas: {
    label: 'Boas-vindas', to: 'Pessoa que se cadastrou', when: 'Depois de confirmar o e-mail',
    subject: () => 'Boas-vindas ao BlogSim',
    body: d => ({
      preheader: 'Seu cadastro está em análise. Respondemos em até 24 horas.',
      title: `Boas-vindas, ${first(d.name)}`,
      blocks: [p('Seu e-mail está confirmado e o seu cadastro já está com a nossa equipe.'),
        info([['Tipo de conta', d.role === 'blogueiro' ? 'Blogueiro' : 'Anunciante'], [d.role === 'blogueiro' ? 'Blog' : 'Empresa', d.org], ['Situação', 'Em análise']]),
        p('A análise leva até <b>24 horas</b>. Você recebe um e-mail assim que ela terminar.'),
        d.role === 'blogueiro'
          ? muted('Depois da aprovação, você entra no painel e instala o script do BlogSim no seu blog. É ele que coloca os anúncios nos espaços alugados.')
          : muted('Depois da aprovação, você entra no painel, adiciona saldo e escolhe os blogs onde quer anunciar.')]
    }),
    sample: { name: 'Marina Lopes', role: 'blogueiro', org: 'Café com Livros' }
  },

  admin_novo_cadastro: {
    label: 'Aviso de cadastro novo', to: 'Admin', when: 'Quando alguém confirma o e-mail do cadastro',
    subject: d => `Novo ${d.role === 'blogueiro' ? 'blogueiro' : 'anunciante'} para aprovar: ${d.org}`,
    body: d => ({
      preheader: `${d.org} está aguardando aprovação.`,
      title: d.role === 'blogueiro' ? 'Novo blogueiro para aprovar' : 'Novo anunciante para aprovar',
      blocks: [p(`<b>${esc(d.org)}</b> se cadastrou e confirmou o e-mail. O prazo para responder é de 24 horas.`),
        info([['Nome', d.name], ['E-mail', d.email], ...(d.details || [])]),
        button('Abrir Cadastros', d.link)],
      footer: 'Você recebeu este e-mail porque é admin do BlogSim.'
    }),
    sample: { role: 'blogueiro', org: 'Café com Livros', name: 'Marina Lopes', email: 'marina@cafecomlivros.com.br', details: [['Blog', 'cafecomlivros.com.br'], ['Nicho', 'Culinária'], ['Local', 'Salvador, BA'], ['Leitores por mês', '12.000']], link: 'https://blogsim.com.br/#entrar' }
  },

  cadastro_aprovado: {
    label: 'Cadastro aprovado', to: 'Pessoa que se cadastrou', when: 'Admin aprova o cadastro',
    subject: () => 'Seu cadastro no BlogSim foi aprovado',
    body: d => ({
      preheader: 'Já dá para entrar no painel.',
      title: 'Cadastro aprovado',
      blocks: [p(`Boa notícia, ${first(d.name)}: o seu cadastro foi aprovado e o painel já está liberado.`),
        d.role === 'blogueiro'
          ? p('O primeiro passo é instalar o script do BlogSim no seu blog e clicar em <b>Verificar instalação</b>. Depois disso você cria os espaços e define os preços.')
          : p('Para começar, adicione saldo em <b>Faturamento</b> e escolha os blogs em <b>Explorar blogs</b>.'),
        button('Entrar no BlogSim', d.link)]
    }),
    sample: { name: 'Marina Lopes', role: 'blogueiro', link: 'https://blogsim.com.br/#entrar' }
  },

  cadastro_negado: {
    label: 'Cadastro não aprovado', to: 'Pessoa que se cadastrou', when: 'Admin nega o cadastro',
    subject: () => 'Seu cadastro no BlogSim não foi aprovado',
    body: d => ({
      preheader: 'Veja o motivo da análise.',
      title: 'Cadastro não aprovado',
      blocks: [p(`Olá, ${first(d.name)}. Analisamos o seu cadastro e, desta vez, ele não foi aprovado.`),
        info([['Motivo', d.reason]]),
        muted('Se algum dado estava errado, você pode fazer um cadastro novo com as informações corrigidas.')]
    }),
    sample: { name: 'Paulo Reis', reason: 'O CNPJ não corresponde à empresa informada.' }
  },

  script_verificado: {
    label: 'Verificação do blog concluída', to: 'Blogueiro', when: 'O script é encontrado no blog',
    subject: d => `${d.blog} está verificado no BlogSim`,
    body: d => ({
      preheader: 'Seu painel completo está liberado.',
      title: 'Blog verificado',
      blocks: [p(`Encontramos o script do BlogSim em <b>${esc(d.site)}</b>. O painel completo está liberado.`),
        p('Agora crie os espaços onde os anúncios podem aparecer (lateral, banner no topo, pop-up ou no meio do post) e defina o preço por semana de cada um.'),
        button('Criar meus espaços', d.link)]
    }),
    sample: { blog: 'Café com Livros', site: 'cafecomlivros.com.br', link: 'https://blogsim.com.br/#entrar' }
  },

  recuperar_senha: {
    label: 'Criar senha nova', to: 'Pessoa que pediu', when: 'Esqueci a senha',
    subject: () => 'Crie uma senha nova no BlogSim',
    body: d => ({
      preheader: 'O link vale por 30 minutos.',
      title: 'Crie uma senha nova',
      blocks: [p(`Olá, ${first(d.name)}. Recebemos um pedido para trocar a senha da sua conta.`),
        button('Criar senha nova', d.link),
        muted('O link vale por 30 minutos e só funciona uma vez. Se não foi você, ignore este e-mail: sua senha continua a mesma.')]
    }),
    sample: { name: 'Carla Mendes', link: 'https://blogsim.com.br/#nova-senha=exemplo' }
  },

  senha_alterada: {
    label: 'Senha alterada', to: 'Dono da conta', when: 'Depois de trocar a senha',
    subject: () => 'Sua senha do BlogSim foi alterada',
    body: d => ({
      preheader: 'Se não foi você, troque a senha agora.',
      title: 'Senha alterada',
      blocks: [p(`Olá, ${first(d.name)}. A senha da sua conta acabou de ser trocada e as outras sessões foram encerradas.`),
        muted('Se não foi você, use "Esqueci a senha" na tela de login para criar uma senha nova.')]
    }),
    sample: { name: 'Carla Mendes' }
  },

  pagamento_solicitado: {
    label: 'Solicitação de pagamento', to: 'Anunciante', when: 'Anunciante pede para adicionar saldo',
    subject: d => `Pagamento de ${BRL(d.amount)} aguardando confirmação`,
    body: d => ({
      preheader: 'O saldo entra assim que o pagamento for confirmado.',
      title: 'Recebemos seu pedido de saldo',
      blocks: [highlight('Valor', BRL(d.amount)),
        info([['Forma de pagamento', d.method === 'pix' ? 'Pix' : 'Cartão de crédito'], ...(d.installments > 1 ? [['Parcelas', `${d.installments}x de ${BRL(d.amount / d.installments)}`]] : []), ['Situação', 'Aguardando pagamento']]),
        p(d.method === 'pix' ? 'Pague o Pix pelo QR Code ou pelo código copia e cola que aparece no painel. O saldo entra assim que o banco confirmar.' : 'Estamos processando o pagamento no cartão. O saldo entra assim que a operadora confirmar.'),
        button('Ver Faturamento', d.link)]
    }),
    sample: { amount: 600, method: 'cartao', installments: 3, link: 'https://blogsim.com.br/#entrar' }
  },

  pagamento_confirmado: {
    label: 'Confirmação de pagamento', to: 'Anunciante', when: 'O pagamento da recarga é confirmado',
    subject: d => `Saldo de ${BRL(d.amount)} adicionado`,
    body: d => ({
      preheader: 'Já dá para usar o saldo nas campanhas.',
      title: 'Pagamento confirmado',
      blocks: [p('O pagamento foi confirmado e o valor já está no seu saldo.'),
        info([['Valor adicionado', BRL(d.amount)], ['Saldo disponível', BRL(d.balance)]]),
        button('Criar campanha', d.link)]
    }),
    sample: { amount: 600, balance: 3600, link: 'https://blogsim.com.br/#entrar' }
  },

  saque_solicitado: {
    label: 'Saque solicitado', to: 'Blogueiro', when: 'Blogueiro pede saque',
    subject: d => `Saque de ${BRL(d.amount)} solicitado`,
    body: d => ({
      preheader: 'O valor cai na sua conta em até 2 dias úteis.',
      title: 'Recebemos seu pedido de saque',
      blocks: [highlight('Valor do saque', BRL(d.amount)),
        p('O valor cai na conta cadastrada em até <b>2 dias úteis</b>. Você recebe outro e-mail quando o pagamento for feito.'),
        button('Ver Receita', d.link)]
    }),
    sample: { amount: 1640, link: 'https://blogsim.com.br/#entrar' }
  },

  saque_pago: {
    label: 'Saque pago', to: 'Blogueiro', when: 'Admin marca o saque como pago',
    subject: d => `Saque de ${BRL(d.amount)} pago`,
    body: d => ({
      preheader: 'O dinheiro já foi enviado para a sua conta.',
      title: 'Saque pago',
      blocks: [p(`Olá, ${first(d.name)}. O saque de <b>${BRL(d.amount)}</b> foi pago e já está a caminho da sua conta.`),
        muted('Dependendo do banco, o valor pode levar algumas horas para aparecer no extrato.')]
    }),
    sample: { name: 'Renata Alves', amount: 1640 }
  },

  campanha_iniciada: {
    label: 'Campanha iniciada', to: 'Anunciante', when: 'Admin aprova a campanha e ela entra no ar',
    subject: d => `"${d.campaign}" está no ar`,
    body: d => ({
      preheader: `Seus anúncios já aparecem em ${d.blogs.length} ${d.blogs.length > 1 ? 'blogs' : 'blog'}.`,
      title: 'Campanha iniciada',
      blocks: [p(`A campanha <b>${esc(d.campaign)}</b> foi aprovada e os anúncios já estão nos blogs.`),
        info([['Período', `${d.start} a ${d.end}`], ['Investimento', BRL(d.total)]]),
        table(['Blog', 'Espaço'], d.blogs.map(b => [b.blog, PLACE[b.placement] || b.placement])),
        button('Acompanhar resultados', d.link)]
    }),
    sample: { campaign: 'Black Friday – Tênis', start: '28/10/2026', end: '11/11/2026', total: 1260, blogs: [{ blog: 'Treino em Casa', placement: 'lateral' }, { blog: 'Viagem com Criança', placement: 'banner' }], link: 'https://blogsim.com.br/#entrar' }
  },

  anuncio_publicado: {
    label: 'Anúncio publicado', to: 'Blogueiro', when: 'Uma campanha com espaço no blog dele entra no ar',
    subject: d => `Novo anúncio no ${d.blog}`,
    body: d => ({
      preheader: `${d.advertiser} alugou um espaço no seu blog.`,
      title: 'Anúncio publicado no seu blog',
      blocks: [p(`<b>${esc(d.advertiser)}</b> alugou um espaço no <b>${esc(d.blog)}</b> e o anúncio já está aparecendo.`),
        info([['Espaço', PLACE[d.placement] || d.placement], ['Até', d.until], ['Você recebe', BRL(d.earnings)]]),
        muted('O valor já está descontado da comissão do BlogSim e entra no seu saldo para saque.'),
        button('Ver meus espaços', d.link)]
    }),
    sample: { blog: 'Treino em Casa', advertiser: 'Passo Certo Calçados', placement: 'lateral', until: '11/11/2026', earnings: 480, link: 'https://blogsim.com.br/#entrar' }
  },

  campanha_encerrada: {
    label: 'Campanha encerrada', to: 'Anunciante', when: 'O período da campanha termina ou ela é encerrada',
    subject: d => `"${d.campaign}" terminou`,
    body: d => ({
      preheader: 'Veja o resultado final da campanha.',
      title: 'Campanha encerrada',
      blocks: [p(`A campanha <b>${esc(d.campaign)}</b> terminou. Este é o resultado final:`),
        info([['Investido', BRL(d.invested)], ['Visualizações', NUM(d.views)], ['Cliques', NUM(d.clicks)], ['Resultados', NUM(d.results)], ['Custo por resultado', d.results ? BRL(d.invested / d.results) : '—']]),
        button('Criar outra campanha', d.link)]
    }),
    sample: { campaign: 'Black Friday – Tênis', invested: 1260, views: 41200, clicks: 1380, results: 46, link: 'https://blogsim.com.br/#entrar' }
  },

  campanha_recusada: {
    label: 'Campanha não aprovada', to: 'Anunciante', when: 'Admin recusa a campanha',
    subject: d => `"${d.campaign}" não foi aprovada`,
    body: d => ({
      preheader: 'O valor voltou para o seu saldo.',
      title: 'Campanha não aprovada',
      blocks: [p(`A campanha <b>${esc(d.campaign)}</b> não foi aprovada.`),
        info([['Motivo', d.reason], ['Devolvido ao saldo', BRL(d.refund)]]),
        button('Ajustar e criar de novo', d.link)]
    }),
    sample: { campaign: 'Cupom relâmpago', reason: 'O link do anúncio leva para uma página fora do ar.', refund: 760, link: 'https://blogsim.com.br/#entrar' }
  },

  relatorio_diario: {
    label: 'Relatório do dia', to: 'Anunciante e blogueiro com campanha no ar', when: 'Todo dia, pelo job npm run report:daily',
    subject: d => `Seu dia no BlogSim · ${d.date}`,
    body: d => ({
      preheader: d.role === 'blogueiro'
        ? `Hoje: ${NUM(d.views)} visualizações e ${NUM(d.clicks)} cliques nos anúncios do ${d.blog}.`
        : `Hoje: ${NUM(d.views)} visualizações e ${NUM(d.clicks)} cliques nas suas campanhas.`,
      title: `Relatório de ${d.date}`,
      blocks: d.role === 'blogueiro'
        ? [p(`Olá, ${first(d.name)}. Estes são os números de hoje dos anúncios no <b>${esc(d.blog)}</b>, medidos pelo script do BlogSim.`),
          info([['Visualizações hoje', NUM(d.views)], ['Cliques hoje', NUM(d.clicks)], ['A receber das campanhas no ar', BRL(d.total)]]),
          table(['Anunciante', 'Espaço', 'Vis. hoje', 'Cliques hoje', 'No ar até'], d.rows.map(r => [r.advertiser, PLACE[r.placement] || r.placement, NUM(r.views), NUM(r.clicks), r.until])),
          button('Ver Receita', d.link)]
        : [p(`Olá, ${first(d.name)}. Estes são os números de hoje das suas campanhas no ar, medidos nos blogs.`),
          info([['Visualizações hoje', NUM(d.views)], ['Cliques hoje', NUM(d.clicks)]]),
          table(['Campanha', 'Vis. hoje', 'Cliques hoje', 'Vis. no total', 'Cliques no total'], d.rows.map(r => [r.campaign, NUM(r.dayViews), NUM(r.dayClicks), NUM(r.views), NUM(r.clicks)])),
          button('Ver painel', d.link)]
    }),
    sample: { role: 'anunciante', name: 'Carla Mendes', date: '27/10/2026', views: 3240, clicks: 118, link: 'https://blogsim.com.br/#entrar',
      rows: [{ campaign: 'Black Friday – Tênis', dayViews: 2910, dayClicks: 104, views: 41200, clicks: 1380 }, { campaign: 'Atendimento pelo WhatsApp', dayViews: 330, dayClicks: 14, views: 3120, clicks: 94 }] }
  }
};

export function render(key, data) {
  const t = TEMPLATES[key];
  if (!t) throw new Error(`Template de e-mail desconhecido: ${key}`);
  const { html, text } = layout(t.body(data));
  return { subject: t.subject(data), html, text };
}