(function () {
  "use strict";
  const M = window.M, C = window.MEMORA, h = M.h;
  const page = document.body.dataset.page || "";

  /* ---------- cabeçalho ---------- */
  const navLink = (href, text, key) => h("a", { href, class: page === key ? "is-active" : null, "aria-current": page === key ? "page" : null, text });

  const accountText = h("span", { text: "Entrar" });
  const accountLink = h("a", { class: "account-link", href: "login.html" }, M.icon("user"), accountText);
  const cartCount = h("span", { class: "badge", "data-cart-count": "", hidden: true, text: "0" });
  const cartBtn = h("button", { type: "button", class: "icon-btn cart-btn", "data-cart-btn": "", "aria-label": "Abrir carrinho", "aria-controls": "cart-drawer", "aria-expanded": "false" }, M.icon("bag"), cartCount);
  const toggle = h("button", { type: "button", class: "nav-toggle", "aria-expanded": "false", "aria-controls": "main-nav", "aria-label": "Abrir menu" }, h("span"), h("span"), h("span"));

  const nav = h("nav", { id: "main-nav", class: "main-nav", "aria-label": "Navegação principal" },
    navLink("index.html", "Início", "home"),
    navLink("produtos.html", "Produtos", "produtos"),
    navLink("conta.html", "Minha conta", "conta")
  );

  const header = h("header", { class: "site-header" },
    h("div", { class: "wrap header-inner" },
      h("a", { class: "logo", href: "index.html", "aria-label": "Memora Studio, página inicial" },
        h("img", { class: "logo-mark", src: "assets/img/logo-mark.png", alt: "", width: "48", height: "26" }),
        h("span", { text: "Memora Studio" })),
      nav,
      h("div", { class: "header-actions" },
        h("a", { class: "icon-btn", href: C.instagramUrl, target: "_blank", rel: "noopener noreferrer", "aria-label": "Instagram @" + C.instagramUser }, M.icon("instagram")),
        accountLink, cartBtn, toggle)
    )
  );

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); } });

  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if ((y > 8) !== (lastY > 8)) header.classList.toggle("is-scrolled", y > 8);
    lastY = y;
  }, { passive: true });

  /* ---------- rodapé ---------- */
  const footer = h("footer", { class: "site-footer" },
    h("div", { class: "wrap footer-inner" },
      h("div", {},
        h("p", { class: "logo footer-logo" }, h("img", { class: "logo-mark", src: "assets/img/logo-mark.png", alt: "", width: "48", height: "26" }), h("span", { text: "Memora Studio" })),
        h("p", { class: "footer-tag", text: "Impressão 3D em resina, feita sob encomenda." })),
      h("ul", { class: "footer-links" },
        h("li", {}, h("a", { href: C.instagramUrl, target: "_blank", rel: "noopener noreferrer" }, M.icon("instagram"), "@" + C.instagramUser)),
        h("li", {}, h("a", { href: M.waLink("Olá! Vim pelo site da Memora Studio."), target: "_blank", rel: "noopener noreferrer" }, M.icon("phone"), "WhatsApp")),
        h("li", {}, h("a", { href: "produtos.html" }, "Produtos")),
        h("li", {}, h("a", { href: "conta.html" }, "Minha conta"))),
      h("p", { class: "footer-note" }, "© " + new Date().getFullYear() + " Memora Studio. Prazo de produção: ", h("span", { "data-prazo": "" , text: "15" }), " dias. Frete pelos Correios, calculado no pagamento conforme o seu endereço.")
    )
  );

  /* ---------- gaveta do carrinho ---------- */
  const list = h("ul", { class: "drawer-list" });
  const subtotal = h("strong", { text: M.brl(0) });
  const checkout = h("a", { class: "btn btn-primary btn-block", href: "pagamento.html", text: "Finalizar pedido" });
  const closeBtn = h("button", { type: "button", class: "icon-btn", "aria-label": "Fechar carrinho" }, M.icon("close"));
  const overlay = h("div", { class: "overlay", hidden: true });
  const drawer = h("aside", { id: "cart-drawer", class: "drawer", role: "dialog", "aria-modal": "true", "aria-label": "Carrinho", tabindex: "-1", inert: true },
    h("div", { class: "drawer-head" }, h("h2", { text: "Seu carrinho" }), closeBtn),
    list,
    h("div", { class: "drawer-foot" },
      h("p", { class: "drawer-sub" }, h("span", { text: "Subtotal" }), subtotal),
      h("p", { class: "hint", text: "O frete é calculado na próxima etapa, pelo seu endereço." }),
      checkout)
  );

  let lastFocus = null;
  function openDrawer() {
    lastFocus = document.activeElement;
    overlay.hidden = false; drawer.removeAttribute("inert");
    requestAnimationFrame(() => { overlay.classList.add("on"); drawer.classList.add("on"); });
    cartBtn.setAttribute("aria-expanded", "true"); closeBtn.focus();
  }
  function closeDrawer() {
    overlay.classList.remove("on"); drawer.classList.remove("on"); drawer.setAttribute("inert", "");
    cartBtn.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!drawer.classList.contains("on")) overlay.hidden = true; }, 420);
    if (lastFocus) lastFocus.focus();
  }
  M.openCart = openDrawer;
  cartBtn.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawer.classList.contains("on")) closeDrawer(); });

  async function renderCart() {
    const items = M.cart.items();
    cartCount.textContent = String(items.length);
    cartCount.hidden = items.length === 0;
    list.replaceChildren();
    if (!items.length) {
      list.append(h("li", { class: "drawer-empty" }, h("span", { class: "big-emoji", "aria-hidden": "true", text: "🫧" }), h("p", { text: "Seu carrinho está vazio." }), h("a", { class: "btn btn-outline", href: "produtos.html", text: "Ver produtos" })));
      subtotal.textContent = M.brl(0); checkout.setAttribute("aria-disabled", "true"); checkout.classList.add("is-disabled");
      return;
    }
    checkout.removeAttribute("aria-disabled"); checkout.classList.remove("is-disabled");
    let cat;
    try { cat = await M.catalog(); } catch { return; }
    if (M.cart.sanitize(cat)) return; // volta aqui pelo evento cart:change
    let sum = 0;
    items.forEach((it) => {
      const p = M.product(cat, it.produto); if (!p) return;
      const total = M.lineTotal(p, it.variante, it.qtd); sum += total;
      const min = M.minQty(p);
      const qty = h("div", { class: "qty" },
        h("button", { type: "button", class: "icon-btn-sm", "aria-label": "Diminuir quantidade", onclick: () => M.cart.setQty(it.id, it.qtd - 1, min) }, M.icon("minus")),
        h("span", { "aria-live": "polite", text: String(it.qtd) }),
        h("button", { type: "button", class: "icon-btn-sm", "aria-label": "Aumentar quantidade", onclick: () => M.cart.setQty(it.id, it.qtd + 1, min) }, M.icon("plus")));
      list.append(h("li", { class: "drawer-item" },
        h("span", { class: "drawer-emoji", "aria-hidden": "true", text: M.itemEmoji(p, it.variante) }),
        h("div", { class: "drawer-info" },
          h("strong", { text: M.itemName(p, it.variante) }),
          it.obs ? h("p", { class: "drawer-obs", text: it.obs }) : null,
          p.qtd_min ? h("p", { class: "hint", text: `Mínimo de ${min} unidades` }) : null,
          qty),
        h("div", { class: "drawer-price" }, h("strong", { text: M.brl(total) }),
          h("button", { type: "button", class: "link-btn", onclick: () => M.cart.remove(it.id) }, "Remover"))));
    });
    subtotal.textContent = M.brl(sum);
  }
  checkout.addEventListener("click", (e) => { if (checkout.classList.contains("is-disabled")) e.preventDefault(); });
  document.addEventListener("cart:change", renderCart);

  /* ---------- montar na página ---------- */
  const skip = document.querySelector(".skip"); // o link "pular" precisa continuar sendo o 1º item do teclado
  if (skip) skip.after(header); else document.body.prepend(header);
  document.body.append(footer, overlay, drawer);
  renderCart();

  // estado de login no cabeçalho
  M.backend.getUser().then(async (u) => {
    if (!u) return;
    accountLink.setAttribute("href", "conta.html");
    try { const p = await M.backend.getProfile(); accountText.textContent = (p && p.nome_completo ? p.nome_completo.split(" ")[0] : "Conta"); }
    catch { accountText.textContent = "Conta"; }
  });
  M.backend.onChange((ev, u) => { if (ev === "SIGNED_OUT") { accountText.textContent = "Entrar"; accountLink.setAttribute("href", "login.html"); } });

  if (M.backend.demo) {
    document.body.append(h("div", { class: "demo-bar", role: "note", text: "Modo demonstração: contas e pedidos ficam apenas neste navegador e nenhum pagamento é cobrado." }));
  }
})();
