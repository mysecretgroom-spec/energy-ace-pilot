// =============================================================
// Cron : détection automatique des reçus / factures dans Gmail
// pour tous les utilisateurs ayant activé l'option.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getValidAccessToken } from "../_shared/google-auth.ts";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const unauthorized = requireCronAuth(req, { corsHeaders });
  if (unauthorized) return unauthorized;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();

    const { data: eligibleUsers, error: usersError } = await supabase
      .from("user_settings")
      .select("user_id, gmail_frais_sync_interval_minutes, gmail_frais_last_auto_sync")
      .eq("gmail_frais_sync_enabled", true);

    if (usersError) throw usersError;

    if (!eligibleUsers?.length) {
      return new Response(
        JSON.stringify({ message: "Aucun utilisateur à synchroniser", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<Record<string, unknown>> = [];

    for (const s of eligibleUsers) {
      const userId = s.user_id as string;
      const interval = (s.gmail_frais_sync_interval_minutes as number) || 60;

      if (s.gmail_frais_last_auto_sync) {
        const minutes = (now.getTime() - new Date(s.gmail_frais_last_auto_sync as string).getTime()) / 60000;
        if (minutes < interval) {
          results.push({ userId, status: "skipped" });
          continue;
        }
      }

      const accessToken = await getValidAccessToken(userId);
      if (!accessToken) {
        results.push({ userId, status: "skipped", reason: "no_google_token" });
        continue;
      }

      const { data: filtres } = await supabase
        .from("email_frais_filtres")
        .select("id")
        .eq("user_id", userId)
        .eq("actif", true)
        .limit(1);
      if (!filtres?.length) {
        results.push({ userId, status: "skipped", reason: "no_filters" });
        continue;
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-gmail-frais`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "x-user-id": userId,
          },
          body: JSON.stringify({}),
        });
        const result = await res.json();

        if (!res.ok) {
          results.push({ userId, status: "error", error: result?.error });
          continue;
        }

        await supabase
          .from("user_settings")
          .update({ gmail_frais_last_auto_sync: now.toISOString() })
          .eq("user_id", userId);

        const imported = result.imported || 0;
        if (imported > 0) {
          const message = imported === 1
            ? "1 justificatif a été importé depuis vos emails"
            : `${imported} justificatifs ont été importés depuis vos emails`;

          await supabase.from("notifications").insert({
            user_id: userId,
            type: "systeme",
            titre: "🧾 Import factures par email",
            message,
            lue: false,
            date_envoi: now.toISOString(),
          });

          try {
            await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                user_id: userId,
                title: "🧾 Import factures par email",
                message,
                url: "/finance",
                data: { type: "gmail_frais_import", count: imported },
              }),
            });
          } catch (pushError) {
            console.error("Push failed:", pushError);
          }
        }

        results.push({ userId, status: "synced", imported });
      } catch (error) {
        results.push({
          userId,
          status: "error",
          error: error instanceof Error ? error.message : "Erreur inconnue",
        });
      }
    }

    const synced = results.filter((r) => r.status === "synced").length;
    const totalImported = results.reduce((sum, r) => sum + ((r.imported as number) || 0), 0);

    return new Response(
      JSON.stringify({ message: "Scan terminé", synced, totalImported, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Scheduled frais sync error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur inconnue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
