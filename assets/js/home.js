(function () {
  "use strict";
  const M = window.M;

  const grid = M.$("#home-grid");
  M.catalog().then((cat) => {
    grid.replaceChildren();
    cat.produtos.forEach((p, i) => {
      const href = p.fluxo === "whatsapp" ? "produtos.html#" + p.id : "produtos.html#" + p.id;
      grid.append(M.productCard(p, { as: "a", href, i }));
    });
    M.initReveal();
  }).catch(() => {
    grid.replaceChildren(M.h("p", { class: "lead", text: "Não foi possível carregar os produtos agora. Recarregue a página." }));
  });

  // a logo flutua e acompanha levemente o cursor (só atualiza variáveis CSS)
  const blob = M.$("#hero-blob");
  if (blob && !M.reduced && window.matchMedia("(pointer: fine)").matches) {
    let raf = 0;
    window.addEventListener("pointermove", (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        blob.style.setProperty("--px", ((e.clientX / innerWidth) * 2 - 1).toFixed(3));
        blob.style.setProperty("--py", ((e.clientY / innerHeight) * 2 - 1).toFixed(3));
        raf = 0;
      });
    }, { passive: true });
  }
})();
