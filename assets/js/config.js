/* Configuração PÚBLICA do site. Nada aqui é segredo.
   A anon key do Supabase e a site key do Turnstile foram feitas para ficar no navegador;
   a proteção real está nas regras (RLS) do banco e nas funções de servidor. */
document.documentElement.classList.add("js");
if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (e) { document.documentElement.style.display = "none"; } } // anti-clickjacking
window.__initialHash = location.hash; // lido antes de o SDK de login limpar o endereço

window.MEMORA = {
  nome: "Memora Studio",
  whatsapp: "5511958626251",
  instagramUser: "memorastudio.3d",
  instagramUrl: "https://www.instagram.com/memorastudio.3d/",

  // Preencha depois de criar o projeto no Supabase (veja o README).
  // Enquanto estiverem vazios, o site roda em MODO DEMONSTRAÇÃO (contas e pedidos
  // ficam só neste navegador, nada é enviado a servidor e nenhum pagamento é cobrado).
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Site key do Cloudflare Turnstile (captcha). Vazia = captcha de demonstração.
  turnstileSiteKey: "",
};
