# BlogSim

Protótipo navegável do BlogSim, um marketplace de anúncios em blogs. Anunciantes alugam espaços (pop-up, lateral, banner no topo, meio do post) em blogs parceiros e acompanham visitas, conversas no WhatsApp e vendas. Donos de blog definem os espaços e o preço e recebem pelo aluguel. O admin master aprova campanhas e blogs e fica com uma comissão.

É um protótipo de front-end para validar a ideia: os dados são de exemplo, ficam só na memória e voltam ao início quando a página é recarregada.

## Como abrir

Abra `index.html` no navegador. Não precisa de servidor nem de instalação; o React e o GSAP (animações) vêm do cdnjs e as fontes do Google Fonts, então é preciso estar online.

As animações usam GSAP com ScrollTrigger e respeitam a opção "reduzir movimento" do sistema: com ela ligada, tudo aparece parado e completo.

## Contas e cadastro

- **Criar conta:** "Quero anunciar" ou "Tenho um blog" na landing, ou "Cadastre-se" no login. A pessoa escolhe o perfil e preenche os dados do blog ou da empresa (com CNPJ).
- Todo cadastro entra **em análise**. O admin aprova ou nega em **Cadastros**. Em análise ou negado, o login mostra o status e não entra.
- Blogueiro aprovado só vê **Instalar script** e **Meu blog** até clicar em **Verificar instalação**.
- As contas de QA (admin master, anunciante e blogueiro) ficam em `QA_CONTAS.md`, só na máquina local. No código vão apenas sal e hash.
- No site publicado tudo é simulado no navegador e some ao recarregar. Com a API local rodando ([`api/README.md`](api/README.md)), o mesmo front usa dados reais e envia os e-mails. O plano completo está em [`docs/BACKEND.md`](docs/BACKEND.md).

## Estrutura

| Caminho | O que é |
| --- | --- |
| `index.html` | O protótipo pronto, gerado por `build.py`. Não edite à mão. |
| `src/app.js` | Telas: landing, login e os painéis dos três perfis. |
| `src/app.css` | Layout do protótipo. |
| `design-system/tokens.json` | Cores, tipografia, espaçamento, raios e sombras. |
| `design-system/bundle.js` | Componentes do design system (Button, Badge, TextField, MetricCard, ObjectivePicker, SlotCard, CampaignTable, SideNav). |
| `design-system/bundle.css` | Estilos dos componentes. |
| `design-system/index.d.ts` | Props de cada componente. |
| `build.py` | Junta tokens, design system e app em `index.html` (para o link do Claude) e `dist/index.html` (documento completo para servidor web). |
| `api/` | Back-end (só local por enquanto). Veja `api/README.md`. |
| `dist/index.html` | O que vai para o servidor. Em produção fica em `/www/wwwroot/blogsim.com.br/` no nginx. |

## Editar e gerar de novo

Depois de mudar qualquer arquivo em `src/` ou `design-system/`:

```bash
python build.py
```

Precisa de Python 3.8 ou mais novo, sem dependências.