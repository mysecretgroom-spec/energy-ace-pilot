import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all user settings with their transition delay
    const { data: userSettings, error: settingsError } = await supabase
      .from("user_settings")
      .select("user_id, vente_auto_transition_weeks");

    if (settingsError) {
      console.error("Error fetching user settings:", settingsError);
      throw settingsError;
    }

    let totalUpdated = 0;

    for (const setting of userSettings || []) {
      const delayWeeks = setting.vente_auto_transition_weeks || 2;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - (delayWeeks * 7));

      // Find ventes with status 'installe' and date_installation_reelle older than the delay
      const { data: ventesToUpdate, error: ventesError } = await supabase
        .from("ventes")
        .select("id, date_installation_reelle")
        .eq("user_id", setting.user_id)
        .eq("status", "installe")
        .not("date_installation_reelle", "is", null)
        .lte("date_installation_reelle", cutoffDate.toISOString().split("T")[0]);

      if (ventesError) {
        console.error(`Error fetching ventes for user ${setting.user_id}:`, ventesError);
        continue;
      }

      if (ventesToUpdate && ventesToUpdate.length > 0) {
        const venteIds = ventesToUpdate.map((v) => v.id);
        
        const { error: updateError } = await supabase
          .from("ventes")
          .update({ status: "attente_paiement" })
          .in("id", venteIds);

        if (updateError) {
          console.error(`Error updating ventes for user ${setting.user_id}:`, updateError);
        } else {
          totalUpdated += ventesToUpdate.length;
          console.log(`Updated ${ventesToUpdate.length} ventes to 'attente_paiement' for user ${setting.user_id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Transition automatique: ${totalUpdated} vente(s) mise(s) à jour` 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in auto-transition-ventes:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});
