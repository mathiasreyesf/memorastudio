// ARQUIVO ÚNICO para colar no editor de Edge Functions do painel do Supabase (não precisa da CLI).
// Gerado a partir de functions/_shared + a função. Se mudar a lógica, regere ou edite aqui.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = () => ({
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(), "Content-Type": "application/json" } });

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ erro: e.message }, e.status);
  console.error(e); // o detalhe fica só no log do servidor
  return json({ erro: "Algo deu errado. Tente novamente em instantes." }, 500);
}

// Exige um cliente logado (o token anônimo do site não basta)
async function requireUser(req: Request) {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Faça login para continuar.");
  return { user: data.user, sb };
}

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);


// Os preços vêm do MESMO catalogo.json que o site publica: uma fonte só.
// O cliente nunca informa preço; o servidor recalcula tudo.
let cache: { at: number; data: any } | null = null;

async function loadCatalog() {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const site = Deno.env.get("SITE_URL");
  if (!site) throw new HttpError(500, "Servidor não configurado.");
  const r = await fetch(new URL("catalogo.json", site.endsWith("/") ? site : site + "/"), { cache: "no-store" });
  if (!r.ok) throw new HttpError(502, "Não foi possível carregar o catálogo agora.");
  const data = await r.json();
  cache = { at: Date.now(), data };
  return data;
}

type Pacote = { peso_g: number; c: number; l: number; a: number };
type Linha = {
  produto: string; variante: string | null; nome: string; qtd: number; obs: string;
  total: number; pacote: Pacote; qtd_min: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function priceItems(cat: any, itens: any[]): { linhas: Linha[]; subtotal: number } {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 30) throw new HttpError(400, "Carrinho inválido.");
  const linhas: Linha[] = [];
  let subtotal = 0;
  for (const it of itens) {
    const p = cat.produtos.find((x: any) => x.id === it?.produto);
    if (!p || p.fluxo !== "carrinho") throw new HttpError(400, "Produto inválido no carrinho.");
    const qtd = Number(it.qtd);
    if (!Number.isInteger(qtd) || qtd < 1 || qtd > 500) throw new HttpError(400, "Quantidade inválida.");
    if (p.qtd_min && qtd < p.qtd_min) throw new HttpError(400, `O pedido mínimo de ${p.nome} é de ${p.qtd_min} unidades.`);
    let base: number, pacote: Pacote, nome = p.nome;
    if (p.variantes) {
      const v = p.variantes.find((x: any) => x.id === it.variante);
      if (!v) throw new HttpError(400, "Tamanho inválido.");
      base = v.preco; pacote = v.pacote; nome = `${p.nome} — ${v.nome}`;
    } else { base = p.preco; pacote = p.pacote; }
    const total = r2(p.qtd_min ? base + Math.max(0, qtd - p.qtd_min) * p.preco_unidade_extra : base * qtd);
    subtotal += total;
    linhas.push({ produto: p.id, variante: it.variante ?? null, nome, qtd, obs: String(it.obs ?? "").slice(0, 600), total, pacote, qtd_min: p.qtd_min ?? null });
  }
  return { linhas, subtotal: r2(subtotal) };
}


type Opcao = { servico: "PAC" | "SEDEX"; valor: number; prazo: number };

// O CEP de ORIGEM fica somente aqui, em um segredo do servidor (ORIGEM_CEP).
// Ele nunca é enviado ao navegador nem gravado no código do site.
async function cotarCorreios(cepDestino: string, linhas: Linha[]): Promise<Opcao[]> {
  const origem = Deno.env.get("ORIGEM_CEP");
  const token = Deno.env.get("MELHOR_ENVIO_TOKEN");
  if (!origem || !token) throw new HttpError(500, "O cálculo de frete está indisponível no momento.");
  const host = Deno.env.get("MELHOR_ENVIO_ENV") === "production" ? "https://melhorenvio.com.br" : "https://sandbox.melhorenvio.com.br";

  const products = linhas.map((l, i) => {
    const quantity = l.qtd_min ? Math.ceil(l.qtd / l.qtd_min) : l.qtd; // chaveiros: 1 caixa por lote
    return {
      id: `item-${i}`, width: l.pacote.l, height: l.pacote.a, length: l.pacote.c,
      weight: l.pacote.peso_g / 1000, insurance_value: Math.round((l.total / quantity) * 100) / 100, quantity,
    };
  });

  const r = await fetch(`${host}/api/v2/me/shipment/calculate`, {
    method: "POST",
    headers: {
      Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}`,
      "User-Agent": `Memora Studio (${Deno.env.get("CONTATO_EMAIL") ?? "contato@exemplo.com"})`,
    },
    body: JSON.stringify({ from: { postal_code: origem }, to: { postal_code: cepDestino }, products, services: "1,2" }), // 1=PAC, 2=SEDEX
  });
  if (!r.ok) throw new HttpError(502, "Não foi possível consultar os Correios agora. Tente de novo em instantes.");
  const data = await r.json();

  const opcoes: Opcao[] = (Array.isArray(data) ? data : [])
    .filter((s: any) => !s.error && (s.id === 1 || s.id === 2))
    .map((s: any) => ({
      servico: s.id === 2 ? "SEDEX" : "PAC",
      valor: Math.round(Number(s.custom_price ?? s.price) * 100) / 100,
      prazo: Number(s.custom_delivery_time ?? s.delivery_time),
    }))
    .filter((o: Opcao) => Number.isFinite(o.valor) && o.valor > 0 && Number.isFinite(o.prazo));
  return opcoes.sort((a, b) => a.valor - b.valor);
}

// ===== função =====

// O Mercado Pago avisa aqui quando um pagamento muda. Não confiamos no aviso:
// reconsultamos o pagamento na API deles com o nosso token e conferimos o valor.
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let id = url.searchParams.get("data.id") ?? url.searchParams.get("id");
    let type = url.searchParams.get("type") ?? url.searchParams.get("topic");
    if (!id) { try { const b = await req.json(); id = b?.data?.id ?? null; type = type ?? b?.type ?? null; } catch { /* sem corpo */ } }
    if (type !== "payment" || !id || !/^\d+$/.test(String(id))) return new Response("ignorado", { status: 200 });

    const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` } });
    if (!r.ok) return new Response("tentar de novo", { status: 502 });
    const pay = await r.json();
    const ref = pay.external_reference;
    if (!ref) return new Response("sem referência", { status: 200 });

    const admin = adminClient();
    const { data: pedido } = await admin.from("pedidos").select("id,total,status").eq("id", ref).single();
    if (!pedido) return new Response("pedido não encontrado", { status: 200 });

    if (pay.status === "approved" && Math.abs(Number(pay.transaction_amount) - Number(pedido.total)) < 0.01) {
      if (pedido.status === "aguardando_pagamento") await admin.from("pedidos").update({ status: "pago", mp_payment_id: String(pay.id) }).eq("id", pedido.id);
    } else if (["cancelled", "rejected"].includes(pay.status) && pedido.status === "aguardando_pagamento") {
      // mantém "aguardando": o cliente pode tentar pagar de novo
    }
    return new Response("ok", { status: 200 });
  } catch (e) { console.error(e); return new Response("erro", { status: 500 }); }
});
