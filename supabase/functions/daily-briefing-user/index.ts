import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError);
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Get today's RDVs for this user
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
          telephone
        )
      `)
      .eq("user_id", userId)
      .gte("date_heure", todayStr)
      .lt("date_heure", tomorrowStr)
      .order("date_heure", { ascending: true });

    if (rdvsError) {
      console.error("Error fetching RDVs:", rdvsError);
      throw rdvsError;
    }

    // Build briefing message
    const firstName = profile?.first_name || "Commercial";
    const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
    const dateFormatted = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

    let briefingTitle = `☀️ Bonjour ${firstName} !`;
    let briefingBody = `📅 ${dayName} ${dateFormatted}\n`;

    if (!rdvs || rdvs.length === 0) {
      briefingBody += "🎉 Aucun RDV prévu aujourd'hui.\nProfitez-en pour prospecter ou vous former !";
    } else {
      // Check for alerts
      const alerts: string[] = [];
      const pendingRdvs = rdvs.filter(r => r.status === "a_confirmer");
      if (pendingRdvs.length > 0) {
        alerts.push(`⚠️ ${pendingRdvs.length} RDV à confirmer`);
      }

      const noAddressRdvs = rdvs.filter(r => !r.adresse && !r.clients?.adresse);
      if (noAddressRdvs.length > 0) {
        alerts.push(`📍 ${noAddressRdvs.length} RDV sans adresse`);
      }

      // Calculate total distance
      const totalDistance = rdvs.reduce((sum, r) => sum + (r.distance_km || 0), 0);
      const totalTravelTime = rdvs.reduce((sum, r) => sum + (r.travel_time_minutes || 0), 0);

      briefingBody += `📍 ${rdvs.length} RDV aujourd'hui`;
      
      if (totalDistance > 0) {
        briefingBody += ` • ${Math.round(totalDistance)} km`;
      }
      if (totalTravelTime > 0) {
        briefingBody += ` • ${Math.round(totalTravelTime)} min de route`;
      }
      briefingBody += "\n\n";

      // Add RDV details
      for (const rdv of rdvs) {
        const time = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Paris",
        });
        const clientName = rdv.clients 
          ? `${rdv.clients.prenom || ""} ${rdv.clients.nom}`.trim()
          : "Client";
        const city = rdv.clients?.ville || "";
        
        let rdvLine = `⏰ ${time} - ${clientName}`;
        if (city) rdvLine += ` (${city})`;
        if (rdv.distance_km) rdvLine += ` • ${Math.round(rdv.distance_km)} km`;
        
        // Status indicator
        if (rdv.status === "a_confirmer") {
          rdvLine = "⚠️ " + rdvLine;
        } else if (rdv.status === "confirme") {
          rdvLine = "✅ " + rdvLine;
        }
        
        briefingBody += rdvLine + "\n";
      }

      // Add alerts
      if (alerts.length > 0) {
        briefingBody += "\n" + alerts.join("\n");
      }

      // Add motivational message
      const motivationalMessages = [
        "🚀 Bonne journée !",
        "💪 C'est parti !",
        "🔥 Aujourd'hui va être une bonne journée !",
        "✨ Faisons de cette journée un succès !",
      ];
      const randomMotivation = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];
      briefingBody += "\n\n" + randomMotivation;
    }

    // Send notification via OneSignal
    let notificationResult = null;
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      const notificationPayload = {
        app_id: ONESIGNAL_APP_ID,
        include_external_user_ids: [userId],
        headings: { en: briefingTitle, fr: briefingTitle },
        contents: { en: briefingBody, fr: briefingBody },
        data: {
          type: "daily_briefing",
          date: todayStr,
          rdv_count: rdvs?.length || 0,
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

      notificationResult = await response.json();
      console.log("OneSignal notification sent:", notificationResult);
    }

    // Also save to notifications table for in-app display
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "rappel",
      titre: briefingTitle,
      message: briefingBody,
      date_envoi: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        rdv_count: rdvs?.length || 0,
        notification: notificationResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Daily briefing user error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
