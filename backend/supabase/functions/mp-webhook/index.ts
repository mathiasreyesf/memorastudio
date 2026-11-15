import { adminClient } from "../_shared/http.ts";

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
