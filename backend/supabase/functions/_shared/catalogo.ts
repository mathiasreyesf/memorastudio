import { HttpError } from "./http.ts";

// Os preços vêm do MESMO catalogo.json que o site publica: uma fonte só.
// O cliente nunca informa preço; o servidor recalcula tudo.
let cache: { at: number; data: any } | null = null;

export async function loadCatalog() {
  if (cache && Date.now() - cache.at < 60_000) return cache.data;
  const site = Deno.env.get("SITE_URL");
  if (!site) throw new HttpError(500, "Servidor não configurado.");
  const r = await fetch(new URL("catalogo.json", site.endsWith("/") ? site : site + "/"), { cache: "no-store" });
  if (!r.ok) throw new HttpError(502, "Não foi possível carregar o catálogo agora.");
  const data = await r.json();
  cache = { at: Date.now(), data };
  return data;
}

export type Pacote = { peso_g: number; c: number; l: number; a: number };
export type Linha = {
  produto: string; variante: string | null; nome: string; qtd: number; obs: string;
  total: number; pacote: Pacote; qtd_min: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

export function priceItems(cat: any, itens: any[]): { linhas: Linha[]; subtotal: number } {
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
