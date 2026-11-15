(function () {
  "use strict";
  const M = window.M, C = window.MEMORA;
  const DEMO = !(C.supabaseUrl && C.supabaseAnonKey);
  const SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const PROFILE_FIELDS = ["nome_completo", "celular", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf"];
  const listeners = new Set();
  // mesma regra do formulário; repetida aqui para valer mesmo se alguém chamar a função direto
  const strongPassword = (p) => typeof p === "string" && p.length >= 8 && p.length <= 72 && /\p{Lu}/u.test(p) && /\p{Ll}/u.test(p) && /\d/.test(p) && /[^\p{L}\p{N}\s]/u.test(p) && !/(senha|password|123456|qwerty|abcdef|memora)/i.test(p);
  let sb = null;

  const emit = (ev, user) => listeners.forEach((f) => { try { f(ev, user); } catch { /* ignora */ } });
  const slim = (u) => (u ? { id: u.id, email: u.email } : null);

  /* ---------- mensagens amigáveis (nunca vaza erro técnico ao cliente) ---------- */
  function friendly(err) {
    const m = String((err && (err.message || err.error_description)) || err || "").toLowerCase();
    if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. O link foi enviado para a sua caixa de entrada.";
    if (m.includes("captcha")) return "Não foi possível validar o captcha. Tente de novo.";
    if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
    if (m.includes("database error") || m.includes("duplicate") || m.includes("already")) return "Não foi possível concluir o cadastro. Confira os dados: o e-mail ou o CPF podem já estar cadastrados.";
    if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
    if (m.includes("password")) return "Essa senha não atende às regras de segurança. Escolha outra.";
    if (m.includes("failed to fetch") || m.includes("network") || m.includes("load")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
    return "Algo deu errado. Tente novamente em instantes.";
  }
  async function fnError(error) {
    try { const b = await error.context.json(); if (b && b.erro) return b.erro; } catch { /* sem corpo */ }
    return friendly(error);
  }
  const fail = (e) => { throw new Error(friendly(e)); };

  /* ---------- helpers do modo demonstração ---------- */
  const ls = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const b64e = (u8) => btoa(String.fromCharCode(...u8));
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function pbkdf2(pw, salt) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: b64d(salt), iterations: 150000, hash: "SHA-256" }, key, 256);
    return b64e(new Uint8Array(bits));
  }
  const newSalt = () => b64e(crypto.getRandomValues(new Uint8Array(16)));
  const demoUsers = () => ls("memora_demo_users", {});
  const demoSession = () => { const id = localStorage.getItem("memora_demo_session"); return id ? Object.values(demoUsers()).find((u) => u.id === id) || null : null; };

  /* ---------- inicialização ---------- */
  const ready = (async function () {
    if (DEMO) return;
    await new Promise((res, rej) => {
      if (window.supabase) return res();
      const s = document.createElement("script");
      s.src = SDK; s.onload = res; s.onerror = () => rej(new Error("load"));
      document.head.append(s);
    });
    sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    sb.auth.onAuthStateChange((ev, session) => emit(ev, slim(session && session.user)));
    await sb.auth.getSession();
  })().catch(() => { /* a página mostra o erro ao tentar usar */ });

  const B = (M.backend = {
    demo: DEMO,
    ready: () => ready,
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    async getUser() {
      await ready;
      if (DEMO) { const u = demoSession(); return u ? { id: u.id, email: u.email } : null; }
      if (!sb) return null;
      const { data } = await sb.auth.getSession();
      return slim(data.session && data.session.user);
    },

    async signUp({ email, password, captchaToken, perfil }) {
      await ready;
      email = email.trim().toLowerCase();
      if (!strongPassword(password)) throw new Error("Essa senha não atende às regras de segurança. Escolha outra.");
      if (!M.validEmail(email) || !M.validCPF(perfil.cpf) || !M.validPhone(perfil.celular) || !M.validCEP(perfil.cep)) throw new Error("Confira os dados do cadastro: algum campo está inválido.");
      if (DEMO) {
        const users = demoUsers();
        if (users[email] || Object.values(users).some((u) => u.perfil.cpf === perfil.cpf)) throw new Error(friendly("duplicate"));
        const salt = newSalt();
        const u = { id: crypto.randomUUID(), email, salt, hash: await pbkdf2(password, salt), perfil: { ...perfil, email } };
        users[email] = u; lsSet("memora_demo_users", users);
        localStorage.setItem("memora_demo_session", u.id);
        emit("SIGNED_IN", slim(u));
        return { needsConfirm: false };
      }
      if (!sb) fail("load");
      const { data, error } = await sb.auth.signUp({
        email, password,
        options: { data: perfil, captchaToken, emailRedirectTo: new URL("conta.html", location.href).href },
      });
      if (error) fail(error);
      return { needsConfirm: !data.session };
    },

    async signIn({ email, password, captchaToken }) {
      await ready;
      email = email.trim().toLowerCase();
      if (DEMO) {
        const u = demoUsers()[email];
        if (!u || (await pbkdf2(password, u.salt)) !== u.hash) throw new Error(friendly("invalid login"));
        localStorage.setItem("memora_demo_session", u.id);
        emit("SIGNED_IN", slim(u));
        return;
      }
      if (!sb) fail("load");
      const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken } });
      if (error) fail(error);
    },

    async signOut() {
      await ready;
      if (DEMO) { localStorage.removeItem("memora_demo_session"); emit("SIGNED_OUT", null); return; }
      if (sb) await sb.auth.signOut();
    },

    async resetPassword(email, captchaToken) {
      await ready;
      if (DEMO) return;
      const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { captchaToken, redirectTo: new URL("conta.html", location.href).href });
      if (error) fail(error);
    },

    async updatePassword(password) {
      await ready;
      if (DEMO) {
        const u = demoSession(); if (!u) throw new Error("Faça login de novo.");
        const users = demoUsers(); const salt = newSalt();
        users[u.email].salt = salt; users[u.email].hash = await pbkdf2(password, salt);
        lsSet("memora_demo_users", users); return;
      }
      const { error } = await sb.auth.updateUser({ password });
      if (error) fail(error);
    },

    async getProfile() {
      await ready;
      if (DEMO) { const u = demoSession(); return u ? { ...u.perfil } : null; }
      const user = await B.getUser(); if (!user) return null;
      const { data, error } = await sb.from("perfis").select("*").eq("id", user.id).single();
      if (error) fail(error);
      return data;
    },

    async updateProfile(patch) {
      await ready;
      const clean = {};
      PROFILE_FIELDS.forEach((k) => { if (k in patch) clean[k] = patch[k]; });
      if (DEMO) {
        const u = demoSession(); const users = demoUsers();
        users[u.email].perfil = { ...users[u.email].perfil, ...clean }; lsSet("memora_demo_users", users); return;
      }
      const user = await B.getUser();
      const { error } = await sb.from("perfis").update(clean).eq("id", user.id);
      if (error) fail(error);
    },

    async listOrders() {
      await ready;
      if (DEMO) { const u = demoSession(); return ls("memora_demo_orders", []).filter((o) => o.user_id === (u && u.id)).reverse(); }
      const { data, error } = await sb.from("pedidos").select("id,numero,itens,subtotal,frete_servico,frete_valor,total,status,criado_em,endereco").order("criado_em", { ascending: false });
      if (error) fail(error);
      return data;
    },

    /* ---- frete (Correios) ---- */
    async quoteShipping({ cep, uf, itens }) {
      await ready;
      if (DEMO) return demoQuote(uf, itens);
      const { data, error } = await sb.functions.invoke("frete", { body: { cep: M.digits(cep), itens } });
      if (error) throw new Error(await fnError(error));
      return data.opcoes;
    },

    /* ---- pedido + pagamento ---- */
    async createOrder({ itens, endereco, freteServico }) {
      await ready;
      if (DEMO) {
        const cat = await M.catalog(); const u = demoSession();
        const subtotal = itens.reduce((s, i) => s + M.lineTotal(M.product(cat, i.produto), i.variante, i.qtd), 0);
        const opc = (await demoQuote(endereco.uf, itens)).find((o) => o.servico === freteServico);
        const orders = ls("memora_demo_orders", []);
        const o = { id: crypto.randomUUID(), numero: 1001 + orders.length, user_id: u.id, itens, subtotal, frete_servico: freteServico, frete_valor: opc.valor, total: Math.round((subtotal + opc.valor) * 100) / 100, endereco, status: "aguardando_pagamento", criado_em: new Date().toISOString() };
        orders.push(o); lsSet("memora_demo_orders", orders);
        return { pedido_id: o.id, numero: o.numero, demo: true };
      }
      const { data, error } = await sb.functions.invoke("criar-pedido", { body: { itens, endereco, frete_servico: freteServico } });
      if (error) throw new Error(await fnError(error));
      return data;
    },
  });

  async function demoQuote(uf, itens) {
    const cat = await M.catalog();
    let g = 0;
    for (const i of itens) {
      const p = M.product(cat, i.produto); if (!p) continue;
      const pk = p.variantes ? M.variant(p, i.variante).pacote : p.pacote; if (!pk) continue;
      g += pk.peso_g * (p.qtd_min ? Math.ceil(i.qtd / p.qtd_min) : i.qtd);
    }
    const kgExtra = Math.max(0, Math.max(300, g) / 1000 - 1);
    const faixas = [
      { ufs: ["SP"], t: [22, 36, 4, 2] },
      { ufs: ["RJ", "MG", "ES"], t: [28, 46, 6, 3] },
      { ufs: ["PR", "SC", "RS", "DF", "GO", "MT", "MS"], t: [34, 58, 7, 3] },
      { ufs: ["AM", "PA", "AC", "RO", "RR", "AP", "TO"], t: [52, 96, 12, 5] },
    ];
    const f = faixas.find((x) => x.ufs.includes(uf)) || { t: [42, 74, 9, 4] };
    const r2 = (n) => Math.round(n * 100) / 100;
    return [
      { servico: "PAC", valor: r2(f.t[0] + kgExtra * 6), prazo: f.t[2], simulado: true },
      { servico: "SEDEX", valor: r2(f.t[1] + kgExtra * 9), prazo: f.t[3], simulado: true },
    ];
  }
})();
