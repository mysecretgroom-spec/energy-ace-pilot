// Issues a one-time sign-in token for the shared, read-only visitor (demo) account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const VISITOR_EMAIL = "test@debalepro.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: VISITOR_EMAIL });
    if (error || !data?.properties?.hashed_token) throw error ?? new Error("no token");
    return new Response(JSON.stringify({ token_hash: data.properties.hashed_token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[visitor-session]", e);
    return new Response(JSON.stringify({ error: "Mode visiteur indisponible" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
