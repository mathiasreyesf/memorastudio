import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const cors = () => ({
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(), "Content-Type": "application/json" } });

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ erro: e.message }, e.status);
  console.error(e); // o detalhe fica só no log do servidor
  return json({ erro: "Algo deu errado. Tente novamente em instantes." }, 500);
}

// Exige um cliente logado (o token anônimo do site não basta)
export async function requireUser(req: Request) {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Faça login para continuar.");
  return { user: data.user, sb };
}

export const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
