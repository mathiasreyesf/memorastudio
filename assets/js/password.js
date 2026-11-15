(function () {
  "use strict";
  const M = window.M, h = M.h;

  const RULES = [
    { id: "len", label: "Mínimo de 8 caracteres", test: (p) => p.length >= 8 && p.length <= 72 },
    { id: "up", label: "1 letra maiúscula", test: (p) => /\p{Lu}/u.test(p) },
    { id: "low", label: "1 letra minúscula", test: (p) => /\p{Ll}/u.test(p) },
    { id: "num", label: "1 número", test: (p) => /\d/.test(p) },
    { id: "sp", label: "1 caractere especial (!@#$%…)", test: (p) => /[^\p{L}\p{N}\s]/u.test(p) },
    { id: "obv", label: "Sem palavras óbvias (senha, 123456, qwerty)", test: (p) => p.length > 0 && !/(senha|password|123456|qwerty|abcdef|memora)/i.test(p) },
  ];
  const evaluate = (p) => RULES.map((r) => ({ ...r, ok: r.test(p) }));
  const isValid = (p) => evaluate(p).every((r) => r.ok);

  /* ---------- gerador: aleatoriedade criptográfica, sem viés ---------- */
  const SETS = { u: "ABCDEFGHJKLMNPQRSTUVWXYZ", l: "abcdefghijkmnpqrstuvwxyz", d: "23456789", s: "!@#$%&*?+-=_" };
  function rnd(n) {
    const max = Math.floor(0x100000000 / n) * n, buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }
  const pick = (s) => s[rnd(s.length)];
  function generate(len) {
    len = len || 16;
    const all = SETS.u + SETS.l + SETS.d + SETS.s;
    const out = [pick(SETS.u), pick(SETS.l), pick(SETS.d), pick(SETS.s)];
    while (out.length < len) out.push(pick(all));
    for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
    const pw = out.join("");
    return isValid(pw) ? pw : generate(len);
  }

  const LEVELS = ["—", "Fraca", "Média", "Boa", "Forte"];
  function level(p) {
    if (!p) return 0;
    const n = evaluate(p).filter((r) => r.ok).length;
    if (n <= 3) return 1;
    if (n < RULES.length) return 2;
    return p.length >= 12 ? 4 : 3;
  }

  /* ---------- mostrar/ocultar senha ---------- */
  function bindToggle(input) {
    const btn = input.parentElement.querySelector("[data-pw-toggle]");
    if (!btn) return () => {};
    const set = (show) => {
      input.type = show ? "text" : "password";
      btn.setAttribute("aria-pressed", String(show));
      btn.setAttribute("aria-label", show ? "Ocultar senha" : "Mostrar senha");
      btn.replaceChildren(M.icon(show ? "eyeoff" : "eye"));
    };
    set(false);
    btn.addEventListener("click", () => set(input.type === "password"));
    return set;
  }

  M.password = {
    rules: RULES, evaluate, isValid, generate,
    bindToggle,

    /* Monta checklist, medidor e sugestões. `host` é o elemento onde o bloco aparece. */
    mount({ input, confirm, host }) {
      const showMain = bindToggle(input);
      const showConf = confirm ? bindToggle(confirm) : () => {};

      const bar = h("span", { class: "meter-bar" });
      const label = h("p", { class: "meter-label", "aria-live": "polite", text: "Força da senha: —" });
      const ruleEls = {};
      const list = h("ul", { class: "pw-rules" }, RULES.map((r) => {
        const li = h("li", { class: "pw-rule" }, h("span", { class: "dot" }, M.icon("check")), h("span", { text: r.label }));
        ruleEls[r.id] = li; return li;
      }));

      const sugList = h("ul", { class: "pw-sug-list" });
      const panel = h("div", { class: "pw-suggest", hidden: true },
        h("p", { class: "pw-suggest-title", text: "Sugestões geradas agora, só no seu navegador:" }),
        sugList,
        h("div", { class: "pw-suggest-foot" },
          h("button", { type: "button", class: "btn btn-soft btn-sm", onclick: fill }, M.icon("spark"), "Gerar outras"),
          h("p", { class: "hint", text: "Salve a senha escolhida em um gerenciador de senhas." })
        )
      );
      const openBtn = h("button", { type: "button", class: "btn btn-soft btn-sm", "aria-expanded": "false" }, M.icon("spark"), "Sugerir senha forte");

      function fill() {
        sugList.replaceChildren();
        for (let i = 0; i < 3; i++) {
          const pw = generate(16);
          sugList.append(h("li", { class: "pw-sug" },
            h("code", { text: pw }),
            h("button", { type: "button", class: "btn btn-soft btn-sm", onclick: () => use(pw) }, "Usar"),
            h("button", { type: "button", class: "icon-btn-sm", "aria-label": "Copiar senha", onclick: () => copy(pw) }, M.icon("copy"))
          ));
        }
      }
      function use(pw) {
        input.value = pw;
        if (confirm) confirm.value = pw;
        showMain(true); showConf(true);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        if (confirm) confirm.dispatchEvent(new Event("input", { bubbles: true }));
        M.toast("Senha aplicada nos dois campos. Copie e guarde com segurança.");
      }
      async function copy(pw) {
        try { await navigator.clipboard.writeText(pw); M.toast("Senha copiada."); }
        catch { M.toast("Não foi possível copiar. Selecione e copie manualmente.", "error"); }
      }
      openBtn.addEventListener("click", () => {
        const open = panel.hidden;
        panel.hidden = !open;
        openBtn.setAttribute("aria-expanded", String(open));
        if (open) fill();
      });

      function refresh() {
        const p = input.value, lv = level(p);
        evaluate(p).forEach((r) => ruleEls[r.id].classList.toggle("ok", r.ok && p.length > 0));
        bar.style.transform = `scaleX(${lv / 4})`;
        bar.dataset.lv = String(lv);
        label.textContent = "Força da senha: " + LEVELS[lv];
      }
      input.addEventListener("input", refresh);
      refresh();

      host.append(h("div", { class: "meter", "aria-hidden": "true" }, bar), label, list, h("div", { class: "pw-actions" }, openBtn), panel);
      return { valid: () => isValid(input.value) };
    },
  };
})();
