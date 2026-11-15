(function () {
  "use strict";
  const M = window.M, h = M.h, B = M.backend;
  const $ = (id) => document.getElementById(id);

  M.$$("[data-icon]").forEach((e) => e.prepend(M.icon(e.dataset.icon)));
  const next = M.safeNext(new URLSearchParams(location.search).get("next"));

  // quem já está logado vai direto para a conta
  B.getUser().then((u) => { if (u) location.replace(next); });

  let signupReady = false, pw = null, signupCaptcha = null;

  /* ---------- abas ---------- */
  const tabs = M.tabs($("auth-tabs").parentElement, (name) => {
    if (name === "cadastro" && !signupReady) initSignup();
    if (name === "entrar") history.replaceState(null, "", location.pathname + location.search);
    else history.replaceState(null, "", "#cadastro");
  });
  tabs.select(location.hash === "#cadastro" ? "cadastro" : "entrar");
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => tabs.select(location.hash === "#cadastro" ? "cadastro" : "entrar"));

  window.addEventListener("hashchange", () => tabs.select(location.hash === "#cadastro" ? "cadastro" : "entrar"));

  const showErr = (el, msg) => { el.textContent = msg; el.hidden = !msg; };

  /* ---------- login ---------- */
  const loginCaptcha = M.captcha($("l-captcha"));
  $("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("l-email"), pw = $("l-senha"), btn = e.submitter || e.target.querySelector("[type=submit]");
    showErr($("login-error"), "");
    let ok = true;
    if (!M.setError(email, M.validEmail(email.value) ? "" : "Informe um e-mail válido.")) ok = false;
    if (!M.setError(pw, pw.value ? "" : "Informe a sua senha.")) ok = false;
    if (!loginCaptcha.solved()) { showErr($("login-error"), "Confirme que você não é um robô para continuar."); ok = false; }
    if (!ok) return;
    M.setLoading(btn, true);
    try {
      await B.signIn({ email: email.value, password: pw.value, captchaToken: loginCaptcha.token() });
      location.href = next;
    } catch (err) {
      showErr($("login-error"), err.message);
      loginCaptcha.reset(); // o token do captcha vale para uma única tentativa
      M.setLoading(btn, false);
    }
  });
  M.password.bindToggle($("l-senha"));

  /* ---------- recuperar senha ---------- */
  let resetCaptcha = null;
  $("show-reset").addEventListener("click", () => {
    $("form-login").hidden = true; $("form-reset").hidden = false; $("r-email").value = $("l-email").value;
    if (!resetCaptcha) resetCaptcha = M.captcha($("r-captcha"));
    $("r-email").focus();
  });
  $("hide-reset").addEventListener("click", () => { $("form-reset").hidden = true; $("form-login").hidden = false; });
  $("form-reset").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("r-email"), btn = e.target.querySelector("[type=submit]"), msg = $("reset-msg");
    if (!M.setError(email, M.validEmail(email.value) ? "" : "Informe um e-mail válido.")) return;
    if (!resetCaptcha.solved()) { msg.hidden = false; msg.className = "form-error"; msg.textContent = "Confirme que você não é um robô."; return; }
    M.setLoading(btn, true);
    try {
      await B.resetPassword(email.value, resetCaptcha.token());
      msg.hidden = false; msg.className = "form-ok";
      msg.textContent = B.demo ? "Modo demonstração: nenhum e-mail é enviado." : "Se esse e-mail estiver cadastrado, você receberá o link em instantes. Confira também o spam.";
    } catch (err) { msg.hidden = false; msg.className = "form-error"; msg.textContent = err.message; }
    resetCaptcha.reset(); M.setLoading(btn, false);
  });

  /* ---------- cadastro ---------- */
  function initSignup() {
    signupReady = true;
    M.fillUF($("s-uf"));
    M.bindMasks($("form-signup"));
    const f = M.addressFields("s");
    M.cepLookup(f.cep, f);
    M.bindAddressLive(f);
    $("s-aceite").addEventListener("change", (e) => { if (e.target.checked) M.setError(e.target, ""); });
    pw = M.password.mount({ input: $("s-senha"), confirm: $("s-senha2"), host: $("s-pw-extra") });
    signupCaptcha = M.captcha($("s-captcha"));

    const rules = {
      "s-nome": (el) => (/^\S{2,}(\s+\S+)+$/.test(el.value.trim()) && el.value.trim().length >= 5 ? "" : "Informe seu nome completo (nome e sobrenome)."),
      "s-email": (el) => (M.validEmail(el.value) ? "" : "Informe um e-mail válido."),
      "s-celular": (el) => (M.validPhone(el.value) ? "" : "Informe um celular com DDD, ex.: (11) 90000-0000."),
      "s-cpf": (el) => (M.validCPF(el.value) ? "" : "CPF inválido. Confira os números."),
      "s-senha": (el) => (M.password.isValid(el.value) ? "" : "A senha ainda não cumpre todas as regras abaixo."),
      "s-senha2": (el) => (el.value && el.value === $("s-senha").value ? "" : "As senhas não são iguais."),
    };
    Object.entries(rules).forEach(([id, fn]) => {
      const el = $(id);
      el.addEventListener("blur", () => { if (el.value) M.setError(el, fn(el)); });
      el.addEventListener("input", () => { if (el.closest(".field").classList.contains("has-error")) M.setError(el, fn(el)); });
    });
    $("s-senha").addEventListener("input", () => { if ($("s-senha2").value) M.setError($("s-senha2"), rules["s-senha2"]($("s-senha2"))); });
    $("s-senha2").addEventListener("input", () => { if ($("s-senha2").value && $("s-senha2").value === $("s-senha").value) M.setError($("s-senha2"), ""); });
    $("form-signup").addEventListener("submit", (e) => { e.preventDefault(); submitSignup(e.submitter || e.target.querySelector("[type=submit]"), rules, f); });
  }

  async function submitSignup(btn, rules, f) {
    showErr($("signup-error"), "");
    let first = null, ok = true;
    Object.entries(rules).forEach(([id, fn]) => { const el = $(id); const m = fn(el); if (!M.setError(el, m)) { ok = false; first = first || el; } });
    if (!M.validateAddress(f)) { ok = false; first = first || M.$(".has-error input, .has-error select", $("form-signup")); }
    if (!$("s-aceite").checked) { M.setError($("s-aceite"), "Marque a caixa para concordar."); ok = false; first = first || $("s-aceite"); } else M.setError($("s-aceite"), "");
    if (!signupCaptcha.solved()) { showErr($("signup-error"), "Confirme que você não é um robô para continuar."); ok = false; }
    if (!ok) { if (first) first.focus(); return; }

    const addr = M.readAddress(f);
    const perfil = {
      nome_completo: $("s-nome").value.trim().replace(/\s+/g, " "),
      cpf: M.digits($("s-cpf").value), celular: M.digits($("s-celular").value), ...addr,
    };
    M.setLoading(btn, true);
    try {
      const r = await B.signUp({ email: $("s-email").value, password: $("s-senha").value, captchaToken: signupCaptcha.token(), perfil });
      if (r.needsConfirm) showConfirm($("s-email").value.trim());
      else location.href = next;
    } catch (err) {
      showErr($("signup-error"), err.message);
      signupCaptcha.reset(); M.setLoading(btn, false);
      $("signup-error").scrollIntoView({ behavior: M.reduced ? "auto" : "smooth", block: "center" });
    }
  }

  function showConfirm(email) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 84 84");
    svg.innerHTML = '<circle cx="42" cy="42" r="36"/><path d="M26 43l11 11 21-23"/>'; // constante
    const panel = $("panel-cadastro");
    panel.replaceChildren(h("div", { class: "success", role: "status" }, svg,
      h("h2", { text: "Confira o seu e-mail" }),
      h("p", { text: `Enviamos um link de confirmação para ${email}. Clique nele para ativar a conta e depois faça login.` }),
      h("button", { type: "button", class: "btn btn-primary", onclick: () => location.replace("login.html") }, "Ir para o login")));
  }
})();
