(function () {
  "use strict";
  const M = window.M;

  /* Abas acessíveis. Botões: [role=tab][data-tab=x]; painéis: [role=tabpanel][data-panel=x] */
  M.tabs = function (root, onChange) {
    const tabs = M.$$('[role="tab"]', root);
    const ind = M.$(".tab-ind", root);
    function select(name, focus) {
      tabs.forEach((t) => {
        const on = t.dataset.tab === name;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        if (on && ind) { ind.style.width = t.offsetWidth + "px"; ind.style.transform = `translateX(${t.offsetLeft}px)`; }
        if (on && focus) t.focus();
      });
      M.$$('[role="tabpanel"]').forEach((p) => {
        const show = p.dataset.panel === name;
        if (show && p.hidden) { p.hidden = false; p.classList.remove("panel-in"); void p.offsetWidth; p.classList.add("panel-in"); }
        else if (!show) p.hidden = true;
      });
      if (onChange) onChange(name);
    }
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t.dataset.tab));
      t.addEventListener("keydown", (e) => {
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!k) return;
        e.preventDefault();
        select(tabs[(i + k + tabs.length) % tabs.length].dataset.tab, true);
      });
    });
    window.addEventListener("resize", () => { const cur = tabs.find((t) => t.getAttribute("aria-selected") === "true"); if (cur) select(cur.dataset.tab); });
    return { select };
  };

  /* Lê um campo de endereço de um formulário pelos ids <prefixo>-<campo> */
  M.addressFields = (p) => {
    const g = (k) => document.getElementById(`${p}-${k}`);
    return { cep: g("cep"), logradouro: g("logradouro"), numero: g("numero"), complemento: g("complemento"), bairro: g("bairro"), cidade: g("cidade"), uf: g("uf") };
  };

  /* Valida os campos de endereço; devolve true/false e mostra os erros */
  M.validateAddress = (f) => {
    let ok = true;
    const need = (el, cond, msg) => { if (!M.setError(el, cond ? "" : msg)) ok = false; };
    need(f.cep, M.validCEP(f.cep.value), "Informe um CEP válido com 8 números.");
    need(f.logradouro, f.logradouro.value.trim().length >= 3, "Informe a rua ou avenida.");
    need(f.numero, f.numero.value.trim().length >= 1, "Informe o número (ou S/N).");
    need(f.bairro, f.bairro.value.trim().length >= 2, "Informe o bairro.");
    need(f.cidade, f.cidade.value.trim().length >= 2, "Informe a cidade.");
    need(f.uf, M.UFS.includes(f.uf.value), "Escolha o estado.");
    return ok;
  };
  /* Limpa o erro de cada campo assim que o valor passa a ser válido */
  M.bindAddressLive = (f) => {
    const checks = { cep: M.validCEP, logradouro: (v) => v.trim().length >= 3, numero: (v) => v.trim().length >= 1, bairro: (v) => v.trim().length >= 2, cidade: (v) => v.trim().length >= 2, uf: (v) => M.UFS.includes(v) };
    Object.entries(checks).forEach(([k, ok]) => ["input", "change"].forEach((ev) => f[k].addEventListener(ev, () => {
      if (f[k].closest(".field").classList.contains("has-error") && ok(f[k].value)) M.setError(f[k], "");
    })));
  };
  M.readAddress = (f) => ({
    cep: M.digits(f.cep.value), logradouro: f.logradouro.value.trim(), numero: f.numero.value.trim(),
    complemento: f.complemento.value.trim(), bairro: f.bairro.value.trim(), cidade: f.cidade.value.trim(), uf: f.uf.value,
  });
})();
