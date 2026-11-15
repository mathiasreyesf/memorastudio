(function () {
  "use strict";
  const M = window.M, h = M.h;

  M.fromPrice = (p) => (p.variantes ? Math.min(...p.variantes.map((v) => v.preco)) : p.preco);

  /* Cartão de produto. Hoje mostra um emoji; para usar foto, basta adicionar
     "imagem": "assets/img/produtos/arquivo.jpg" ao produto no catalogo.json. */
  M.productCard = function (p, { as = "button", href, onClick, i = 0 } = {}) {
    const stage = h("div", { class: "p-stage" },
      p.imagem ? h("img", { class: "p-img", src: p.imagem, alt: "", loading: "lazy" }) : h("span", { class: "p-emoji", "aria-hidden": "true", text: p.emoji }));
    const sub = p.qtd_min ? `lote de ${p.qtd_min}` : p.variantes ? "3 tamanhos" : "";
    const body = h("div", { class: "p-body" },
      h("h3", { text: p.nome }),
      h("p", { text: p.resumo }),
      h("div", { class: "p-price" },
        (p.a_partir || p.variantes) ? h("small", { text: "a partir de" }) : null,
        h("strong", { text: M.brl(M.fromPrice(p)) }),
        sub ? h("small", { text: sub }) : null),
      h("span", { class: "p-cta", text: p.fluxo === "whatsapp" ? "Pedir pelo WhatsApp" : "Ver opções" }));
    const el = h(as, { class: "p-card glow", "data-reveal": "", ...(as === "a" ? { href } : { type: "button" }) }, stage, body);
    el.style.setProperty("--i", String(i % 6));
    if (onClick) el.addEventListener("click", (e) => { e.preventDefault(); onClick(p, el); });
    return el;
  };
})();
