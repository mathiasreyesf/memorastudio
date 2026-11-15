(function () {
  "use strict";
  const M = window.M, h = M.h;
  const dlg = M.$("#pd"), body = M.$("#pd-body"), emojiEl = M.$("#pd-emoji"), closeBtn = M.$("#pd-close");
  closeBtn.append(M.icon("close"));
  let cat = null;

  function closeDialog() {
    if (!dlg.open) return;
    dlg.classList.add("closing");
    setTimeout(() => { dlg.close(); dlg.classList.remove("closing"); }, M.reduced ? 0 : 230);
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }
  closeBtn.addEventListener("click", closeDialog);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDialog(); });
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(); });

  function openProduct(p) {
    body.replaceChildren();
    let vid = p.variantes ? p.variantes[0].id : null;
    let qtd = M.minQty(p);
    emojiEl.textContent = M.itemEmoji(p, vid);

    const priceBig = h("div", { class: "pd-price" });
    const priceNote = h("small");
    const qtyNum = h("span", { "aria-live": "polite", text: String(qtd) });
    const obs = h("textarea", { id: "pd-obs", rows: "4", maxlength: "600", required: true, placeholder: p.fluxo === "whatsapp" ? "Conte sua ideia (opcional)" : "Ex.: personagem, pose, cores, tamanho aproximado, frase ou nome para gravar…" });

    function refresh() {
      if (p.fluxo === "whatsapp") { priceBig.replaceChildren(h("small", { text: "a partir de" }), M.brl(p.preco)); return; }
      const total = M.lineTotal(p, vid, qtd);
      const parts = [];
      if (p.a_partir) parts.push("a partir de");
      priceBig.replaceChildren(...[parts.length ? h("small", { text: parts[0] }) : null, M.brl(total)].filter(Boolean));
      priceNote.textContent = p.qtd_min ? `Lote de ${p.qtd_min} por ${M.brl(p.preco)} e ${M.brl(p.preco_unidade_extra)} por unidade acima disso.` : "";
      qtyNum.textContent = String(qtd);
    }

    const head = [h("h2", { id: "pd-title", text: p.nome }), h("p", { class: "lead", style: "color:var(--paper-muted);font-size:.98rem", text: p.descricao })];

    let chips = null;
    if (p.variantes) {
      chips = h("fieldset", { class: "chips" }, h("legend", { text: "Tamanho" }),
        p.variantes.map((v, i) => h("label", { class: "chip" },
          h("input", { type: "radio", name: "variante", value: v.id, checked: i === 0, onchange: () => {
            vid = v.id; emojiEl.textContent = M.itemEmoji(p, vid);
            emojiEl.classList.remove("swap"); void emojiEl.offsetWidth; emojiEl.classList.add("swap"); refresh();
          } }),
          h("span", { text: `${v.nome} · ${M.brl(v.preco)}` }))));
    }

    const min = M.minQty(p);
    const qtyBox = p.fluxo === "whatsapp" ? null : h("div", { class: "field" },
      h("span", { class: "lbl", text: "Quantidade" }),
      h("div", { class: "qty" },
        h("button", { type: "button", class: "icon-btn-sm", "aria-label": "Diminuir", onclick: () => { qtd = Math.max(min, qtd - 1); refresh(); } }, M.icon("minus")),
        qtyNum,
        h("button", { type: "button", class: "icon-btn-sm", "aria-label": "Aumentar", onclick: () => { qtd = Math.min(500, qtd + 1); refresh(); } }, M.icon("plus"))),
      p.qtd_min ? h("p", { class: "hint", text: `Pedido mínimo de ${p.qtd_min} unidades.` }) : null);

    const obsField = h("div", { class: "field" }, h("label", { for: "pd-obs", text: p.fluxo === "whatsapp" ? "Sua ideia" : "Descreva a sua peça" }), h("div", { class: "input-wrap" }, obs));

    const actions = h("div", { style: "display:grid;gap:10px;margin-top:6px" });
    if (p.fluxo === "whatsapp") {
      actions.append(
        h("button", { type: "button", class: "btn btn-primary btn-block", onclick: () => {
          const msg = `Olá! Quero um pedido personalizado na Memora Studio.\n\n${obs.value.trim() || "(vou contar os detalhes por aqui)"}`;
          window.open(M.waLink(msg), "_blank", "noopener");
        } }, M.icon("phone"), "Enviar pedido pelo WhatsApp"),
        h("p", { class: "hint", text: "Os detalhes e o valor final são combinados com você na conversa." }));
      obs.removeAttribute("required");
    } else {
      const add = h("button", { type: "button", class: "btn btn-primary btn-block" }, M.icon("bag"), "Adicionar ao carrinho");
      add.addEventListener("click", () => {
        if (obs.value.trim().length < 10) { M.setError(obs, "Descreva a peça com pelo menos 10 caracteres para a gente produzir do jeito certo."); obs.focus(); return; }
        M.setError(obs, "");
        M.cart.add({ produto: p.id, variante: vid, qtd, obs: obs.value.trim() });
        M.flyToCart(emojiEl, M.itemEmoji(p, vid));
        M.toast("Adicionado ao carrinho.");
        setTimeout(closeDialog, 160);
      });
      actions.append(add,
        h("a", { class: "btn btn-outline btn-block", target: "_blank", rel: "noopener noreferrer", href: M.waLink(`Olá! Tenho uma dúvida sobre: ${M.itemName(p, vid)}.`) }, "Tirar dúvida no WhatsApp"));
    }

    const prazo = h("p", { class: "hint", style: "margin:0 0 14px", text: p.fluxo === "whatsapp" ? "Prazo e valor final combinados conforme o seu pedido." : `Prazo de produção: ${M.prazo(cat)} dias, mais o tempo de entrega dos Correios.` });
    body.append(...[...head, chips, priceBig, priceNote, prazo, qtyBox, obsField, actions].filter(Boolean));
    refresh();
    if (!dlg.open) dlg.showModal();
  }

  /* ---------- grade ---------- */
  const grid = M.$("#grid");
  M.catalog().then((c) => {
    cat = c;
    grid.replaceChildren();
    c.produtos.forEach((p, i) => grid.append(M.productCard(p, { i, onClick: (prod) => { history.replaceState(null, "", "#" + prod.id); openProduct(prod); } })));
    M.initReveal();
    openFromHash();
  }).catch(() => grid.replaceChildren(h("p", { class: "lead", text: "Não foi possível carregar os produtos agora. Recarregue a página." })));

  function openFromHash() {
    const id = location.hash.slice(1);
    const p = cat && cat.produtos.find((x) => x.id === id);
    if (p) openProduct(p);
  }
  window.addEventListener("hashchange", openFromHash);
})();
