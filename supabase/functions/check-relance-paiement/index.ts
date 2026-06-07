import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauthorized = requireCronAuth(req, { corsHeaders });
  if (unauthorized) return unauthorized;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    // Get all users with relance enabled
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, relance_paiement_delay_days")
      .eq("relance_paiement_enabled", true);

    if (settingsError) throw settingsError;

    const results: { userId: string; relances: number }[] = [];

    for (const setting of settings || []) {
      const userId = setting.user_id;
      const delayDays = setting.relance_paiement_delay_days || 14;

      // Find ventes in attente_paiement for more than delay_days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - delayDays);

      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select(`
          id, 
          montant_ttc, 
          status, 
          date_installation_reelle,
          clients(nom, prenom),
          regies(id, nom)
        `)
        .eq("user_id", userId)
        .eq("status", "attente_paiement")
        .lt("date_installation_reelle", cutoffDate.toISOString());

      if (ventesError) {
        console.error(`Error fetching ventes for ${userId}:`, ventesError);
        continue;
      }

      if (!ventes || ventes.length === 0) continue;

      // Group by régie
      const byRegie = new Map<string, typeof ventes>();
      for (const v of ventes) {
        const regieKey = (v.regies as any)?.nom || "Sans régie";
        const existing = byRegie.get(regieKey) || [];
        existing.push(v);
        byRegie.set(regieKey, existing);
      }

      // Build notification message
      let message = `💰 *RELANCE PAIEMENT*\n`;
      message += `${ventes.length} vente(s) en attente de paiement depuis +${delayDays}j :\n\n`;

      for (const [regieName, regieVentes] of byRegie) {
        const totalCA = regieVentes.reduce((sum, v) => sum + (v.montant_ttc || 0), 0);
        message += `🏢 *${regieName}* (${regieVentes.length} dossier${regieVentes.length > 1 ? "s" : ""} • ${totalCA.toLocaleString("fr-FR")}€)\n`;
        for (const v of regieVentes) {
          const clientName = `${(v.clients as any)?.prenom || ""} ${(v.clients as any)?.nom || ""}`.trim();
          const installDate = v.date_installation_reelle 
            ? new Date(v.date_installation_reelle).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
            : "?";
          message += `  • ${clientName} - ${(v.montant_ttc || 0).toLocaleString("fr-FR")}€ (posé le ${installDate})\n`;
        }
        message += "\n";
      }

      message += `💡 Pense à relancer les régies concernées !`;

      // Save to notifications
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "rappel",
        titre: `💰 ${ventes.length} vente(s) en attente de paiement`,
        message,
        date_envoi: new Date().toISOString(),
      });

      // Send push notification
      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [userId],
            headings: { fr: `💰 Relance paiement` },
            contents: { fr: `${ventes.length} vente(s) en attente depuis +${delayDays}j` },
            data: { type: "relance_paiement" },
          }),
        });
      }

      results.push({ userId, relances: ventes.length });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Check relance paiement error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
