import { cors, errorResponse, HttpError, json, requireUser } from "../_shared/http.ts";
import { loadCatalog, priceItems } from "../_shared/catalogo.ts";
import { cotarCorreios } from "../_shared/frete.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors() });
  try {
    await requireUser(req);
    const { cep, itens } = await req.json();
    const destino = String(cep ?? "").replace(/\D/g, "");
    if (destino.length !== 8) throw new HttpError(400, "CEP inválido.");
    const { linhas } = priceItems(await loadCatalog(), itens);
    return json({ opcoes: await cotarCorreios(destino, linhas) });
  } catch (e) { return errorResponse(e); }
});
