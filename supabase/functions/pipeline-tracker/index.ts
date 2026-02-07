import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Pipeline Tracker - Proactive alerts for stale pipeline items
 * Detects ventes stuck in a status for too long and sends WhatsApp alerts.
 * Called daily by cron.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || Deno.env.get("TWILIO_WHATSAPP_FROM");

    const now = new Date();
    const results: { userId: string; alertCount: number }[] = [];

    // Get users with pipeline alerts enabled
    const { data: settings } = await supabase
      .from("user_settings")
      .select("user_id, pipeline_stale_days")
      .eq("pipeline_alerts_enabled", true);

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users with alerts enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pipeline status flow and expected durations (in days)
    const statusExpectations: Record<string, { label: string; maxDays: number; nextAction: string }> = {
      signe: { label: "📝 Signé", maxDays: 3, nextAction: "Lancer le CQ" },
      cq_a_faire: { label: "🔴 CQ à faire", maxDays: 5, nextAction: "Faire le contrôle qualité" },
      cq_fait: { label: "🟡 CQ fait", maxDays: 3, nextAction: "Envoyer le financement" },
      attente_financement: { label: "🟡 Att. financement", maxDays: 10, nextAction: "Relancer le financement" },
      envoi_pose: { label: "🔵 Envoi pose", maxDays: 7, nextAction: "Planifier l'installation" },
      en_installation: { label: "🔵 Installation", maxDays: 5, nextAction: "Finaliser l'installation" },
      installe: { label: "✅ Installé", maxDays: 14, nextAction: "Relancer le paiement" },
      attente_paiement: { label: "💳 Att. paiement", maxDays: 14, nextAction: "Relancer le paiement" },
    };

    for (const setting of settings) {
      try {
        const staleDays = setting.pipeline_stale_days || 5;

        // Get all active ventes (not annulé, not payé)
        const { data: ventes } = await supabase
          .from("ventes")
          .select(`
            id, status, montant_ttc, puissance_kwc, updated_at, date_signature,
            clients (nom, prenom)
          `)
          .eq("user_id", setting.user_id)
          .not("status", "in", '("annule","paye")')
          .order("updated_at", { ascending: true });

        if (!ventes || ventes.length === 0) continue;

        const alerts: { vente: typeof ventes[0]; daysStale: number; expectation: typeof statusExpectations[string] }[] = [];

        for (const vente of ventes) {
          const expectation = statusExpectations[vente.status];
          if (!expectation) continue;

          const lastUpdate = new Date(vente.updated_at);
          const daysInStatus = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
          const threshold = Math.min(staleDays, expectation.maxDays);

          if (daysInStatus >= threshold) {
            alerts.push({ vente, daysStale: daysInStatus, expectation });
          }
        }

        if (alerts.length === 0) continue;

        // Get profile for WhatsApp
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, phone")
          .eq("user_id", setting.user_id)
          .single();

        // Build alert message
        const sections: string[] = [];
        sections.push(`🚨 *ALERTE PIPELINE* - ${alerts.length} dossier(s) en retard\n`);

        // Group by severity
        const critical = alerts.filter(a => a.daysStale >= a.expectation.maxDays * 1.5);
        const warning = alerts.filter(a => a.daysStale < a.expectation.maxDays * 1.5);

        if (critical.length > 0) {
          sections.push("🔴 *CRITIQUES:*");
          for (const alert of critical.slice(0, 5)) {
            // deno-lint-ignore no-explicit-any
            const client = alert.vente.clients as any;
            const name = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
            sections.push(
              `• *${name}* - ${alert.expectation.label} depuis ${alert.daysStale}j`
            );
            sections.push(`  → ${alert.expectation.nextAction}`);
          }
          sections.push("");
        }

        if (warning.length > 0) {
          sections.push("🟡 *ATTENTION:*");
          for (const alert of warning.slice(0, 5)) {
            // deno-lint-ignore no-explicit-any
            const client = alert.vente.clients as any;
            const name = `${client?.prenom || ""} ${client?.nom || ""}`.trim();
            sections.push(
              `• *${name}* - ${alert.expectation.label} depuis ${alert.daysStale}j`
            );
            sections.push(`  → ${alert.expectation.nextAction}`);
          }
          sections.push("");
        }

        if (alerts.length > 10) {
          sections.push(`_... et ${alerts.length - 10} autre(s)_`);
          sections.push("");
        }

        // Summary stats
        const totalStaleCA = alerts.reduce((sum, a) => sum + (a.vente.montant_ttc || 0), 0);
        sections.push(`💰 *CA en jeu:* ${totalStaleCA.toLocaleString("fr-FR")}€`);
        sections.push(`\n_💬 Réponds "détail [client]" pour agir_`);

        const message = sections.join("\n");

        // Save notification
        await supabase.from("notifications").insert({
          user_id: setting.user_id,
          type: "pipeline_alert",
          titre: `🚨 ${alerts.length} dossier(s) en retard`,
          message,
          date_envoi: new Date().toISOString(),
        });

        // Send WhatsApp
        if (profile?.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
          let phone = profile.phone.replace(/\D/g, "");
          if (phone.startsWith("0")) phone = `33${phone.slice(1)}`;
          if (!phone.startsWith("+")) phone = `+${phone}`;

          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: TWILIO_WHATSAPP_NUMBER,
              To: `whatsapp:${phone}`,
              Body: message,
            }).toString(),
          });
        }

        results.push({ userId: setting.user_id, alertCount: alerts.length });
      } catch (userError) {
        console.error(`Error for user ${setting.user_id}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Pipeline tracker error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
