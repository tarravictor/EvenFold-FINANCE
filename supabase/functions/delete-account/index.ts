import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readKey(name: string, fallback: string) {
  const raw = Deno.env.get(name);
  if (!raw) return Deno.env.get(fallback) || "";
  try {
    const parsed = JSON.parse(raw);
    return parsed.default || Object.values(parsed)[0] || "";
  } catch {
    return raw;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in again before deleting your account." }, 401);

  const body = await req.json().catch(() => ({}));
  if (body?.confirm !== "DELETE") return json({ error: "Type DELETE to confirm account deletion." }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = readKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
  const secretKey = readKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !publishableKey || !secretKey) {
    return json({ error: "Account deletion is not configured." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: "Your session expired. Please sign in again." }, 401);

  const { error: stateError } = await adminClient
    .from("finance_state")
    .delete()
    .eq("owner", data.user.id);
  if (stateError) return json({ error: stateError.message }, 500);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ ok: true });
});
