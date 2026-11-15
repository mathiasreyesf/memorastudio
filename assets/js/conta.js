(function () {
  "use strict";
  const M = window.M, h = M.h, B = M.backend;
  const $ = (id) => document.getElementById(id);
  const recovery = /type=recovery/.test(window.__initialHash || "");

  const STATUS = { aguardando_pagamento: "Aguardando pagamento", pago: "Pago", em_producao: "Em produção", enviado: "Enviado", entregue: "Entregue", cancelado: "Cancelado" };
  const note = (el, msg, ok) => { el.hidden = !msg; el.className = ok ? "form-ok" : "form-error"; el.textContent = msg || ""; };

  const tabs = M.tabs($("account-tabs"), (name) => { if (name === "pedidos") loadOrders(); });
  window.addEventListener("hashchange", () => { const w = location.hash.slice(1); if (["dados", "endereco", "pedidos", "seguranca"].includes(w)) tabs.select(w); });
  M.fillUF($("a-uf"));
  M.bindMasks(document);

  (async function init() {
    const user = await B.getUser();
    if (!user) { location.replace("login.html?next=conta.html"); return; }
    let perfil;
    try { perfil = await B.getProfile(); } catch (e) { M.toast(e.message, "error"); return; }
    if (!perfil) { location.replace("login.html?next=conta.html"); return; }

    $("hello").textContent = "Olá, " + perfil.nome_completo.split(" ")[0];
    $("d-nome").value = perfil.nome_completo;
    $("d-email").value = perfil.email;
    $("d-cpf").value = M.maskedCPF(perfil.cpf);
    $("d-celular").value = M.maskPhone(perfil.celular);
    const f = M.addressFields("a");
    f.cep.value = M.maskCEP(perfil.cep); f.logradouro.value = perfil.logradouro; f.numero.value = perfil.numero;
    f.complemento.value = perfil.complemento || ""; f.bairro.value = perfil.bairro; f.cidade.value = perfil.cidade; f.uf.value = perfil.uf;
    M.cepLookup(f.cep, f);
    M.bindAddressLive(f);

    const wanted = location.hash.replace("#", "");
    tabs.select(recovery ? "seguranca" : ["dados", "endereco", "pedidos", "seguranca"].includes(wanted) ? wanted : "dados");
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {});
    if (recovery) $("recovery").hidden = false;

    $("form-dados").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nome = $("d-nome"), cel = $("d-celular"), btn = e.target.querySelector("[type=submit]");
      let ok = true;
      if (!M.setError(nome, /^\S{2,}(\s+\S+)+$/.test(nome.value.trim()) ? "" : "Informe nome e sobrenome.")) ok = false;
      if (!M.setError(cel, M.validPhone(cel.value) ? "" : "Informe um celular com DDD.")) ok = false;
      if (!ok) return;
      M.setLoading(btn, true);
      try { await B.updateProfile({ nome_completo: nome.value.trim().replace(/\s+/g, " "), celular: M.digits(cel.value) }); note($("dados-msg"), "Dados atualizados.", true); $("hello").textContent = "Olá, " + nome.value.trim().split(" ")[0]; }
      catch (err) { note($("dados-msg"), err.message, false); }
      M.setLoading(btn, false);
    });

    $("form-endereco").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector("[type=submit]");
      if (!M.validateAddress(f)) return;
      M.setLoading(btn, true);
      try { await B.updateProfile(M.readAddress(f)); note($("end-msg"), "Endereço atualizado.", true); }
      catch (err) { note($("end-msg"), err.message, false); }
      M.setLoading(btn, false);
    });

    const pw = M.password.mount({ input: $("c-senha"), confirm: $("c-senha2"), host: $("c-pw-extra") });
    $("form-senha").addEventListener("submit", async (e) => {
      e.preventDefault();
      const a = $("c-senha"), b = $("c-senha2"), btn = e.target.querySelector("[type=submit]");
      let ok = true;
      if (!M.setError(a, pw.valid() ? "" : "A senha ainda não cumpre todas as regras.")) ok = false;
      if (!M.setError(b, b.value && b.value === a.value ? "" : "As senhas não são iguais.")) ok = false;
      if (!ok) return;
      M.setLoading(btn, true);
      try { await B.updatePassword(a.value); a.value = ""; b.value = ""; a.dispatchEvent(new Event("input")); note($("senha-msg"), "Senha atualizada com sucesso.", true); $("recovery").hidden = true; }
      catch (err) { note($("senha-msg"), err.message, false); }
      M.setLoading(btn, false);
    });
  })();

  $("logout").addEventListener("click", async () => { await B.signOut(); location.href = "index.html"; });

  async function loadOrders() {
    const box = $("orders");
    try {
      const [orders, cat] = await Promise.all([B.listOrders(), M.catalog()]);
      box.replaceChildren();
      if (!orders.length) {
        box.append(h("div", { class: "empty" }, h("span", { class: "big-emoji", "aria-hidden": "true", text: "📦" }), h("p", { text: "Você ainda não fez nenhum pedido." }), h("a", { class: "btn btn-primary", href: "produtos.html", text: "Ver produtos" })));
        return;
      }
      orders.forEach((o) => {
        const lines = (o.itens || []).map((i) => {
          const p = M.product(cat, i.produto);
          return h("li", { text: p ? `${M.itemName(p, i.variante)} × ${i.qtd}` : `${i.produto} × ${i.qtd}` });
        });
        box.append(h("article", { class: "order" },
          h("div", { class: "order-top" },
            h("strong", { text: `Pedido nº ${o.numero}` }),
            h("span", { class: "status " + o.status, text: STATUS[o.status] || o.status })),
          h("p", { class: "hint", text: new Date(o.criado_em).toLocaleDateString("pt-BR") + " · " + (o.endereco ? `${o.endereco.cidade}/${o.endereco.uf}` : "") }),
          h("ul", {}, lines),
          h("p", {}, h("strong", { text: `Total: ${M.brl(o.total)}` }), h("span", { class: "hint", text: ` (frete ${o.frete_servico}: ${M.brl(o.frete_valor)})` })),
          h("a", { class: "btn btn-outline btn-sm", target: "_blank", rel: "noopener noreferrer", href: M.waLink(`Olá! Sobre o meu pedido nº ${o.numero} na Memora Studio.`) }, M.icon("phone"), "Falar sobre este pedido")));
      });
    } catch (err) { box.replaceChildren(h("p", { class: "empty", text: err.message })); }
  }
})();
