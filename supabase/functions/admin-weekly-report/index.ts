import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ADMIN_WHATSAPP = Deno.env.get("ADMIN_WHATSAPP_NUMBER");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || Deno.env.get("TWILIO_WHATSAPP_NUMBER");

    if (!ADMIN_WHATSAPP || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
      return new Response(JSON.stringify({ error: "Missing config" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Date range: last 7 days
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();
    const nowStr = now.toISOString();

    const weekLabel = `${weekAgo.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - ${now.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

    // Get all users
    const { data: allUsers } = await supabase.rpc("get_saas_users" as any);
    const totalUsers = allUsers?.length || 0;

    // New users this week
    const newUsers = allUsers?.filter((u: any) => new Date(u.created_at) >= weekAgo) || [];

    // Get access states
    const { data: accessStates } = await supabase.rpc("get_all_saas_access_states" as any);
    const activeCount = accessStates?.filter((a: any) => a.app_access === "active").length || 0;
    const trialCount = accessStates?.filter((a: any) => a.app_access === "trial").length || 0;
    const paywallCount = accessStates?.filter((a: any) => a.app_access === "paywall").length || 0;
    const betaCount = accessStates?.filter((a: any) => a.is_beta_tester).length || 0;

    // Get subscriptions
    const { data: subs } = await supabase.rpc("get_all_saas_subscriptions" as any);
    const activeSubs = subs?.filter((s: any) => s.status === "active").length || 0;
    const pastDueSubs = subs?.filter((s: any) => s.status === "past_due").length || 0;

    // Estimated MRR (55.26€/month per active sub)
    const mrr = activeSubs * 55.26;

    // Build message
    let message = `📊 *RAPPORT ADMIN HEBDO*\n_(${weekLabel})_\n\n`;

    message += `👥 *Utilisateurs*\n`;
    message += `• Total : ${totalUsers}\n`;
    message += `• Nouveaux cette semaine : ${newUsers.length}\n`;
    if (newUsers.length > 0) {
      const newNames = newUsers
        .slice(0, 5)
        .map((u: any) => `  → ${u.first_name || ""} ${u.last_name || ""} (${u.email})`.trim())
        .join("\n");
      message += `${newNames}\n`;
      if (newUsers.length > 5) message += `  ... et ${newUsers.length - 5} autres\n`;
    }

    message += `\n📈 *Statuts d'accès*\n`;
    message += `• Actifs (payants) : ${activeCount}\n`;
    message += `• En essai : ${trialCount}\n`;
    message += `• Paywall : ${paywallCount}\n`;
    if (betaCount > 0) message += `• Bêta-testeurs : ${betaCount}\n`;

    message += `\n💰 *Abonnements*\n`;
    message += `• Actifs : ${activeSubs}\n`;
    if (pastDueSubs > 0) message += `• ⚠️ Impayés : ${pastDueSubs}\n`;
    message += `• MRR estimé : ${mrr.toFixed(2)}€\n`;

    // Motivational
    const tips = [
      "\n✅ Tout roule !",
      "\n🚀 La croissance continue !",
      "\n💪 Belle semaine !",
    ];
    message += tips[Math.floor(Math.random() * tips.length)];

    // Send via WhatsApp
    let phone = ADMIN_WHATSAPP.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = `33${phone.slice(1)}`;
    if (!phone.startsWith("+")) phone = `+${phone}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_FROM,
        To: `whatsapp:${phone}`,
        Body: message,
      }).toString(),
    });

    const result = await resp.json();
    console.log("Admin weekly report:", resp.ok ? "sent" : "failed", result.sid || result.message);

    return new Response(
      JSON.stringify({ success: resp.ok, messageSid: result.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Admin weekly report error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
