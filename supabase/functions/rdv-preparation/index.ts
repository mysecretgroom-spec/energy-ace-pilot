import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

/**
 * Proactive RDV Preparation
 * Sends a detailed brief via WhatsApp + Push 1h before each upcoming RDV.
 * Includes: client info, consumption, documents missing, route, notes.
 * Called by cron every 15 minutes.
 */
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

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER") || Deno.env.get("TWILIO_WHATSAPP_FROM");

    const now = new Date();
    const results: { userId: string; rdvId: string; success: boolean }[] = [];

    // Get all users with rdv_prep_enabled
    const { data: settings } = await supabase
      .from("user_settings")
      .select("user_id, rdv_prep_minutes_before, rdv_prep_whatsapp")
      .eq("rdv_prep_enabled", true);

    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No users with prep enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const setting of settings) {
      try {
        const minutesBefore = setting.rdv_prep_minutes_before || 60;
        const windowStart = new Date(now.getTime() + (minutesBefore - 7) * 60000);
        const windowEnd = new Date(now.getTime() + (minutesBefore + 8) * 60000);

        // Find RDVs in the prep window that haven't been prepped yet
        const { data: rdvs } = await supabase
          .from("rdv")
          .select(`
            id, date_heure, status, type_rdv, adresse, ville, code_postal,
            distance_km, travel_time_minutes, notes, metadata,
            clients (
              id, nom, prenom, telephone, email, adresse, ville, code_postal,
              notes, source, regie_id
            )
          `)
          .eq("user_id", setting.user_id)
          .gte("date_heure", windowStart.toISOString())
          .lt("date_heure", windowEnd.toISOString())
          .not("status", "in", '("annule","signe","negatif")');

        if (!rdvs || rdvs.length === 0) continue;

        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, phone")
          .eq("user_id", setting.user_id)
          .single();

        for (const rdv of rdvs) {
          // Check if we already sent a prep for this RDV (prevent duplicates)
          const { data: existingNotif } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", setting.user_id)
            .eq("type", "rdv_preparation")
            .like("message", `%${rdv.id}%`)
            .limit(1);

          if (existingNotif && existingNotif.length > 0) continue;

          // deno-lint-ignore no-explicit-any
          const client = rdv.clients as any;
          if (!client) continue;

          const clientName = `${client.prenom || ""} ${client.nom}`.trim();
          const rdvTime = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
            hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
          });

          // Fetch related data in parallel
          const [etudeRes, docsRes, venteRes, regieRes] = await Promise.all([
            supabase.from("etudes")
              .select("consommation_annuelle_kwh, facture_annuelle_euros, puissance_kwc, product_type, notes")
              .eq("user_id", setting.user_id).eq("client_id", client.id)
              .order("created_at", { ascending: false }).limit(1),
            supabase.from("documents")
              .select("type_document")
              .eq("user_id", setting.user_id).eq("client_id", client.id),
            supabase.from("ventes")
              .select("status, montant_ttc")
              .eq("user_id", setting.user_id).eq("client_id", client.id)
              .neq("status", "annule").limit(1),
            client.regie_id
              ? supabase.from("regies").select("nom").eq("id", client.regie_id).single()
              : Promise.resolve({ data: null }),
          ]);

          // Build prep message
          const sections: string[] = [];
          sections.push(`📋 *BRIEF RDV - ${rdvTime}*`);
          sections.push(`👤 *${clientName}*`);
          sections.push("");

          // Contact & location
          sections.push("📍 *Coordonnées:*");
          const address = rdv.adresse || client.adresse;
          const city = rdv.ville || client.ville;
          if (address) sections.push(`• ${address}${city ? `, ${city}` : ""}`);
          if (client.telephone) sections.push(`• Tél: ${client.telephone}`);
          if (rdv.distance_km) sections.push(`• Distance: ${Math.round(rdv.distance_km)} km (${Math.round(rdv.travel_time_minutes || 0)} min)`);
          sections.push("");

          // Source & regie
          // deno-lint-ignore no-explicit-any
          const regie = regieRes?.data as any;
          if (client.source || regie?.nom) {
            sections.push("🏢 *Contexte:*");
            if (regie?.nom) sections.push(`• Régie: ${regie.nom}`);
            if (client.source) sections.push(`• Source: ${client.source}`);
            sections.push("");
          }

          // Consumption data from étude
          const etude = etudeRes.data?.[0];
          if (etude) {
            sections.push("⚡ *Profil énergie:*");
            if (etude.consommation_annuelle_kwh) sections.push(`• Conso: ${Math.round(etude.consommation_annuelle_kwh).toLocaleString("fr-FR")} kWh/an`);
            if (etude.facture_annuelle_euros) sections.push(`• Facture: ${Math.round(etude.facture_annuelle_euros).toLocaleString("fr-FR")}€/an`);
            if (etude.puissance_kwc) sections.push(`• Étude: ${etude.puissance_kwc} kWc`);
            sections.push("");
          }

          // Documents check
          const docs = docsRes.data || [];
          const docTypes = docs.map(d => d.type_document);
          const missingDocs: string[] = [];
          if (!docTypes.includes("cni")) missingDocs.push("CNI");
          if (!docTypes.includes("avis_imposition")) missingDocs.push("Avis imposition");
          if (!docTypes.includes("rib")) missingDocs.push("RIB");
          if (!docTypes.includes("facture_energie")) missingDocs.push("Facture énergie");

          if (missingDocs.length > 0) {
            sections.push(`⚠️ *Documents manquants:* ${missingDocs.join(", ")}`);
            sections.push("");
          } else {
            sections.push("✅ *Dossier complet*");
            sections.push("");
          }

          // Previous vente status
          const vente = venteRes.data?.[0];
          if (vente) {
            const statusLabels: Record<string, string> = {
              signe: "📝 Signé", cq_a_faire: "🔴 CQ à faire", installe: "✅ Posé", paye: "💰 Payé",
            };
            sections.push(`💼 *Vente:* ${statusLabels[vente.status] || vente.status} (${(vente.montant_ttc || 0).toLocaleString("fr-FR")}€)`);
            sections.push("");
          }

          // Client notes
          if (client.notes) {
            sections.push(`💬 *Notes:* ${client.notes.substring(0, 150)}${client.notes.length > 150 ? "..." : ""}`);
            sections.push("");
          }

          // Gmail notes from RDV metadata
          // deno-lint-ignore no-explicit-any
          const meta = rdv.metadata as any;
          if (meta?.gmail_body_preview) {
            sections.push(`📧 *Gmail:* ${meta.gmail_body_preview.substring(0, 100)}...`);
            sections.push("");
          }

          sections.push(`💡 _Bonne visite, ${profile?.first_name || "bon courage"} !_`);

          const message = sections.join("\n");

          // Save notification
          await supabase.from("notifications").insert({
            user_id: setting.user_id,
            type: "rdv_preparation",
            titre: `📋 Brief: ${clientName} à ${rdvTime}`,
            message: message + `\n[rdv:${rdv.id}]`,
            date_envoi: new Date().toISOString(),
          });

          // Send via WhatsApp if enabled
          if (setting.rdv_prep_whatsapp && profile?.phone && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER) {
            let phone = profile.phone.replace(/\D/g, "");
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
                From: TWILIO_WHATSAPP_NUMBER,
                To: `whatsapp:${phone}`,
                Body: message,
              }).toString(),
            });

            const twilioRes = await resp.json();
            console.log(`RDV prep sent to ${phone} for rdv ${rdv.id}:`, resp.ok, twilioRes.sid || twilioRes.message);
          }

          results.push({ userId: setting.user_id, rdvId: rdv.id, success: true });
        }
      } catch (userError) {
        console.error(`Error for user ${setting.user_id}:`, userError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, prepared: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("RDV preparation error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
