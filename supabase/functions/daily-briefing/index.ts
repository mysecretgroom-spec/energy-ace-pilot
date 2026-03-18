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
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, first_name, phone");

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
        // ─── 1. Trigger Gmail sync for this user (if enabled) ───
        let gmailImportCount = 0;
        let gmailImportDetails: any[] = [];
        try {
          const syncResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/sync-gmail-rdv`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "x-user-id": profile.user_id,
              },
            }
          );
          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            gmailImportCount = (syncResult.imported || 0) + (syncResult.updated || 0);
            gmailImportDetails = syncResult.details?.filter(
              (d: any) => d.status === "imported" || d.status === "updated"
            ) || [];
            console.log(`Gmail sync for ${profile.user_id}: ${gmailImportCount} imported/updated`);

            // Update last sync time
            await supabase
              .from("user_settings")
              .update({ gmail_last_auto_sync: new Date().toISOString() })
              .eq("user_id", profile.user_id);
          }
        } catch (gmailErr) {
          console.warn(`Gmail sync failed for ${profile.user_id}:`, gmailErr);
        }

        // ─── 2. Fetch today's RDVs (after Gmail sync to include new imports) ───
        const [rdvsRes, ventesWeekRes, ventesMonthRes, rdvsWeekRes] = await Promise.all([
          supabase
            .from("rdv")
            .select(`*, clients (nom, prenom, adresse, ville, code_postal, telephone, notes, latitude, longitude)`)
            .eq("user_id", profile.user_id)
            .gte("date_heure", todayStr)
            .lt("date_heure", tomorrowStr)
            .not("status", "in", '("annule","reporte")')
            .order("date_heure", { ascending: true }),
          supabase
            .from("ventes")
            .select("montant_ttc, puissance_kwc, product_type, status, created_at")
            .eq("user_id", profile.user_id)
            .gte("created_at", getMonday(today))
            .not("status", "eq", "annule"),
          supabase
            .from("ventes")
            .select("montant_ttc, puissance_kwc, status")
            .eq("user_id", profile.user_id)
            .gte("created_at", `${todayStr.slice(0, 7)}-01`)
            .not("status", "eq", "annule"),
          supabase
            .from("rdv")
            .select("status")
            .eq("user_id", profile.user_id)
            .gte("date_heure", getMonday(today))
            .lt("date_heure", tomorrowStr)
            .not("status", "in", '("annule","reporte")'),
        ]);

        const rdvs = rdvsRes.data || [];
        const ventesWeek = ventesWeekRes.data || [];
        const ventesMonth = ventesMonthRes.data || [];
        const rdvsWeek = rdvsWeekRes.data || [];

        // Skip user if no RDVs today AND no Gmail imports
        if (rdvs.length === 0 && gmailImportCount === 0) {
          console.log(`No RDVs and no imports for user ${profile.user_id}, skipping`);
          continue;
        }

        // ─── 3. Analytics ───
        const weekCA = ventesWeek.reduce((s: number, v: any) => s + (v.montant_ttc || 0), 0);
        const weekKwc = ventesWeek.reduce((s: number, v: any) => s + (v.puissance_kwc || 0), 0);
        const monthCA = ventesMonth.reduce((s: number, v: any) => s + (v.montant_ttc || 0), 0);
        const weekSigned = ventesWeek.filter((v: any) => ["en_installation", "installe", "paye", "attente_paiement"].includes(v.status)).length;
        const weekRdvsDone = rdvsWeek.filter((r: any) => ["signe", "negatif", "r2", "r2_prestudy"].includes(r.status)).length;
        const weekConversion = weekRdvsDone > 0 ? Math.round((weekSigned / weekRdvsDone) * 100) : null;
        const pendingPayment = ventesMonth.filter((v: any) => v.status === "attente_paiement").length;

        // ─── 4. Inter-RDV distances (OSRM) ───
        const getCoords = (rdv: any): { lat: number; lon: number } | null => {
          if (rdv.latitude && rdv.longitude) return { lat: Number(rdv.latitude), lon: Number(rdv.longitude) };
          if (rdv.clients?.latitude && rdv.clients?.longitude) return { lat: Number(rdv.clients.latitude), lon: Number(rdv.clients.longitude) };
          return null;
        };

        const interDistances: { fromCity: string; toCity: string; km: number; minutes: number }[] = [];
        const routePromises: Promise<void>[] = [];
        for (let i = 1; i < rdvs.length; i++) {
          const prev = rdvs[i - 1];
          const curr = rdvs[i];
          const prevCoords = getCoords(prev);
          const currCoords = getCoords(curr);
          const idx = i - 1;
          if (prevCoords && currCoords) {
            routePromises.push(
              fetchRealRoute(prevCoords, currCoords).then((route) => {
                interDistances[idx] = {
                  fromCity: prev.clients?.ville || "?",
                  toCity: curr.clients?.ville || "?",
                  km: route.distance_km,
                  minutes: route.duration_minutes,
                };
              })
            );
          }
        }
        await Promise.all(routePromises);

        let totalInterKm = 0;
        let totalInterMinutes = 0;
        for (const d of interDistances) {
          if (d) {
            totalInterKm += d.km;
            totalInterMinutes += d.minutes;
          }
        }

        // ─── 5. Build unified briefing message ───
        const firstName = profile.first_name || "Commercial";
        const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
        const dateFormatted = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

        let briefingTitle = `☀️ Bonjour ${firstName} !`;
        let briefingBody = `📅 ${capitalize(dayName)} ${dateFormatted}\n`;

        // Gmail import summary (if any)
        if (gmailImportCount > 0) {
          const rdvLabel = gmailImportCount === 1 ? "nouveau RDV importé" : "nouveaux RDV importés";
          briefingBody += `\n📧 *${gmailImportCount} ${rdvLabel}* depuis Gmail\n`;

          for (const detail of gmailImportDetails.slice(0, 5)) {
            const label = detail.status === "updated" ? "🔄" : "✅";
            briefingBody += `${label} ${detail.subject?.substring(0, 60) || "RDV"}\n`;
          }
          if (gmailImportDetails.length > 5) {
            briefingBody += `...et ${gmailImportDetails.length - 5} autre(s)\n`;
          }
        }

        // (Stats semaine/mois retirées du briefing matinal)

        // Today's RDVs
        briefingBody += "\n";
        if (rdvs.length === 0) {
          briefingBody += "🎉 Aucun RDV actif aujourd'hui.\nIdéal pour prospecter ou relancer des dossiers en cours !\n";
        } else {
          briefingBody += `📍 *${rdvs.length} RDV aujourd'hui*`;
          if (totalInterKm > 0) briefingBody += ` • ${Math.round(totalInterKm)} km`;
          if (totalInterMinutes > 0) briefingBody += ` • ~${totalInterMinutes} min route`;
          briefingBody += "\n\n";

          // Alerts
          const alerts: string[] = [];
          const pendingRdvs = rdvs.filter((r: any) => r.status === "a_confirmer" || r.status === "nouveau");
          if (pendingRdvs.length > 0) alerts.push(`⚠️ ${pendingRdvs.length} RDV à confirmer`);
          const noAddressRdvs = rdvs.filter((r: any) => !r.adresse && !r.clients?.adresse);
          if (noAddressRdvs.length > 0) alerts.push(`📍 ${noAddressRdvs.length} RDV sans adresse`);
          if (alerts.length > 0) briefingBody += alerts.join("\n") + "\n\n";

          // RDV list
          for (let i = 0; i < rdvs.length; i++) {
            const rdv = rdvs[i];
            const time = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
              hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
            });
            const clientName = rdv.clients
              ? `${rdv.clients.prenom || ""} ${rdv.clients.nom}`.trim()
              : "Client";
            const city = rdv.clients?.ville || "";

            const statusIcon = rdv.status === "a_confirmer" || rdv.status === "nouveau" ? "⚠️ " :
              rdv.status === "confirme" ? "✅ " : "";

            let rdvLine = `${statusIcon}⏰ ${time} - ${clientName}`;
            if (city) rdvLine += ` (${city})`;
            briefingBody += rdvLine + "\n";

            const summary = buildRdvSummary(rdv);
            if (summary) {
              briefingBody += `   📋 ${summary}\n`;
            }

            // Inter-RDV distance to next
            if (i < rdvs.length - 1 && i < interDistances.length) {
              const d = interDistances[i];
              if (d && d.km > 0) {
                briefingBody += `   🚗 → ${d.km} km • ~${d.minutes} min vers ${d.toCity}\n`;
              }
            }

            briefingBody += "\n";
          }

          // First RDV address + Google Maps link
          const firstRdv = rdvs[0];
          const firstAddress = firstRdv.adresse || firstRdv.clients?.adresse;
          const firstCity = firstRdv.clients?.ville;
          const firstPostal = firstRdv.clients?.code_postal;

          if (firstAddress) {
            const fullAddress = [firstAddress, firstPostal, firstCity].filter(Boolean).join(" ");
            briefingBody += `🚗 *Vous commencez à :*\n${fullAddress}\n`;
            briefingBody += `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}\n\n`;
          }
        }

        // Motivational closer
        const motivational = [
          "🚀 Bonne journée et bonnes signatures !",
          "💪 C'est parti, chaque RDV compte !",
          "🔥 Aujourd'hui est une opportunité !",
          "✨ Transforme cette journée en succès !",
        ];
        briefingBody += motivational[Math.floor(Math.random() * motivational.length)];

        // ─── 6. Send OneSignal push notification ───
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
              gmail_imports: gmailImportCount,
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
            gmail_imports: gmailImportCount,
            success: response.ok,
            result,
          });
        }

        // ─── 7. Save in-app notification ───
        await supabase.from("notifications").insert({
          user_id: profile.user_id,
          type: "rappel",
          titre: briefingTitle,
          message: briefingBody,
          date_envoi: new Date().toISOString(),
        });

        // ─── 8. Send via WhatsApp ───
        const { data: userSettings } = await supabase
          .from("user_settings")
          .select("daily_briefing_whatsapp")
          .eq("user_id", profile.user_id)
          .single();

        if (userSettings?.daily_briefing_whatsapp !== false) {
          if (profile.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
            let phone = profile.phone.replace(/\D/g, "");
            if (phone.startsWith("0")) phone = `33${phone.slice(1)}`;
            if (!phone.startsWith("+")) phone = `+${phone}`;

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
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily briefing error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// --- Helpers ---

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split("T")[0];
}

function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

async function fetchRealRoute(
  origin: { lat: number; lon: number },
  destination: { lat: number; lon: number }
): Promise<{ distance_km: number; duration_minutes: number }> {
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;
    const res = await fetch(osrmUrl, {
      headers: { "User-Agent": "SolarFlow-CRM/1.0" },
    });
    const data = await res.json();
    if (data.code === "Ok" && data.routes?.length > 0) {
      const route = data.routes[0];
      return {
        distance_km: Math.round(route.distance / 100) / 10,
        duration_minutes: Math.round(route.duration / 60),
      };
    }
  } catch (e) {
    console.warn("OSRM routing failed, using fallback:", e);
  }

  const km = haversineKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const estimatedKm = Math.round(km * 1.3);
  return {
    distance_km: estimatedKm,
    duration_minutes: Math.round((estimatedKm / 50) * 60),
  };
}

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
