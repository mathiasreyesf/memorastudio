# Memora Studio — loja online

Site com 5 páginas: **Início**, **Produtos**, **Entrar/Criar conta**, **Minha conta** e **Pagamento**.

## Como o site está dividido

| Parte | Onde roda | O que faz |
|---|---|---|
| Site (HTML/CSS/JS) | GitHub Pages | O que o cliente vê |
| Banco + login | **Supabase** (grátis) | Guarda contas (senha com hash), perfis e pedidos |
| Captcha | **Cloudflare Turnstile** (grátis) | Bloqueia robôs no login e no cadastro |
| Frete | Função de servidor + **Melhor Envio** | Cota PAC/SEDEX dos Correios. O CEP de origem fica só aqui |
| Pagamento | Função de servidor + **Mercado Pago** | Pix e cartão. O cartão nunca passa pelo seu site |

> **Por que precisa de servidor?** Um site no GitHub Pages é só arquivos públicos: tudo que está no JavaScript pode ser lido por qualquer pessoa. Senha, CPF, CEP de origem e preços de pagamento **não podem** ficar ali. Por isso essas partes rodam no Supabase.

## Modo demonstração (já funciona agora)

Enquanto `supabaseUrl` e `supabaseAnonKey` estiverem vazios em `assets/js/config.js`, o site roda em **modo demonstração**: contas e pedidos ficam só no navegador de quem testa, o captcha é ilustrativo, o frete é simulado e **nada é cobrado**. Uma faixa amarela avisa isso. **Não publique para clientes nesse modo.**

## Colocando no ar de verdade (passo a passo)

### 1. Supabase (login e banco)
1. Crie uma conta em supabase.com e um projeto novo (região São Paulo, se disponível).
2. **SQL Editor → New query**, cole o conteúdo de `backend/supabase/schema.sql` e clique em **Run**.
3. **Authentication → Sign In / Providers → Email**: deixe "Confirm email" **ligado**, defina o tamanho mínimo da senha em **8** e ative a exigência de maiúscula, minúscula, número e símbolo (o nome exato do menu pode variar). O site já valida isso, mas o servidor precisa exigir também.
4. **Authentication → URL Configuration**: em *Site URL* coloque o endereço do seu site e adicione o mesmo endereço em *Redirect URLs* (com `conta.html` no final).
5. **Project Settings → API**: copie a *Project URL* e a chave **anon public** para `assets/js/config.js` (`supabaseUrl` e `supabaseAnonKey`). Essa chave é feita para ser pública. **Nunca** coloque a `service_role` no site.

### 2. Captcha (Cloudflare Turnstile)
1. Em dash.cloudflare.com → **Turnstile → Add site** (domínio do seu site).
2. Copie a **Site Key** para `turnstileSiteKey` em `config.js`.
3. No Supabase: **Authentication → Attack Protection → Enable Captcha protection**, escolha **Turnstile** e cole a **Secret Key** (ela fica só no Supabase).

### 3. Frete (Melhor Envio)
1. Crie conta em melhorenvio.com.br e gere um token (comece pelo **sandbox** para testar).
2. Guarde o token e o CEP de origem como **segredos do servidor** (passo 5). O CEP de origem **não deve** ser escrito em nenhum arquivo do projeto, porque o repositório do GitHub Pages é público.

### 4. Pagamento (Mercado Pago)
1. Em mercadopago.com.br/developers crie uma aplicação (Checkout Pro) e copie o **Access Token** (use o de teste primeiro).

### 5. Publicar as funções de servidor

Escolha **uma** das duas opções.

**Opção A — pelo painel do Supabase (sem linha de comando, recomendada para começar)**
1. No Supabase, abra **Edge Functions → Secrets** e cadastre os segredos abaixo (um por vez).
2. Ainda em **Edge Functions**, clique em **Deploy a new function → Via Editor**. Dê o nome `frete`, apague o código de exemplo, cole o conteúdo de `backend/supabase/functions-painel/frete.ts` e faça o **Deploy**.
3. Repita com `criar-pedido` (arquivo `criar-pedido.ts`) e `mp-webhook` (arquivo `mp-webhook.ts`).
4. Na função **`mp-webhook`**, desligue a opção **Verify JWT** (o Mercado Pago não envia login do Supabase). Nas outras duas, deixe ligada.

**Opção B — pela CLI do Supabase** (na pasta `backend`):
```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy frete
supabase functions deploy criar-pedido
supabase functions deploy mp-webhook --no-verify-jwt
```

**Segredos** (Opção A: painel; Opção B: `supabase secrets set NOME="valor"`):

| Nome | Valor |
|---|---|
| `SITE_URL` | `https://mathiasreyesf.github.io/memorastudio/` |
| `ALLOWED_ORIGIN` | `https://mathiasreyesf.github.io` |
| `ORIGEM_CEP` | só os 8 números do CEP de onde o pedido sai |
| `MELHOR_ENVIO_TOKEN` | token do Melhor Envio |
| `MELHOR_ENVIO_ENV` | `sandbox` para testar, `production` para vender |
| `CONTATO_EMAIL` | seu e-mail |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago (teste primeiro) |

No Mercado Pago o webhook já é informado em cada pedido, então não precisa configurar mais nada além do token.

### 6. Atualizar o site no GitHub

Repositório: `github.com/mathiasreyesf/memorastudio`.

1. Baixe o `.zip` do projeto e **extraia** no computador.
2. Abra o repositório no GitHub. Apague os arquivos da versão antiga que não existem mais: `style.css`, `script.js`, `logo-mark.png`, `favicon.png` e `apple-touch-icon.png` (abra o arquivo → ícone de lixeira → *Commit changes*).
3. Clique em **Add file → Upload files**.
4. Abra a pasta extraída e arraste para a página **o conteúdo dela** (não a pasta em si): `index.html`, `produtos.html`, `login.html`, `conta.html`, `pagamento.html`, `catalogo.json`, `README.md` e as pastas `assets` e `backend`. O `index.html` e o `README.md` antigos serão substituídos.
5. Espere terminar o envio, escreva "nova loja" no campo de mensagem e clique em **Commit changes**.
6. Em 1 a 2 minutos o site atualiza (acompanhe em **Actions**). Abra `https://mathiasreyesf.github.io/memorastudio/` e use **Ctrl + F5** para limpar o cache. Se o deploy falhar com "Deployment failed, try again later", use **Re-run jobs**.
7. Para editar um arquivo depois (por exemplo o `config.js`): abra o arquivo no GitHub → ícone de lápis → altere → *Commit changes*.

**Ligar o login real:** depois de criar o Supabase (passos 1 a 5), edite `assets/js/config.js` no GitHub e preencha `supabaseUrl`, `supabaseAnonKey` e `turnstileSiteKey`. No Supabase, em **Authentication → URL Configuration**, use `https://mathiasreyesf.github.io/memorastudio/` como *Site URL* e adicione `https://mathiasreyesf.github.io/memorastudio/conta.html` em *Redirect URLs*. Quando as chaves estiverem preenchidas, a faixa amarela de demonstração some sozinha.

### 7. Teste antes de vender
- Criar conta, confirmar o e-mail e entrar.
- Adicionar produto, calcular frete, pagar com cartão/Pix de teste.
- Ver o pedido mudar para **Pago** em *Minha conta → Meus pedidos*.
- Só então troque os tokens para produção (`MELHOR_ENVIO_ENV=production` e Access Token real).

## Mudando preços e produtos

Tudo está em **`catalogo.json`**: preços, tamanhos, quantidade mínima, peso e medidas das embalagens (usadas no frete). O site e o servidor leem o mesmo arquivo, então não há dois lugares para editar. Os pesos e medidas atuais são **estimativas**: ajuste conforme as suas embalagens reais.

Para colocar fotos no lugar dos emojis, salve a imagem em `assets/img/produtos/` e adicione ao produto no JSON: `"imagem": "assets/img/produtos/funko.jpg"`.

## Segurança: o que já está feito

- Senha: mínimo de 8 caracteres, maiúscula, minúscula, número e símbolo, e bloqueio de palavras óbvias. O servidor guarda apenas o hash.
- Sugestões de senha geradas no navegador com `crypto.getRandomValues`, uma sequência diferente a cada clique.
- Captcha no login, cadastro e recuperação de senha, validado pelo servidor.
- CPF validado pelos dígitos verificadores no site **e** no banco. Aparece mascarado na conta.
- Cada cliente só lê os próprios dados (regras RLS). E-mail e CPF não podem ser alterados pelo cliente.
- **Preço e frete são recalculados no servidor**: o valor enviado pelo navegador é ignorado, então ninguém consegue "baratear" um pedido.
- O webhook do Mercado Pago reconsulta o pagamento na API e confere o valor antes de marcar como pago.
- Política de conteúdo (CSP) em todas as páginas e nenhum dado de cliente é inserido como HTML.

## Pendências suas (importantes)

- **LGPD:** você guarda CPF, endereço e telefone. Publique uma **Política de Privacidade** e linke no rodapé e no cadastro. Hoje há só o texto de consentimento no formulário.
- O webhook marca o pedido como **Pago**. Os demais status (em produção, enviado, entregue) você altera pelo painel do Supabase (*Table Editor → pedidos*).
- O prazo de produção (15 dias) está em `catalogo.json` → `config.prazo_producao_dias` e aparece no site inteiro.
