import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const number = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || "";
  // Strip "whatsapp:" prefix if present
  const clean = number.replace(/^whatsapp:/, "").replace(/[+\s-]/g, "");

  return new Response(
    JSON.stringify({ number: clean }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
