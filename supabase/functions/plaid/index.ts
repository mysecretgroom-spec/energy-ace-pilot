import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PLAID_ENV = "sandbox"; // Change to "production" for live
const PLAID_BASE_URL = `https://${PLAID_ENV}.plaid.com`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;
    const { action, ...params } = await req.json();

    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");

    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      return new Response(JSON.stringify({ error: "Plaid credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const plaidHeaders = {
      "Content-Type": "application/json",
    };

    const plaidBody = (data: Record<string, unknown>) => JSON.stringify({
      client_id: PLAID_CLIENT_ID,
      secret: PLAID_SECRET,
      ...data,
    });

    switch (action) {
      case "create_link_token": {
        const response = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({
            user: { client_user_id: userId },
            client_name: "SolarFlow",
            products: ["transactions"],
            country_codes: ["FR"],
            language: "fr",
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Plaid create_link_token error:", data);
          return new Response(JSON.stringify({ error: data.error_message || "Failed to create link token" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ link_token: data.link_token }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "exchange_token": {
        const { public_token } = params;
        if (!public_token) {
          return new Response(JSON.stringify({ error: "public_token required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(`${PLAID_BASE_URL}/item/public_token/exchange`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({ public_token }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Plaid exchange_token error:", data);
          return new Response(JSON.stringify({ error: data.error_message || "Failed to exchange token" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Store the access token securely in the database
        const { error: insertError } = await supabase
          .from("plaid_items")
          .upsert({
            user_id: userId,
            access_token: data.access_token,
            item_id: data.item_id,
          });

        if (insertError) {
          console.error("Failed to store Plaid item:", insertError);
          return new Response(JSON.stringify({ error: "Failed to store bank connection" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ success: true, item_id: data.item_id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_transactions": {
        const { start_date, end_date } = params;

        // Get stored access token for user
        const { data: plaidItem, error: fetchError } = await supabase
          .from("plaid_items")
          .select("access_token")
          .eq("user_id", userId)
          .single();

        if (fetchError || !plaidItem) {
          return new Response(JSON.stringify({ error: "No bank account connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const response = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({
            access_token: plaidItem.access_token,
            start_date: start_date || thirtyDaysAgo.toISOString().split("T")[0],
            end_date: end_date || today.toISOString().split("T")[0],
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Plaid get_transactions error:", data);
          return new Response(JSON.stringify({ error: data.error_message || "Failed to fetch transactions" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Filter and categorize transactions for expense tracking
        const categorizedTransactions = data.transactions.map((tx: any) => ({
          id: tx.transaction_id,
          date: tx.date,
          description: tx.name,
          amount: Math.abs(tx.amount),
          category: mapPlaidCategory(tx.category),
          merchant: tx.merchant_name,
          pending: tx.pending,
        }));

        return new Response(JSON.stringify({ 
          transactions: categorizedTransactions,
          accounts: data.accounts,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const { data: plaidItem } = await supabase
          .from("plaid_items")
          .select("access_token")
          .eq("user_id", userId)
          .single();

        if (plaidItem?.access_token) {
          // Remove item from Plaid
          await fetch(`${PLAID_BASE_URL}/item/remove`, {
            method: "POST",
            headers: plaidHeaders,
            body: plaidBody({ access_token: plaidItem.access_token }),
          });
        }

        // Delete from database
        await supabase
          .from("plaid_items")
          .delete()
          .eq("user_id", userId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Plaid function error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function mapPlaidCategory(categories: string[] | null): string {
  if (!categories || categories.length === 0) return "autre";

  const categoryMap: Record<string, string> = {
    // Carburant
    "Gas Stations": "carburant",
    "Service Stations": "carburant",
    // Péage
    "Toll": "peage",
    "Tolls": "peage",
    // Repas
    "Restaurants": "repas",
    "Food and Drink": "repas",
    "Fast Food": "repas",
    "Coffee Shop": "repas",
    // Hôtel
    "Hotels": "hotel",
    "Lodging": "hotel",
    // Parking
    "Parking": "parking",
  };

  for (const cat of categories) {
    for (const [plaidCat, localCat] of Object.entries(categoryMap)) {
      if (cat.toLowerCase().includes(plaidCat.toLowerCase())) {
        return localCat;
      }
    }
  }

  return "autre";
}
