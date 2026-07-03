# Memora Studio — Site de pré-orçamento

Site estático (HTML/CSS/JS puro, sem necessidade de servidor) para calcular
pré-orçamentos de impressão 3D em resina e receber pedidos.

## Arquivos
- `index.html` — estrutura do site
- `style.css` — visual (cores, tipografia, layout)
- `script.js` — lógica da calculadora, menu mobile e envio de pedido
- `logo-mark.png` — símbolo da marca (fundo transparente), usado no cabeçalho, rodapé e favicon
- `favicon.png` — versão pequena do símbolo, usada no ícone da aba do navegador
- `apple-touch-icon.png` — ícone com fundo sólido, usado quando o site é salvo na tela inicial do iPhone

## Já configurado
- **WhatsApp**: `5511958626251` (+55 11 95862-6251), já definido em `script.js`.
  Se precisar trocar no futuro, é só editar `whatsappNumber` no topo do arquivo.
- **Menu mobile**: no celular, o menu vira um ícone de "hambúrguer" no canto
  superior direito que abre as opções de navegação.

## Ajustes que você ainda pode querer fazer
**Preço da resina e regras de cálculo**: em `script.js`, no objeto
   `CONFIG`:
   ```js
   resinPricePerKg: 290,        // preço médio do kg (sua faixa: 250–350)
   resinEspecialMultiplier: 1.15,
   minimumOrder: 150,
   ```
   E no objeto `CATEGORIES`, o peso estimado (`weight`, em gramas) de cada
   categoria/tamanho. Esses pesos foram calibrados pra bater com o exemplo
   que você passou (Funko Pop médio = 150g de resina, acabamento "médio"
   ≈ R$ 175). Ajuste à medida que for pesando suas peças reais no fatiador.

## Como funciona a calculadora (resumo da lógica)

```
preço do item = (peso em g / 1000) × preço do kg de resina × multiplicador de acabamento
multiplicadores: simples = 3.5 · médio = 4 · complexo = 5
total do pedido = máximo entre (soma dos itens) e R$ 150 (mínimo)
```

Itens sem peso definido (categoria "Outro" ou tamanhos "sob consulta") entram
no orçamento sem preço fechado — o cliente é avisado que o valor será
confirmado depois de você analisar a referência ou o arquivo 3D.

## Sobre o envio de arquivos (fotos, vídeos, .stl)

Este é um site estático — ele não tem um servidor próprio pra **receber**
arquivos. A solução usada aqui é prática e comum para pequenos negócios:

- O cliente seleciona os arquivos no formulário (só pra conferir o que vai
  mandar).
- Ao clicar em "Enviar pedido pelo WhatsApp", o site abre uma conversa de
  WhatsApp com o resumo do pedido e do pré-orçamento já escritos.
- O cliente anexa os arquivos manualmente ali na conversa antes de enviar.

Se no futuro você quiser que os arquivos cheguem automaticamente (por e-mail,
por exemplo, sem precisar que o cliente anexe na mão), você vai precisar de
um backend ou de um serviço de formulário com upload, como Formspree ou
Basin. Posso te ajudar a integrar um desses depois, se fizer sentido pro
seu fluxo.

## Como publicar

Qualquer hospedagem de site estático funciona. As mais simples e gratuitas:

- **Netlify**: arraste a pasta com os 3 arquivos em https://app.netlify.com/drop
- **Vercel**: `vercel deploy` na pasta do projeto (via CLI ou painel)
- **GitHub Pages**: suba os arquivos num repositório e ative o Pages nas
  configurações

Não precisa de banco de dados, servidor ou instalação — é só hospedar todos
os arquivos desta pasta juntos, mantendo os nomes como estão.
