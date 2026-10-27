# BlogSim

Protótipo navegável do BlogSim, um marketplace de anúncios em blogs. Anunciantes alugam espaços (pop-up, lateral, banner no topo, meio do post) em blogs parceiros e acompanham visitas, conversas no WhatsApp e vendas. Donos de blog definem os espaços e o preço e recebem pelo aluguel. O admin master aprova campanhas e blogs e fica com uma comissão.

É um protótipo de front-end para validar a ideia: os dados são de exemplo, ficam só na memória e voltam ao início quando a página é recarregada.

## Como abrir

Abra `index.html` no navegador. Não precisa de servidor nem de instalação; o React e o GSAP (animações) vêm do cdnjs e as fontes do Google Fonts, então é preciso estar online.

As animações usam GSAP com ScrollTrigger e respeitam a opção "reduzir movimento" do sistema: com ela ligada, tudo aparece parado e completo.

## Contas de teste

Não há cadastro. A tela de login mostra três contas, uma por perfil (Anunciante, Dono do blog e Admin master). Clique numa conta para preencher e-mail e senha e depois em Entrar. As contas ficam em `src/app.js`, na constante `ACCOUNTS`.

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
| `build.py` | Junta tokens, design system e app num único `index.html`. |

## Editar e gerar de novo

Depois de mudar qualquer arquivo em `src/` ou `design-system/`:

```bash
python build.py
```

Precisa de Python 3.8 ou mais novo, sem dependências.