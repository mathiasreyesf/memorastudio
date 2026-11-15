(function () {
  "use strict";
  const M = window.M, C = window.MEMORA, h = M.h;
  let tsP = null;

  function loadTurnstile() {
    if (!tsP) {
      tsP = new Promise((res, rej) => {
        if (window.turnstile) return res();
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true; s.onload = res; s.onerror = () => rej(new Error("captcha"));
        document.head.append(s);
      });
    }
    return tsP;
  }

  /* Retorna { token(), solved(), reset() }. O token do Turnstile é validado pelo
     servidor (Supabase) a cada login/cadastro; no modo demo é só ilustrativo. */
  M.captcha = function (container) {
    let token = null, id = null;
    container.classList.add("captcha");

    if (C.turnstileSiteKey) {
      container.append(h("p", { class: "captcha-msg", text: "Carregando verificação de segurança…" }));
      loadTurnstile().then(() => {
        container.textContent = "";
        id = window.turnstile.render(container, {
          sitekey: C.turnstileSiteKey, theme: "light", language: "pt-br",
          callback: (t) => { token = t; container.classList.add("is-ok"); },
          "expired-callback": () => { token = null; container.classList.remove("is-ok"); },
          "error-callback": () => { token = null; },
        });
      }).catch(() => { container.textContent = "Não foi possível carregar a verificação. Recarregue a página."; });
      return {
        token: () => token, solved: () => !!token,
        reset() { token = null; container.classList.remove("is-ok"); if (id != null && window.turnstile) window.turnstile.reset(id); },
      };
    }

    // modo demonstração
    let ok = false;
    const box = h("button", { type: "button", class: "captcha-box", role: "checkbox", "aria-checked": "false", "aria-label": "Não sou um robô" }, M.icon("check"));
    const label = h("span", { text: "Não sou um robô" });
    container.append(box, label, h("small", { text: "verificação de demonstração" }));
    box.addEventListener("click", () => {
      if (ok || box.classList.contains("busy")) return;
      box.classList.add("busy");
      setTimeout(() => { box.classList.remove("busy"); ok = true; box.setAttribute("aria-checked", "true"); container.classList.add("is-ok"); }, 650);
    });
    return {
      token: () => (ok ? "demo" : null), solved: () => ok,
      reset() { ok = false; box.setAttribute("aria-checked", "false"); container.classList.remove("is-ok"); },
    };
  };
})();
