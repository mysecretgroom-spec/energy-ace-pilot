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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    // Get all users with weekly recap enabled
    const { data: settings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, weekly_recap_enabled")
      .eq("weekly_recap_enabled", true);

    if (settingsError) throw settingsError;

    const results: { userId: string; success: boolean; error?: string }[] = [];

    for (const setting of settings || []) {
      try {
        const userId = setting.user_id;

        // Get profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("user_id", userId)
          .single();

        const firstName = profile?.first_name || "Commercial";

        // Calculate current week dates (Israeli week: Sunday to Saturday)
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0=Sun
        // Go back to this week's Sunday
        const thisSunday = new Date(now);
        thisSunday.setDate(now.getDate() - dayOfWeek);
        thisSunday.setHours(0, 0, 0, 0);
        // End = next Saturday end (Sunday + 7 days)
        const nextSunday = new Date(thisSunday);
        nextSunday.setDate(thisSunday.getDate() + 7);

        // Previous week for trends comparison (previous Sun-Sat)
        const prevSunday = new Date(thisSunday);
        prevSunday.setDate(prevSunday.getDate() - 7);
        const prevEnd = new Date(thisSunday);

        const startStr = thisSunday.toISOString();
        const endStr = nextSunday.toISOString();
        const prevStartStr = prevSunday.toISOString();
        const prevEndStr = prevEnd.toISOString();
        const satLabel = new Date(nextSunday.getTime() - 86400000);
        const weekLabel = `${thisSunday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} - ${satLabel.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;

        // Fetch RDVs of the week
        const { data: rdvs } = await supabase
          .from("rdv")
          .select("id, status, type_rdv")
          .eq("user_id", userId)
          .gte("date_heure", startStr)
          .lt("date_heure", endStr);

        // Fetch previous week RDVs for trends
        const { data: prevRdvs } = await supabase
          .from("rdv")
          .select("id, status")
          .eq("user_id", userId)
          .gte("date_heure", prevStartStr)
          .lt("date_heure", prevEndStr);

        // Statuts considérés comme "non effectués" (pas réellement tenus)
        const statusNonFait = ["annule", "reporte", "absent", "porte"];
        
        const rdvEffectues = rdvs?.filter(r => !statusNonFait.includes(r.status)) || [];
        const totalRdvEffectues = rdvEffectues.length;
        const signeRdv = rdvEffectues.filter(r => r.status === "signe").length;
        const negatifRdv = rdvEffectues.filter(r => r.status === "negatif").length;
        const r2Rdv = rdvEffectues.filter(r => r.status === "r2" || r.status === "r2_prestudy").length;
        const annuleRdv = rdvs?.filter(r => r.status === "annule").length || 0;
        const reporteRdv = rdvs?.filter(r => r.status === "reporte").length || 0;
        const tauxTransfo = totalRdvEffectues > 0 ? Math.round((signeRdv / totalRdvEffectues) * 100) : 0;

        const prevRdvEffectues = prevRdvs?.filter(r => !statusNonFait.includes(r.status)) || [];
        const prevTotalRdvEffectues = prevRdvEffectues.length;
        const prevSigneRdv = prevRdvEffectues.filter(r => r.status === "signe").length;
        const prevTauxTransfo = prevTotalRdvEffectues > 0 ? Math.round((prevSigneRdv / prevTotalRdvEffectues) * 100) : 0;

        // Fetch ventes signed this week
        const { data: ventes } = await supabase
          .from("ventes")
          .select("id, montant_ttc, puissance_kwc, type_rdv")
          .eq("user_id", userId)
          .neq("type_rdv", "external_installation")
          .neq("status", "annule")
          .gte("date_signature", startStr)
          .lt("date_signature", endStr);

        // Previous week ventes for trends
        const { data: prevVentes } = await supabase
          .from("ventes")
          .select("id, montant_ttc")
          .eq("user_id", userId)
          .neq("type_rdv", "external_installation")
          .neq("status", "annule")
          .gte("date_signature", prevStartStr)
          .lt("date_signature", prevEndStr);

        const ventesCount = ventes?.length || 0;
        const totalCA = ventes?.reduce((sum, v) => sum + (v.montant_ttc || 0), 0) || 0;
        const totalKwc = ventes?.reduce((sum, v) => sum + (v.puissance_kwc || 0), 0) || 0;

        const prevVentesCount = prevVentes?.length || 0;
        const prevTotalCA = prevVentes?.reduce((sum, v) => sum + (v.montant_ttc || 0), 0) || 0;

        // Trend indicator helper
        const trend = (current: number, previous: number): string => {
          if (previous === 0 && current === 0) return "";
          if (previous === 0) return " ↑";
          const diff = Math.round(((current - previous) / previous) * 100);
          if (diff > 0) return ` ↑+${diff}%`;
          if (diff < 0) return ` ↓${diff}%`;
          return " ═";
        };

        // Build recap message — use ventes as single source of truth for signatures
        const totalRdvLabel = rdvs?.length || 0;
        let message = `📊 *RÉCAP SEMAINE* (${weekLabel})\n`;
        message += `Salut ${firstName} ! Voici ton bilan :\n\n`;
        
        message += `📅 *RDV effectués :* ${totalRdvEffectues}${trend(totalRdvEffectues, prevTotalRdvEffectues)}\n`;
        if (ventesCount > 0) message += `✅ Signés : ${ventesCount}${trend(ventesCount, prevVentesCount)}\n`;
        if (negatifRdv > 0) message += `❌ Négatifs : ${negatifRdv}\n`;
        if (r2Rdv > 0) message += `🔄 R2 : ${r2Rdv}\n`;
        if (reporteRdv > 0) message += `⏳ Reportés : ${reporteRdv}\n`;
        if (annuleRdv > 0) message += `🚫 Annulés : ${annuleRdv}\n`;
        const tauxTransfoVentes = totalRdvEffectues > 0 ? Math.round((ventesCount / totalRdvEffectues) * 100) : 0;
        const prevTauxTransfoVentes = prevTotalRdvEffectues > 0 ? Math.round((prevVentesCount / prevTotalRdvEffectues) * 100) : 0;
        message += `📈 Taux de transformation : ${tauxTransfoVentes}%${trend(tauxTransfoVentes, prevTauxTransfoVentes)}\n\n`;

        if (ventesCount > 0) {
          message += `💰 *Ventes signées :* ${ventesCount}\n`;
          message += `💶 CA total : ${totalCA.toLocaleString("fr-FR")}€ TTC${trend(totalCA, prevTotalCA)}\n`;
          message += `⚡ Puissance : ${totalKwc.toFixed(1)} kWc\n`;
        } else {
          message += `💰 Aucune vente signée cette semaine\n`;
        }

        // Motivational message
        const motivations = [
          "\n🚀 Continue comme ça !",
          "\n💪 Semaine prochaine, on fait encore mieux !",
          "\n🔥 Tu assures !",
          "\n✨ Belle semaine !",
        ];
        message += motivations[Math.floor(Math.random() * motivations.length)];

        // Save to notifications table
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: userId,
          type: "autre",
          titre: `📊 Récap semaine ${weekLabel}`,
          message,
          date_envoi: new Date().toISOString(),
        });
        if (notifError) console.error("Notification insert error:", notifError);

        // Send via OneSignal if configured
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
              headings: { fr: `📊 Récap semaine ${weekLabel}` },
              contents: { fr: `${totalRdv} RDV • ${signeRdv} signés • ${totalCA.toLocaleString("fr-FR")}€ CA` },
              data: { type: "weekly_recap" },
            }),
          });
        }

        // Send via WhatsApp if user has a phone
        const { data: whatsAppProfile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("user_id", userId)
          .single();

        if (whatsAppProfile?.phone) {
          const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
          const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
          const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM") || Deno.env.get("TWILIO_WHATSAPP_NUMBER");

          if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM) {
            let phone = whatsAppProfile.phone.replace(/\D/g, "");
            if (phone.startsWith("0")) phone = `33${phone.slice(1)}`;
            if (!phone.startsWith("+")) phone = `+${phone}`;

            // Smart chunking for WhatsApp (1500 char limit)
            const chunks = splitWhatsAppMessage(message, 1500);

            const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
            for (let ci = 0; ci < chunks.length; ci++) {
              const chunkBody = chunks.length > 1 ? `(${ci + 1}/${chunks.length}) ${chunks[ci]}` : chunks[ci];
              const whatsappResp = await fetch(twilioUrl, {
                method: "POST",
                headers: {
                  Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  From: TWILIO_WHATSAPP_FROM,
                  To: `whatsapp:${phone}`,
                  Body: chunkBody,
                }).toString(),
              });
              const whatsappRes = await whatsappResp.json();
              console.log(`WhatsApp recap part ${ci + 1}/${chunks.length} sent to ${phone}:`, whatsappResp.ok, whatsappRes.sid || whatsappRes.message);
            }
          }
        }

        results.push({ userId, success: true });
      } catch (err) {
        console.error(`Error for user ${setting.user_id}:`, err);
        results.push({ userId: setting.user_id, success: false, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weekly recap error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Smart split for WhatsApp messages.
 * Splits on logical blocks (delimited by double newlines) so each block stays intact.
 */
function splitWhatsAppMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const blocks = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current.length > 0 ? current + "\n\n" + block : block;
    
    if (candidate.length > maxLen && current.length > 0) {
      chunks.push(current.trimEnd());
      current = block;
    } else {
      current = candidate;
    }

    if (current.length > maxLen) {
      const lines = current.split("\n");
      current = "";
      for (const line of lines) {
        const lineCandidate = current.length > 0 ? current + "\n" + line : line;
        if (lineCandidate.length > maxLen && current.length > 0) {
          chunks.push(current.trimEnd());
          current = line;
        } else {
          current = lineCandidate;
        }
      }
    }
  }
  if (current.length > 0) chunks.push(current.trimEnd());

  return chunks;
}
