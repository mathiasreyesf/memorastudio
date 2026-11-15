import { HttpError } from "./http.ts";
import type { Linha } from "./catalogo.ts";

export type Opcao = { servico: "PAC" | "SEDEX"; valor: number; prazo: number };

// O CEP de ORIGEM fica somente aqui, em um segredo do servidor (ORIGEM_CEP).
// Ele nunca é enviado ao navegador nem gravado no código do site.
export async function cotarCorreios(cepDestino: string, linhas: Linha[]): Promise<Opcao[]> {
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
