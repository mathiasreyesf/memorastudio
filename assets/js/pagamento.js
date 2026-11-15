(function () {
  "use strict";
  const M = window.M, h = M.h, B = M.backend;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  (async function init() {
    const user = await B.getUser();
    if (!user) { location.replace("login.html?next=pagamento.html"); return; }

    const retorno = params.get("retorno");
    if (retorno) { await showReturn(retorno, params.get("external_reference")); return; }

    let cat, perfil;
    try { [cat, perfil] = await Promise.all([M.catalog(), B.getProfile()]); } catch (e) { M.toast("Não foi possível carregar seus dados. Recarregue a página.", "error"); return; }
    if (M.cart.sanitize(cat)) M.toast("Ajustamos itens do carrinho que estavam inválidos.", "error");
    const items = M.cart.items();
    if (!items.length) { $("empty").hidden = false; return; }
    $("checkout").hidden = false;

    /* ---------- resumo ---------- */
    let sub = 0;
    const lines = items.map((it) => { const p = M.product(cat, it.produto); const total = M.lineTotal(p, it.variante, it.qtd); sub += total; return { it, p, total }; });
    sub = Math.round(sub * 100) / 100;
    lines.forEach(({ it, p, total }) => $("sum-items").append(h("div", { class: "sum-item" },
      h("span", { class: "em", "aria-hidden": "true", text: M.itemEmoji(p, it.variante) }),
      h("div", { style: "flex:1;min-width:0" }, h("strong", { text: M.itemName(p, it.variante) }), h("p", { text: `Quantidade: ${it.qtd}` })),
      h("strong", { text: M.brl(total) }))));
    $("sum-sub").textContent = M.brl(sub);
    let frete = null;
    const refreshTotals = () => {
      $("sum-frete").textContent = frete ? M.brl(frete.valor) : "a calcular";
      $("sum-total").textContent = M.brl(sub + (frete ? frete.valor : 0));
      $("pay-btn").textContent = frete ? `Pagar ${M.brl(sub + frete.valor)}` : "Pagar";
    };
    refreshTotals();

    /* ---------- entrega ---------- */
    $("recipient").textContent = `Receber em nome de ${perfil.nome_completo} · contato ${M.maskPhone(perfil.celular)}`;
    M.fillUF($("p-uf")); M.bindMasks($("form-entrega"));
    const f = M.addressFields("p");
    f.cep.value = M.maskCEP(perfil.cep); f.logradouro.value = perfil.logradouro; f.numero.value = perfil.numero; f.complemento.value = perfil.complemento || "";
    f.bairro.value = perfil.bairro; f.cidade.value = perfil.cidade; f.uf.value = perfil.uf;
    M.cepLookup(f.cep, f);
    M.bindAddressLive(f);
    [f.cep, f.uf].forEach((el) => el.addEventListener("input", reset));

    function reset() {
      if (!frete && $("step-frete").classList.contains("locked")) return;
      frete = null; refreshTotals();
      $("step-frete").classList.add("locked"); $("step-pag").classList.add("locked"); $("pay-btn").disabled = true;
      $("frete-opts").hidden = true; $("frete-opts").replaceChildren();
      $("frete-msg").replaceChildren(h("p", { class: "hint", text: "Endereço alterado. Clique em Calcular frete para atualizar as opções." }));
    }

    $("form-entrega").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!M.validateAddress(f)) return;
      const btn = e.target.querySelector("[type=submit]");
      M.setLoading(btn, true);
      const stepFrete = $("step-frete");
      stepFrete.classList.remove("locked");
      $("frete-opts").hidden = true;
      $("frete-msg").replaceChildren(h("p", { class: "hint", text: "Consultando os Correios…" }));
      try {
        const opcoes = await B.quoteShipping({ cep: f.cep.value, uf: f.uf.value, itens: items.map(({ produto, variante, qtd }) => ({ produto, variante, qtd })) });
        if (!opcoes || !opcoes.length) throw new Error("Os Correios não retornaram opções para esse CEP. Confira o endereço.");
        const box = $("frete-opts"); box.replaceChildren(h("legend", { class: "sr", text: "Opções de envio" }));
        opcoes.forEach((o, i) => {
          const input = h("input", { type: "radio", name: "frete", value: o.servico, onchange: () => choose(o) });
          box.append(h("label", { class: "opt" }, input,
            h("span", { class: "grow" }, h("strong", { text: `Correios ${o.servico}` }), h("small", { text: `Entrega em até ${o.prazo} dias úteis após o envio${o.simulado ? " (valor simulado no modo demonstração)" : ""}` })),
            h("span", { class: "price", text: M.brl(o.valor) })));
        });
        box.hidden = false;
        $("frete-msg").replaceChildren(h("p", { class: "hint", text: `Escolha como quer receber. A produção leva ${M.prazo(cat)} dias e o prazo de entrega conta a partir do envio.` }));
        stepFrete.scrollIntoView({ behavior: M.reduced ? "auto" : "smooth", block: "nearest" });
      } catch (err) {
        $("frete-msg").replaceChildren(h("div", { class: "form-error", role: "alert", text: err.message }));
      }
      M.setLoading(btn, false);
    });

    function choose(o) {
      frete = o; refreshTotals();
      $("step-pag").classList.remove("locked"); $("pay-btn").disabled = false;
      $("pay-note").replaceChildren(M.icon("lock"), h("span", { text: B.demo ? "Modo demonstração: o pedido será registrado só neste navegador, sem cobrança." : "Você será levado à tela segura do Mercado Pago para escolher Pix ou cartão. A Memora não recebe nem guarda os dados do seu cartão." }));
    }

    /* ---------- pagar ---------- */
    $("pay-btn").addEventListener("click", async () => {
      if (!frete) return;
      const btn = $("pay-btn"); $("pay-error").hidden = true;
      if (!M.validateAddress(f)) { f.cep.scrollIntoView({ block: "center" }); return; }
      M.setLoading(btn, true);
      try {
        const r = await B.createOrder({
          itens: items.map(({ produto, variante, qtd, obs }) => ({ produto, variante, qtd, obs })),
          endereco: M.readAddress(f), freteServico: frete.servico,
        });
        if (r.demo) { M.cart.clear(); showDone(r.numero); return; }
        const url = new URL(r.init_point);
        if (url.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname)) throw new Error("Link de pagamento inválido. Tente novamente.");
        location.href = url.href;
      } catch (err) {
        $("pay-error").hidden = false; $("pay-error").textContent = err.message;
        M.setLoading(btn, false); refreshTotals();
      }
    });
  })();

  function showDone(numero) {
    $("checkout").hidden = true;
    $("retorno").replaceChildren(h("div", { class: "banner ok" },
      h("h2", { text: `Pedido nº ${numero} registrado` }),
      h("p", { text: "Modo demonstração: nenhum pagamento foi cobrado. Em produção, esta etapa leva ao pagamento seguro." }),
      h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
        h("a", { class: "btn btn-primary", href: "conta.html#pedidos", text: "Ver meus pedidos" }),
        waButton(numero))));
  }

  const waButton = (numero) => h("a", { class: "btn btn-outline", target: "_blank", rel: "noopener noreferrer", href: M.waLink(`Olá! Fiz o pedido nº ${numero} na Memora Studio e vou enviar as fotos de referência.`) }, M.icon("phone"), "Enviar referências pelo WhatsApp");

  async function showReturn(kind, ref) {
    const MSG = {
      sucesso: ["ok", "Recebemos o seu pagamento", "Assim que o Mercado Pago confirmar, o pedido aparece como Pago em Meus pedidos. Se tiver fotos de referência, envie pelo WhatsApp."],
      pendente: ["", "Pagamento pendente", "Se você escolheu Pix ou boleto, o pedido segue assim que o pagamento for confirmado. Você pode acompanhar em Meus pedidos."],
      falha: ["err", "O pagamento não foi concluído", "Nada foi cobrado e o seu carrinho continua salvo. Você pode tentar de novo."],
    };
    const [cls, title, text] = MSG[kind] || MSG.pendente;
    if (kind === "sucesso") M.cart.clear();
    let numero = null;
    if (ref) { try { const o = (await B.listOrders()).find((x) => x.id === ref); numero = o && o.numero; } catch { /* sem número */ } }
    $("retorno").replaceChildren(h("div", { class: "banner " + cls },
      h("h2", { text: title }), h("p", { text }),
      h("div", { style: "display:flex;gap:10px;flex-wrap:wrap" },
        kind === "falha" ? h("a", { class: "btn btn-primary", href: "pagamento.html", text: "Tentar de novo" }) : h("a", { class: "btn btn-primary", href: "conta.html#pedidos", text: "Ver meus pedidos" }),
        kind === "sucesso" ? waButton(numero || "") : null)));
  }
})();
