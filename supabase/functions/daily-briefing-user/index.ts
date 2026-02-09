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

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Fetch everything in parallel
    const [profileRes, rdvsRes, ventesWeekRes, ventesMonthRes, rdvsWeekRes] = await Promise.all([
      // User profile
      supabase.from("profiles").select("first_name").eq("user_id", userId).single(),
      // Today's RDVs (exclude annulé & reporté)
      supabase
        .from("rdv")
        .select(`*, clients (nom, prenom, adresse, ville, code_postal, telephone)`)
        .eq("user_id", userId)
        .gte("date_heure", todayStr)
        .lt("date_heure", tomorrowStr)
        .not("status", "in", '("annule","reporte")')
        .order("date_heure", { ascending: true }),
      // Ventes this week (for CA tracking)
      supabase
        .from("ventes")
        .select("montant_ttc, puissance_kwc, product_type, status, created_at")
        .eq("user_id", userId)
        .gte("created_at", getMonday(today))
        .not("status", "eq", "annule"),
      // Ventes this month
      supabase
        .from("ventes")
        .select("montant_ttc, puissance_kwc, status")
        .eq("user_id", userId)
        .gte("created_at", `${todayStr.slice(0, 7)}-01`)
        .not("status", "eq", "annule"),
      // RDVs this week (for conversion rate)
      supabase
        .from("rdv")
        .select("status")
        .eq("user_id", userId)
        .gte("date_heure", getMonday(today))
        .lt("date_heure", tomorrowStr)
        .not("status", "in", '("annule","reporte")'),
    ]);

    const profile = profileRes.data;
    const rdvs = rdvsRes.data || [];
    const ventesWeek = ventesWeekRes.data || [];
    const ventesMonth = ventesMonthRes.data || [];
    const rdvsWeek = rdvsWeekRes.data || [];

    // --- Analytics ---
    const weekCA = ventesWeek.reduce((s, v) => s + (v.montant_ttc || 0), 0);
    const weekKwc = ventesWeek.reduce((s, v) => s + (v.puissance_kwc || 0), 0);
    const monthCA = ventesMonth.reduce((s, v) => s + (v.montant_ttc || 0), 0);
    const weekSigned = ventesWeek.filter(v => v.status === "en_installation" || v.status === "installe" || v.status === "paye" || v.status === "attente_paiement").length;

    const weekRdvsDone = rdvsWeek.filter(r => ["signe", "negatif", "r2", "r2_prestudy"].includes(r.status)).length;
    const weekConversion = weekRdvsDone > 0 ? Math.round((weekSigned / weekRdvsDone) * 100) : null;

    const pendingPayment = ventesMonth.filter(v => v.status === "attente_paiement").length;

    // --- Build briefing ---
    const firstName = profile?.first_name || "Commercial";
    const dayName = today.toLocaleDateString("fr-FR", { weekday: "long" });
    const dateFormatted = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

    let briefingTitle = `☀️ Bonjour ${firstName} !`;
    let briefingBody = `📅 ${capitalize(dayName)} ${dateFormatted}\n`;

    // Weekly performance snapshot
    briefingBody += "\n📊 *Semaine en cours*\n";
    if (weekCA > 0) {
      briefingBody += `💰 CA : ${formatEuro(weekCA)}`;
      if (weekKwc > 0) briefingBody += ` • ${weekKwc.toFixed(1)} kWc`;
      briefingBody += "\n";
    }
    if (weekSigned > 0) {
      briefingBody += `✍️ ${weekSigned} vente${weekSigned > 1 ? "s" : ""} signée${weekSigned > 1 ? "s" : ""}`;
      if (weekConversion !== null) briefingBody += ` (${weekConversion}% transformation)`;
      briefingBody += "\n";
    }
    if (weekCA === 0 && weekSigned === 0) {
      briefingBody += "Pas encore de signature cette semaine — c'est le moment ! 💪\n";
    }

    // Monthly CA progress
    if (monthCA > 0) {
      briefingBody += `\n📈 *CA mois* : ${formatEuro(monthCA)}\n`;
    }

    // Pending payments alert
    if (pendingPayment > 0) {
      briefingBody += `⏳ ${pendingPayment} vente${pendingPayment > 1 ? "s" : ""} en attente de paiement\n`;
    }

    // Today's RDVs
    briefingBody += "\n";
    if (rdvs.length === 0) {
      briefingBody += "🎉 Aucun RDV actif aujourd'hui.\nIdéal pour prospecter ou relancer des dossiers en cours !\n";
    } else {
      const totalDistance = rdvs.reduce((sum, r) => sum + (r.distance_km || 0), 0);
      const totalTravelTime = rdvs.reduce((sum, r) => sum + (r.travel_time_minutes || 0), 0);

      briefingBody += `📍 *${rdvs.length} RDV aujourd'hui*`;
      if (totalDistance > 0) briefingBody += ` • ${Math.round(totalDistance)} km`;
      if (totalTravelTime > 0) briefingBody += ` • ~${Math.round(totalTravelTime)} min route`;
      briefingBody += "\n\n";

      // Alerts
      const alerts: string[] = [];
      const pendingRdvs = rdvs.filter(r => r.status === "a_confirmer" || r.status === "nouveau");
      if (pendingRdvs.length > 0) alerts.push(`⚠️ ${pendingRdvs.length} RDV à confirmer`);
      const noAddressRdvs = rdvs.filter(r => !r.adresse && !r.clients?.adresse);
      if (noAddressRdvs.length > 0) alerts.push(`📍 ${noAddressRdvs.length} RDV sans adresse`);
      if (alerts.length > 0) briefingBody += alerts.join("\n") + "\n\n";

      // RDV list
      for (const rdv of rdvs) {
        const time = new Date(rdv.date_heure).toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
        });
        const clientName = rdv.clients
          ? `${rdv.clients.prenom || ""} ${rdv.clients.nom}`.trim()
          : "Client";
        const city = rdv.clients?.ville || "";

        let rdvLine = `⏰ ${time} - ${clientName}`;
        if (city) rdvLine += ` (${city})`;

        // Status icon
        const statusIcon = rdv.status === "a_confirmer" || rdv.status === "nouveau" ? "⚠️ " :
          rdv.status === "confirme" ? "✅ " : "";
        briefingBody += statusIcon + rdvLine + "\n";
      }
    }

    // Motivational closer
    const motivational = [
      "🚀 Bonne journée et bonnes signatures !",
      "💪 C'est parti, chaque RDV compte !",
      "🔥 Aujourd'hui est une opportunité !",
      "✨ Transforme cette journée en succès !",
    ];
    briefingBody += "\n" + motivational[Math.floor(Math.random() * motivational.length)];

    // Send OneSignal notification
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

      notificationResult = await response.json();
      console.log("OneSignal notification sent:", notificationResult);
    }

    // Save in-app notification
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
        rdv_count: rdvs.length,
        notification: notificationResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Daily briefing user error:", error);
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
