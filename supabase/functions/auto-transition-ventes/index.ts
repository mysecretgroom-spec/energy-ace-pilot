import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Demo account to exclude from auto-transition
const DEMO_USER_ID = "bff6214e-cd82-4be8-86a7-59aef5d08714";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Default: 2 weeks (overridable per user via user_settings)
    const DEFAULT_DELAY_WEEKS = 2;

    // Fetch all user settings (vente_auto_transition_weeks)
    // Exclude demo accounts
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, vente_auto_transition_weeks")
      .neq("user_id", DEMO_USER_ID);

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError);
      throw settingsError;
    }

    // Fetch all invoiced vente IDs in one shot (status emise/paid → has date_emission)
    // We exclude any vente referenced in a facture that already has date_emission set.
    const { data: invoicedFactures, error: facturesError } = await supabase
      .from("factures")
      .select("vente_ids")
      .not("date_emission", "is", null);

    if (facturesError) {
      console.error("Error fetching factures:", facturesError);
      throw facturesError;
    }

    const invoicedVenteIds = new Set<string>();
    for (const f of invoicedFactures || []) {
      const ids = (f.vente_ids as string[] | null) || [];
      ids.forEach((id) => invoicedVenteIds.add(id));
    }
    console.log(`Found ${invoicedVenteIds.size} ventes already invoiced (excluded).`);

    let totalUpdated = 0;
    let skippedExternal = 0;
    let skippedInvoiced = 0;
    let skippedTooEarly = 0;

    for (const setting of userSettings || []) {
      const delayWeeks = setting.vente_auto_transition_weeks || DEFAULT_DELAY_WEEKS;
      const delayMs = delayWeeks * 7 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      const cutoffTimestamp = now - delayMs;

      // Fetch all 'installe' ventes for this user (excluding external installations)
      const { data: ventes, error: ventesError } = await supabase
        .from("ventes")
        .select("id, date_installation_reelle, type_vente, updated_at")
        .eq("user_id", setting.user_id)
        .eq("status", "installe")
        .neq("type_vente", "external_installation");

      if (ventesError) {
        console.error(`Error fetching ventes for user ${setting.user_id}:`, ventesError);
        continue;
      }

      if (!ventes || ventes.length === 0) continue;

      const venteIds = ventes.map((v) => v.id);

      // Fetch the most recent transition into 'installe' for each vente (fallback)
      const { data: history, error: historyError } = await supabase
        .from("vente_status_history")
        .select("vente_id, changed_at, new_status")
        .in("vente_id", venteIds)
        .eq("new_status", "installe")
        .order("changed_at", { ascending: false });

      if (historyError) {
        console.error(`Error fetching history for user ${setting.user_id}:`, historyError);
      }

      const installedAtByVente = new Map<string, string>();
      for (const h of history || []) {
        if (!installedAtByVente.has(h.vente_id)) {
          installedAtByVente.set(h.vente_id, h.changed_at);
        }
      }

      const eligibleVenteIds: string[] = [];

      for (const v of ventes) {
        // Skip if this vente has an emitted invoice
        if (invoicedVenteIds.has(v.id)) {
          skippedInvoiced++;
          continue;
        }

        // Reference date priority:
        // 1) date_installation_reelle (date)
        // 2) last status change to 'installe'
        // 3) updated_at (last resort)
        let refTimestamp: number | null = null;

        if (v.date_installation_reelle) {
          refTimestamp = new Date(v.date_installation_reelle as string).getTime();
        } else {
          const histDate = installedAtByVente.get(v.id);
          if (histDate) {
            refTimestamp = new Date(histDate).getTime();
          } else if (v.updated_at) {
            refTimestamp = new Date(v.updated_at as string).getTime();
          }
        }

        if (refTimestamp === null) continue;

        if (refTimestamp <= cutoffTimestamp) {
          eligibleVenteIds.push(v.id);
        } else {
          skippedTooEarly++;
        }
      }

      // Count external installations skipped (informational)
      const { count: externalCount } = await supabase
        .from("ventes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", setting.user_id)
        .eq("status", "installe")
        .eq("type_vente", "external_installation")
        .not("date_installation_reelle", "is", null)
        .lte(
          "date_installation_reelle",
          new Date(cutoffTimestamp).toISOString().split("T")[0],
        );

      if (externalCount) skippedExternal += externalCount;

      if (eligibleVenteIds.length > 0) {
        const { error: updateError } = await supabase
          .from("ventes")
          .update({ status: "attente_paiement" })
          .in("id", eligibleVenteIds);

        if (updateError) {
          console.error(`Error updating ventes for user ${setting.user_id}:`, updateError);
        } else {
          totalUpdated += eligibleVenteIds.length;
          console.log(
            `User ${setting.user_id}: ${eligibleVenteIds.length} ventes → attente_paiement (delay=${delayWeeks}w)`,
          );
        }
      }
    }

    console.log(
      `Auto-transition done: updated=${totalUpdated}, skipped_external=${skippedExternal}, skipped_invoiced=${skippedInvoiced}, skipped_too_early=${skippedTooEarly}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `Transition automatique: ${totalUpdated} vente(s) mise(s) à jour`,
        updated: totalUpdated,
        skipped_external: skippedExternal,
        skipped_invoiced: skippedInvoiced,
        skipped_too_early: skippedTooEarly,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-transition-ventes:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
