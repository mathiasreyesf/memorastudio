(function () {
  "use strict";
  const M = window.M;
  const KEY = "memora_cart_v1";

  const valid = (i) =>
    i && typeof i.id === "string" && typeof i.produto === "string" && Number.isInteger(i.qtd) && i.qtd > 0 && i.qtd <= 500;

  function load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a.filter(valid) : [];
    } catch { return []; }
  }
  let items = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* modo privado */ }
    document.dispatchEvent(new CustomEvent("cart:change"));
  }
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "i" + Date.now() + Math.random().toString(16).slice(2));

  M.cart = {
    items: () => items.map((i) => ({ ...i })),
    count: () => items.length,
    add({ produto, variante, qtd, obs }) {
      items.push({
        id: uid(),
        produto: String(produto),
        variante: variante ? String(variante) : null,
        qtd: Math.min(500, Math.max(1, Math.floor(qtd))),
        obs: String(obs || "").slice(0, 600),
      });
      save();
    },
    setQty(id, qtd, min) {
      const it = items.find((i) => i.id === id);
      if (!it) return;
      it.qtd = Math.min(500, Math.max(min || 1, Math.floor(qtd)));
      save();
    },
    remove(id) { items = items.filter((i) => i.id !== id); save(); },
    clear() { items = []; save(); },
    // Defesa contra carrinho adulterado no navegador (o servidor também revalida tudo)
    sanitize(cat) {
      let changed = false;
      items = items.filter((i) => {
        const p = M.product(cat, i.produto);
        if (!p || p.fluxo !== "carrinho") { changed = true; return false; }
        if (p.variantes) { if (!p.variantes.some((v) => v.id === i.variante)) { i.variante = p.variantes[0].id; changed = true; } }
        else if (i.variante) { i.variante = null; changed = true; }
        const min = M.minQty(p);
        if (i.qtd < min) { i.qtd = min; changed = true; }
        return true;
      });
      if (changed) save();
      return changed;
    },
  };

  // sincroniza entre abas
  window.addEventListener("storage", (e) => { if (e.key === KEY) { items = load(); document.dispatchEvent(new CustomEvent("cart:change")); } });
})();
