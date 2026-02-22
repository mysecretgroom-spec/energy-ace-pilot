import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || Deno.env.get("TWILIO_WHATSAPP_FROM");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name");

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const results = [];

    for (const profile of profiles || []) {
      try {
        const { data: rdvs, error: rdvsError } = await supabase
          .from("rdv")
          .select(`
            *,
            clients (
              nom,
              prenom,
              adresse,
              ville,
              code_postal,
              telephone,
              notes
            )
          `)
          .eq("user_id", profile.user_id)
          .gte("date_heure", todayStr)
          .lt("date_heure", tomorrowStr)
          .not("status", "in", '("annule","reporte")')
          .order("date_heure", { ascending: true });

        if (rdvsError) {
          console.error(`Error fetching RDVs for user ${profile.user_id}:`, rdvsError);
          continue;
        }

        if (!rdvs || rdvs.length === 0) {
          console.log(`No RDVs today for user ${profile.user_id}`);
          continue;
        }

        // Compute inter-RDV distances
        const interDistances: { toCity: string; km: number; minutes: number }[] = [];
        for (let i = 1; i < rdvs.length; i++) {
          const prev = rdvs[i - 1];
          const curr = rdvs[i];
          if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
            const km = haversineKm(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
            const estimatedKm = Math.round(km * 1.3);
            const estimatedMin = Math.round(estimatedKm / 60 * 60);
            interDistances.push({
              toCity: curr.clients?.ville || "?",
              km: estimatedKm,
              minutes: estimatedMin,
            });
          } else {
            interDistances.push({ toCity: curr.clients?.ville || "?", km: 0, minutes: 0 });
          }
        }

        // Alerts
        const alerts: string[] = [];
        const pendingRdvs = rdvs.filter(r => r.status === "a_confirmer" || r.status === "nouveau");
        if (pendingRdvs.length > 0) alerts.push(`⚠️ ${pendingRdvs.length} RDV à confirmer`);
        const noAddressRdvs = rdvs.filter(r => !r.adresse && !r.clients?.adresse);
        if (noAddressRdvs.length > 0) alerts.push(`📍 ${noAddressRdvs.length} RDV sans adresse`);

        // Calculate totals
        const totalDistance = rdvs.reduce((sum, r) => sum + (r.distance_km || 0), 0);
        const totalTravelTime = rdvs.reduce((sum, r) => sum + (r.travel_time_minutes || 0), 0);

        // Build briefing message
        const firstName = profile.first_name || "Commercial";
        const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
        const dateFormatted = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        let briefingTitle = `☀️ Bonjour ${firstName} !`;
        
        let briefingBody = `📅 ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} ${dateFormatted}\n`;
        briefingBody += `📍 ${rdvs.length} RDV aujourd'hui`;
        
        if (totalDistance > 0) briefingBody += ` • ${Math.round(totalDistance)} km`;
        if (totalTravelTime > 0) briefingBody += ` • ~${Math.round(totalTravelTime)} min de route`;
        briefingBody += "\n\n";

        // Alerts
        if (alerts.length > 0) briefingBody += alerts.join("\n") + "\n\n";

        // RDV details with inter-distances and summaries
        for (let i = 0; i < rdvs.length; i++) {
          const rdv = rdvs[i];
          const time = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
            hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
          });
          const clientName = rdv.clients 
            ? `${rdv.clients.prenom || ""} ${rdv.clients.nom}`.trim()
            : "Client";
          const city = rdv.clients?.ville || "";
          
          // Status icon
          const statusIcon = rdv.status === "a_confirmer" || rdv.status === "nouveau" ? "⚠️ " :
            rdv.status === "confirme" ? "✅ " : "";

          let rdvLine = `${statusIcon}⏰ ${time} - ${clientName}`;
          if (city) rdvLine += ` (${city})`;
          briefingBody += rdvLine + "\n";

          // RDV summary from import
          const summary = buildRdvSummary(rdv);
          if (summary) {
            briefingBody += `   📋 ${summary}\n`;
          }

          // Inter-RDV distance
          if (i < rdvs.length - 1 && i < interDistances.length) {
            const d = interDistances[i];
            if (d.km > 0) {
              briefingBody += `   🚗 → ${d.km} km • ~${d.minutes} min vers ${d.toCity}\n`;
            }
          }

          briefingBody += "\n";
        }

        // Motivational
        const motivationalMessages = [
          "🚀 Bonne journée !",
          "💪 C'est parti !",
          "🔥 Aujourd'hui va être une bonne journée !",
          "✨ Faisons de cette journée un succès !",
        ];
        briefingBody += motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

        // Send notification via OneSignal
        if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
          const notificationPayload = {
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: [profile.user_id],
            headings: { en: briefingTitle, fr: briefingTitle },
            contents: { en: briefingBody, fr: briefingBody },
            data: {
              type: "daily_briefing",
              date: todayStr,
              rdv_count: rdvs.length,
            },
          };

          const response = await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
            },
            body: JSON.stringify(notificationPayload),
          });

          const result = await response.json();
          console.log(`Notification sent to user ${profile.user_id}:`, result);

          results.push({
            user_id: profile.user_id,
            rdv_count: rdvs.length,
            success: response.ok,
            result,
          });
        }

        // Save to notifications table
        await supabase.from("notifications").insert({
          user_id: profile.user_id,
          type: "rappel",
          titre: briefingTitle,
          message: briefingBody,
          date_envoi: new Date().toISOString(),
        });

        // Send via WhatsApp
        const { data: userSettings } = await supabase
          .from("user_settings")
          .select("daily_briefing_whatsapp")
          .eq("user_id", profile.user_id)
          .single();

        if (userSettings?.daily_briefing_whatsapp !== false) {
          const { data: fullProfile } = await supabase
            .from("profiles")
            .select("phone")
            .eq("user_id", profile.user_id)
            .single();

          if (fullProfile?.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
            let phone = fullProfile.phone.replace(/\D/g, "");
            if (phone.startsWith("0")) phone = `33${phone.slice(1)}`;
            if (!phone.startsWith("+")) phone = `+${phone}`;

            // Split into multiple messages if needed (1500 char limit per WhatsApp message)
            const fullBody = `${briefingTitle}\n\n${briefingBody}`;
            const chunks = splitWhatsAppMessage(fullBody, 1500);

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
                  From: TWILIO_WHATSAPP_NUMBER,
                  To: `whatsapp:${phone}`,
                  Body: chunkBody,
                }).toString(),
              });
              const whatsappRes = await whatsappResp.json();
              console.log(`WhatsApp briefing part ${ci + 1}/${chunks.length} sent to ${phone}:`, whatsappResp.ok, whatsappRes.sid || whatsappRes.message);
            }
          }
        }

      } catch (userError) {
        console.error(`Error processing user ${profile.user_id}:`, userError);
        results.push({
          user_id: profile.user_id,
          success: false,
          error: String(userError),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Daily briefing error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// --- Helpers ---

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Extract a concise summary from RDV commentaire + metadata (gmail import info) */
function buildRdvSummary(rdv: any): string | null {
  const parts: string[] = [];

  if (rdv.type_projet && rdv.type_projet !== "photovoltaique") {
    parts.push(rdv.type_projet.toUpperCase());
  }

  const meta = rdv.metadata as Record<string, any> | null;
  if (meta) {
    if (meta.source_regie) parts.push(`Régie: ${meta.source_regie}`);
    if (meta.chauffage) parts.push(`Chauffage: ${meta.chauffage}`);
    if (meta.equipements) parts.push(meta.equipements);
    if (meta.revenus_fiscaux) parts.push(`RFR: ${meta.revenus_fiscaux}€`);
    if (meta.nombre_personnes) parts.push(`${meta.nombre_personnes} pers.`);
    if (meta.surface) parts.push(`${meta.surface}m²`);
    if (meta.needs_completion) {
      const missing = meta.missing_fields;
      if (Array.isArray(missing) && missing.length > 0) {
        parts.push(`⚠️ Manque: ${missing.join(", ")}`);
      }
    }
  }

  if (rdv.commentaire) {
    const comment = rdv.commentaire.trim();
    if (comment.length > 0) {
      const short = comment.length > 100 ? comment.slice(0, 97) + "..." : comment;
      parts.push(short);
    }
  }

  return parts.length > 0 ? parts.join(" • ") : null;
}

/** Split a long message into chunks that respect WhatsApp's char limit, splitting on line breaks */
function splitWhatsAppMessage(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  
  const chunks: string[] = [];
  const lines = text.split("\n");
  let current = "";

  for (const line of lines) {
    // If adding this line would exceed the limit, push current chunk
    if (current.length + line.length + 1 > maxLen && current.length > 0) {
      chunks.push(current.trimEnd());
      current = "";
    }
    // If a single line is longer than maxLen, force-split it
    if (line.length > maxLen) {
      if (current.length > 0) {
        chunks.push(current.trimEnd());
        current = "";
      }
      for (let i = 0; i < line.length; i += maxLen) {
        chunks.push(line.slice(i, i + maxLen));
      }
    } else {
      current += (current.length > 0 ? "\n" : "") + line;
    }
  }
  if (current.length > 0) chunks.push(current.trimEnd());
  
  return chunks;
}
