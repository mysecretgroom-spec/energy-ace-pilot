// Reconciles installation RDVs:
// 1. Creates missing 'installation' RDVs for ventes with date_installation_prevue.
// 2. Promotes existing standard RDVs to type_rdv='installation' when they match an installation date.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const productToProject: Record<string, string> = {
  PV: "photovoltaique",
  PAC: "pompe_chaleur",
  ITE: "isolation",
  BTD: "ballon_thermo",
  CET: "ballon_thermo",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ventes with planned installation date for this user
    const { data: ventes, error: vErr } = await supabase
      .from("ventes")
      .select(
        "id, user_id, regie_id, client_id, date_installation_prevue, heure_installation_prevue, product_type",
      )
      .eq("user_id", userId)
      .not("date_installation_prevue", "is", null);

    if (vErr) throw vErr;

    let created = 0;
    let promoted = 0;

    for (const v of ventes ?? []) {
      const dateStr = v.date_installation_prevue as string;
      const heure = (v.heure_installation_prevue as string) || "08:00:00";

      // Check existing RDVs for this client on that date
      const dayStart = new Date(`${dateStr}T00:00:00`).toISOString();
      const dayEnd = new Date(`${dateStr}T23:59:59`).toISOString();

      const { data: existing } = await supabase
        .from("rdv")
        .select("id, type_rdv, status")
        .eq("user_id", userId)
        .eq("client_id", v.client_id)
        .gte("date_heure", dayStart)
        .lte("date_heure", dayEnd);

      const installRdv = existing?.find((r) => r.type_rdv === "installation");
      if (installRdv) continue;

      // Promote a non-cancelled standard RDV if present
      const promotable = existing?.find(
        (r) => r.type_rdv === "standard" && r.status !== "annule",
      );
      if (promotable) {
        const { error: upErr } = await supabase
          .from("rdv")
          .update({ type_rdv: "installation" })
          .eq("id", promotable.id);
        if (!upErr) promoted++;
        continue;
      }

      // Create the missing installation RDV
      const { data: client } = await supabase
        .from("clients")
        .select("adresse, latitude, longitude")
        .eq("id", v.client_id)
        .single();

      const dateHeureLocal = new Date(`${dateStr}T${heure}+02:00`).toISOString();
      const projectType = productToProject[v.product_type as string] || "autre";

      const { error: insErr } = await supabase.from("rdv").insert({
        user_id: v.user_id,
        client_id: v.client_id,
        regie_id: v.regie_id,
        date_heure: dateHeureLocal,
        duree_minutes: 60,
        adresse: client?.adresse || "",
        type_projet: projectType,
        status: "nouveau",
        type_rdv: "installation",
        source: "auto_reconciliation",
        latitude: client?.latitude,
        longitude: client?.longitude,
        commentaire: `Pose planifiée — réconciliation depuis vente ${v.id}`,
        metadata: { vente_id: v.id, auto_created: true },
      });
      if (!insErr) created++;
    }

    return new Response(
      JSON.stringify({ ok: true, created, promoted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
