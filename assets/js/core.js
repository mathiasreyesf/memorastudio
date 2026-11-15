(function () {
  "use strict";
  const M = (window.M = window.M || {});
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  M.reduced = reduced;

  /* ---------- DOM seguro (nunca usa innerHTML com dados de usuário) ---------- */
  M.h = function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const h = M.h;
  M.$ = (s, r) => (r || document).querySelector(s);
  M.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  /* ---------- Ícones (SVG estático e confiável) ---------- */
  const ICONS = {
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  };
  M.icon = function (name, cls) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round");
    s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", "icon " + (cls || ""));
    s.innerHTML = ICONS[name] || ""; // constante interna, nunca dado de usuário
    return s;
  };

  /* ---------- Formatação, máscaras, validações ---------- */
  M.brl = (n) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  M.digits = (v) => String(v || "").replace(/\D/g, "");
  M.maskCPF = (v) => M.digits(v).slice(0, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  M.maskPhone = (v) => {
    const d = M.digits(v).slice(0, 11);
    if (d.length <= 2) return d ? "(" + d : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };
  M.maskCEP = (v) => M.digits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
  M.maskedCPF = (cpf) => { const d = M.digits(cpf); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : ""; };

  M.validCPF = function (v) {
    const c = M.digits(v);
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (const t of [9, 10]) {
      let s = 0;
      for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
      let d = (s * 10) % 11;
      if (d === 10) d = 0;
      if (d !== Number(c[t])) return false;
    }
    return true;
  };
  M.validPhone = (v) => /^[1-9][1-9]9\d{8}$/.test(M.digits(v));
  M.validEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()) && v.length <= 254;
  M.validCEP = (v) => /^\d{8}$/.test(M.digits(v));
  M.UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  M.safeNext = (n) => (["conta.html", "pagamento.html", "produtos.html", "index.html"].includes(n) ? n : "conta.html");

  /* ---------- Feedback de campo ---------- */
  M.setError = function (input, msg) {
    const f = input.closest(".field");
    if (!f) return;
    let e = f.querySelector(".field-error");
    if (!e) { e = h("p", { class: "field-error", role: "alert" }); f.append(e); e.id = (input.id || "f") + "-err"; }
    e.textContent = msg || "";
    f.classList.toggle("has-error", !!msg);
    f.classList.toggle("is-valid", !msg && input.value !== "");
    if (msg) { input.setAttribute("aria-invalid", "true"); input.setAttribute("aria-describedby", e.id); }
    else { input.removeAttribute("aria-invalid"); input.removeAttribute("aria-describedby"); }
    return !msg;
  };
  M.setLoading = (btn, on, label) => {
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
    if (label != null) { if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; } else if (btn.dataset.label) btn.textContent = btn.dataset.label; }
  };

  /* ---------- Toast ---------- */
  M.toast = function (msg, kind) {
    let box = M.$("#toasts");
    if (!box) { box = h("div", { id: "toasts", "aria-live": "polite" }); document.body.append(box); }
    const t = h("div", { class: "toast " + (kind || "") }, M.icon(kind === "error" ? "close" : "check"), h("span", { text: msg }));
    box.append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 400); }, 3800);
  };

  /* ---------- WhatsApp / Instagram ---------- */
  M.waLink = (text) => `https://wa.me/${window.MEMORA.whatsapp}?text=${encodeURIComponent(text)}`;

  /* ---------- Catálogo e preços ---------- */
  let catP = null;
  M.catalog = function () {
    if (!catP) {
      catP = fetch("catalogo.json", { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error("catalogo");
        return r.json();
      });
    }
    return catP;
  };
  M.prazo = (cat) => (cat && cat.config && cat.config.prazo_producao_dias) || 15;
  M.product = (cat, id) => cat.produtos.find((p) => p.id === id);
  M.variant = (p, vid) => (p.variantes ? p.variantes.find((v) => v.id === vid) || p.variantes[0] : null);
  M.minQty = (p) => p.qtd_min || 1;
  M.unitBase = (p, vid) => (p.variantes ? M.variant(p, vid).preco : p.preco);
  M.lineTotal = function (p, vid, qtd) {
    const base = M.unitBase(p, vid);
    if (p.qtd_min) return Math.round((base + Math.max(0, qtd - p.qtd_min) * p.preco_unidade_extra) * 100) / 100;
    return Math.round(base * qtd * 100) / 100;
  };
  M.itemEmoji = (p, vid) => (p.variantes ? M.variant(p, vid).emoji : p.emoji);
  M.itemName = (p, vid) => (p.variantes ? `${p.nome} — ${M.variant(p, vid).nome}` : p.nome);

  /* ---------- Animações compartilhadas ---------- */
  let io = null;
  M.observe = function (el) {
    if (!el) return;
    if (reduced || !("IntersectionObserver" in window)) { el.classList.add("is-in"); return; }
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    }
    io.observe(el);
  };
  M.initReveal = () => M.$$("[data-reveal]:not(.is-in)").forEach(M.observe);

  // brilho que acompanha o cursor nos cartões (só atualiza variáveis CSS)
  let raf = 0;
  document.addEventListener("pointermove", (e) => {
    const c = e.target.closest && e.target.closest(".glow");
    if (!c || raf) return;
    raf = requestAnimationFrame(() => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
      raf = 0;
    });
  }, { passive: true });

  M.bumpCart = function () {
    M.$$("[data-cart-count]").forEach((b) => { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
  };
  M.flyToCart = function (src, emoji) {
    const target = M.$("[data-cart-btn]");
    if (!src || !target || reduced) { M.bumpCart(); return; }
    const a = src.getBoundingClientRect(), b = target.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const g = h("div", { class: "fly", "aria-hidden": "true", text: emoji || "🎁" });
    g.style.left = a.left + a.width / 2 + "px";
    g.style.top = a.top + a.height / 2 + "px";
    document.body.append(g);
    const anim = g.animate([
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 110}px)) scale(1.3)`, opacity: 1, offset: 0.45 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.25)`, opacity: 0.3 },
    ], { duration: 780, easing: "cubic-bezier(.55,0,.25,1)" });
    anim.onfinish = () => { g.remove(); M.bumpCart(); };
  };

  /* ---------- Máscaras automáticas + busca de CEP ---------- */
  M.bindMasks = function (root) {
    M.$$("[data-mask]", root).forEach((i) => {
      const fn = { cpf: M.maskCPF, phone: M.maskPhone, cep: M.maskCEP }[i.dataset.mask];
      i.addEventListener("input", () => { const p = i.selectionStart === i.value.length; i.value = fn(i.value); if (p) i.setSelectionRange(i.value.length, i.value.length); });
    });
  };
  M.fillUF = (sel) => { sel.append(h("option", { value: "", text: "UF" })); M.UFS.forEach((u) => sel.append(h("option", { value: u, text: u }))); };

  M.cepLookup = function (cepInput, f, onDone) {
    let last = "";
    async function run() {
      const d = M.digits(cepInput.value);
      if (d.length !== 8 || d === last) return;
      last = d;
      cepInput.closest(".field").classList.add("is-busy");
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: ctl.signal });
        clearTimeout(t);
        const j = await r.json();
        if (j.erro) { M.setError(cepInput, "CEP não encontrado. Confira os números."); return; }
        M.setError(cepInput, "");
        if (f.logradouro) f.logradouro.value = j.logradouro || f.logradouro.value;
        if (f.bairro) f.bairro.value = j.bairro || f.bairro.value;
        if (f.cidade) f.cidade.value = j.localidade || f.cidade.value;
        if (f.uf) f.uf.value = j.uf || f.uf.value;
        (f.numero || f.logradouro).focus();
        if (onDone) onDone();
      } catch { /* sem rede: o cliente preenche manualmente */ }
      finally { cepInput.closest(".field").classList.remove("is-busy"); }
    }
    cepInput.addEventListener("input", run);
    cepInput.addEventListener("blur", run);
  };

  document.addEventListener("DOMContentLoaded", () => {
    M.initReveal();
    M.catalog().then((c) => M.$$("[data-prazo]").forEach((e) => { e.textContent = String(M.prazo(c)); })).catch(() => {});
    M.$$("[data-wa]").forEach((a) => { a.href = M.waLink(a.dataset.wa); a.target = "_blank"; a.rel = "noopener noreferrer"; });
  });
})();
