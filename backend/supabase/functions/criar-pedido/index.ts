import { adminClient, cors, errorResponse, HttpError, json, requireUser } from "../_shared/http.ts";
import { loadCatalog, priceItems } from "../_shared/catalogo.ts";
import { cotarCorreios } from "../_shared/frete.ts";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const txt = (v: unknown, min: number, max: number, campo: string) => {
  const s = String(v ?? "").trim();
  if (s.length < min || s.length > max) throw new HttpError(400, `Endereço inválido: ${campo}.`);
  return s;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  try {
    const { user, sb } = await requireUser(req);
    const body = await req.json();

    // 1) preço SEMPRE recalculado aqui
    const { linhas, subtotal } = priceItems(await loadCatalog(), body.itens);

    // 2) endereço validado
    const e = body.endereco ?? {};
    const cep = String(e.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) throw new HttpError(400, "CEP inválido.");
    if (!UFS.includes(String(e.uf))) throw new HttpError(400, "Estado inválido.");
    const endereco = {
      cep, uf: e.uf, logradouro: txt(e.logradouro, 3, 120, "rua"), numero: txt(e.numero, 1, 12, "número"),
      complemento: String(e.complemento ?? "").trim().slice(0, 60), bairro: txt(e.bairro, 2, 80, "bairro"), cidade: txt(e.cidade, 2, 80, "cidade"),
    };

    // 3) frete reconsultado no servidor (o valor do navegador é ignorado)
    const escolha = (await cotarCorreios(cep, linhas)).find((o) => o.servico === body.frete_servico);
    if (!escolha) throw new HttpError(400, "Opção de frete inválida. Calcule o frete de novo.");
    const total = Math.round((subtotal + escolha.valor) * 100) / 100;

    // 3.1) limite contra abuso: no máximo 5 pedidos aguardando pagamento por hora
    const admin0 = adminClient();
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin0.from("pedidos").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).eq("status", "aguardando_pagamento").gte("criado_em", desde);
    if ((count ?? 0) >= 5) throw new HttpError(429, "Você já tem vários pedidos aguardando pagamento. Conclua um deles ou aguarde um pouco.");

    // 4) dados do cliente vêm do perfil (RLS: só o dele)
    const { data: perfil, error: pe } = await sb.from("perfis").select("nome_completo,celular,email").eq("id", user.id).single();
    if (pe || !perfil) throw new HttpError(400, "Complete o seu cadastro antes de pagar.");

    // 5) grava o pedido (somente o servidor consegue)
    const admin = adminClient();
    const { data: pedido, error: ie } = await admin.from("pedidos").insert({
      user_id: user.id,
      itens: linhas.map((l) => ({ produto: l.produto, variante: l.variante, qtd: l.qtd, obs: l.obs, total: l.total })),
      subtotal, frete_servico: escolha.servico, frete_valor: escolha.valor, total,
      endereco: { ...endereco, nome: perfil.nome_completo, celular: perfil.celular },
    }).select("id,numero").single();
    if (ie || !pedido) throw ie ?? new Error("falha ao gravar pedido");

    // 6) cria o pagamento no Mercado Pago (Checkout Pro: o cartão nunca passa por aqui)
    const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/?$/, "/");
    const mp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          ...linhas.map((l) => ({ id: l.produto, title: l.nome.slice(0, 250), quantity: 1, unit_price: l.total, currency_id: "BRL" })),
          { id: "frete", title: `Frete Correios ${escolha.servico}`, quantity: 1, unit_price: escolha.valor, currency_id: "BRL" },
        ],
        payer: { email: perfil.email },
        external_reference: pedido.id,
        back_urls: { success: `${site}pagamento.html?retorno=sucesso`, pending: `${site}pagamento.html?retorno=pendente`, failure: `${site}pagamento.html?retorno=falha` },
        auto_return: "approved",
        notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mp-webhook`,
        statement_descriptor: "MEMORA STUDIO",
      }),
    });
    const pref = await mp.json();
    if (!mp.ok || !pref.init_point) {
      await admin.from("pedidos").update({ status: "cancelado" }).eq("id", pedido.id);
      console.error("Mercado Pago:", mp.status, JSON.stringify(pref));
      throw new HttpError(502, "Não foi possível iniciar o pagamento agora. Tente de novo.");
    }
    await admin.from("pedidos").update({ mp_preference_id: String(pref.id) }).eq("id", pedido.id);
    return json({ pedido_id: pedido.id, numero: pedido.numero, init_point: pref.init_point });
  } catch (err) { return errorResponse(err); }
});
