import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sandbox mode for development/testing
const PLAID_ENV = "sandbox";
const PLAID_BASE_URL = `https://${PLAID_ENV}.plaid.com`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

  try {
    const url = new URL(req.url);
    
    // Handle webhook from Plaid (no auth required)
    if (url.pathname.endsWith("/webhook")) {
      return await handleWebhook(req, plaidHeaders, plaidBody);
    }

    // All other actions require auth
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

    switch (action) {
      case "create_link_token": {
        const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/plaid/webhook`;
        
        const response = await fetch(`${PLAID_BASE_URL}/link/token/create`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({
            user: { client_user_id: userId },
            client_name: "SolarFlow",
            products: ["transactions"],
            country_codes: ["FR"],
            language: "fr",
            webhook: webhookUrl,
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
        const { public_token, institution_name } = params;
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

        // Store the access token (allow multiple accounts per user)
        const { error: insertError } = await supabase
          .from("plaid_items")
          .insert({
            user_id: userId,
            access_token: data.access_token,
            item_id: data.item_id,
            institution_name: institution_name || null,
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

      case "get_accounts": {
        // Get all connected accounts for user
        const { data: plaidItems, error: fetchError } = await supabase
          .from("plaid_items")
          .select("id, item_id, institution_name, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (fetchError) {
          return new Response(JSON.stringify({ error: "Failed to fetch accounts" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ accounts: plaidItems || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_transactions": {
        const { start_date, end_date, item_id } = params;

        // Get access tokens for user (one specific or all)
        let query = supabase
          .from("plaid_items")
          .select("id, access_token, item_id, institution_name")
          .eq("user_id", userId);

        if (item_id) {
          query = query.eq("item_id", item_id);
        }

        const { data: plaidItems, error: fetchError } = await query;

        if (fetchError || !plaidItems || plaidItems.length === 0) {
          return new Response(JSON.stringify({ error: "No bank account connected" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const allTransactions: any[] = [];
        const allAccounts: any[] = [];

        // Fetch transactions from all connected accounts
        for (const plaidItem of plaidItems) {
          try {
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
            if (response.ok) {
              // Add institution info to transactions
              const categorizedTransactions = data.transactions.map((tx: any) => ({
                id: tx.transaction_id,
                date: tx.date,
                description: tx.name,
                amount: Math.abs(tx.amount),
                category: mapPlaidCategory(tx.category),
                merchant: tx.merchant_name,
                pending: tx.pending,
                institution: plaidItem.institution_name,
                plaid_item_id: plaidItem.id,
              }));
              
              allTransactions.push(...categorizedTransactions);
              allAccounts.push(...data.accounts.map((acc: any) => ({
                ...acc,
                institution: plaidItem.institution_name,
              })));
            } else {
              console.error(`Error fetching from ${plaidItem.institution_name}:`, data);
            }
          } catch (error) {
            console.error(`Error fetching from ${plaidItem.institution_name}:`, error);
          }
        }

        // Sort by date descending
        allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return new Response(JSON.stringify({ 
          transactions: allTransactions,
          accounts: allAccounts,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "sync_item": {
        // Manual sync for a specific item
        const { item_id } = params;
        
        const { data: plaidItem, error: fetchError } = await supabase
          .from("plaid_items")
          .select("id, access_token, institution_name")
          .eq("user_id", userId)
          .eq("item_id", item_id)
          .single();

        if (fetchError || !plaidItem) {
          return new Response(JSON.stringify({ error: "Account not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Force a transactions refresh
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const response = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({
            access_token: plaidItem.access_token,
            start_date: thirtyDaysAgo.toISOString().split("T")[0],
            end_date: today.toISOString().split("T")[0],
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          return new Response(JSON.stringify({ error: data.error_message || "Sync failed" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const categorizedTransactions = data.transactions.map((tx: any) => ({
          id: tx.transaction_id,
          date: tx.date,
          description: tx.name,
          amount: Math.abs(tx.amount),
          category: mapPlaidCategory(tx.category),
          merchant: tx.merchant_name,
          pending: tx.pending,
          institution: plaidItem.institution_name,
        }));

        // Record the sync
        await supabase.from("plaid_syncs").insert({
          user_id: userId,
          plaid_item_id: plaidItem.id,
          transactions_count: categorizedTransactions.length,
        });

        return new Response(JSON.stringify({ 
          success: true,
          transactions: categorizedTransactions,
          count: categorizedTransactions.length,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "disconnect": {
        const { item_id } = params;

        let query = supabase
          .from("plaid_items")
          .select("id, access_token, item_id")
          .eq("user_id", userId);

        if (item_id) {
          query = query.eq("item_id", item_id);
        }

        const { data: plaidItems } = await query;

        if (plaidItems) {
          for (const plaidItem of plaidItems) {
            // Remove item from Plaid
            await fetch(`${PLAID_BASE_URL}/item/remove`, {
              method: "POST",
              headers: plaidHeaders,
              body: plaidBody({ access_token: plaidItem.access_token }),
            });

            // Delete from database
            await supabase
              .from("plaid_items")
              .delete()
              .eq("id", plaidItem.id);
          }
        }

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

// Handle Plaid webhooks for automatic updates
async function handleWebhook(
  req: Request,
  plaidHeaders: Record<string, string>,
  plaidBody: (data: Record<string, unknown>) => string
) {
  try {
    const body = await req.json();
    console.log("Plaid webhook received:", body.webhook_type, body.webhook_code);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { webhook_type, webhook_code, item_id } = body;

    // Find the plaid_item
    const { data: plaidItem } = await supabaseAdmin
      .from("plaid_items")
      .select("id, user_id, access_token, institution_name")
      .eq("item_id", item_id)
      .single();

    if (!plaidItem) {
      console.error("Plaid item not found for webhook:", item_id);
      return new Response(JSON.stringify({ received: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle different webhook types
    if (webhook_type === "TRANSACTIONS") {
      if (webhook_code === "SYNC_UPDATES_AVAILABLE" || 
          webhook_code === "DEFAULT_UPDATE" ||
          webhook_code === "HISTORICAL_UPDATE") {
        
        // Fetch new transactions
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const response = await fetch(`${PLAID_BASE_URL}/transactions/get`, {
          method: "POST",
          headers: plaidHeaders,
          body: plaidBody({
            access_token: plaidItem.access_token,
            start_date: thirtyDaysAgo.toISOString().split("T")[0],
            end_date: today.toISOString().split("T")[0],
          }),
        });

        const data = await response.json();
        if (response.ok) {
          let importedExpenses = 0;
          let matchedPayments = 0;

          for (const tx of data.transactions) {
            if (tx.pending) continue;

            // Handle EXPENSES (positive amounts = debits from bank perspective)
            if (tx.amount > 0) {
              // Check if transaction already exists
              const { data: existing } = await supabaseAdmin
                .from("frais")
                .select("id")
                .eq("user_id", plaidItem.user_id)
                .eq("description", `[Plaid] ${tx.transaction_id}`)
                .maybeSingle();

              if (!existing) {
                const { error } = await supabaseAdmin.from("frais").insert({
                  user_id: plaidItem.user_id,
                  montant: Math.abs(tx.amount),
                  date_frais: tx.date,
                  categorie: mapPlaidCategory(tx.category),
                  description: tx.name || tx.merchant_name || "Transaction bancaire",
                  ocr_data: {
                    plaid_transaction_id: tx.transaction_id,
                    merchant: tx.merchant_name,
                    institution: plaidItem.institution_name,
                  },
                });

                if (!error) importedExpenses++;
              }
            }

            // Handle INCOMING PAYMENTS (negative amounts = credits from bank perspective)
            if (tx.amount < 0) {
              const incomingAmount = Math.abs(tx.amount);
              const senderName = tx.name || tx.merchant_name || "";

              // Try to match with unpaid commissions (with 1€ tolerance for rounding)
              const { data: unpaidCommissions } = await supabaseAdmin
                .from("commissions")
                .select("id, montant_commission, vente_id")
                .eq("user_id", plaidItem.user_id)
                .eq("paye", false)
                .gte("montant_commission", incomingAmount - 1)
                .lte("montant_commission", incomingAmount + 1);

              if (unpaidCommissions && unpaidCommissions.length > 0) {
                // Find exact or closest match
                const matchedCommission = unpaidCommissions.find(
                  c => Math.abs(c.montant_commission - incomingAmount) < 1
                ) || unpaidCommissions[0];

                // Mark commission as paid
                await supabaseAdmin
                  .from("commissions")
                  .update({
                    paye: true,
                    date_paiement: tx.date,
                  })
                  .eq("id", matchedCommission.id);

                // Also update the vente status if it exists
                if (matchedCommission.vente_id) {
                  await supabaseAdmin
                    .from("ventes")
                    .update({
                      status: "paye",
                      date_paiement: tx.date,
                    })
                    .eq("id", matchedCommission.vente_id);
                }

                matchedPayments++;
                console.log(`Matched payment: ${incomingAmount}€ from "${senderName}" to commission ${matchedCommission.id}`);
              }

              // Also check for matching ventes by montant_ttc (for direct client payments)
              const { data: unpaidVentes } = await supabaseAdmin
                .from("ventes")
                .select("id, montant_ttc, client_id")
                .eq("user_id", plaidItem.user_id)
                .eq("status", "attente_paiement")
                .gte("montant_ttc", incomingAmount - 10)
                .lte("montant_ttc", incomingAmount + 10);

              if (unpaidVentes && unpaidVentes.length > 0) {
                const matchedVente = unpaidVentes.find(
                  v => Math.abs(v.montant_ttc - incomingAmount) < 10
                ) || unpaidVentes[0];

                await supabaseAdmin
                  .from("ventes")
                  .update({
                    status: "paye",
                    date_paiement: tx.date,
                  })
                  .eq("id", matchedVente.id);

                matchedPayments++;
                console.log(`Matched vente payment: ${incomingAmount}€ to vente ${matchedVente.id}`);
              }
            }
          }

          // Record the sync
          await supabaseAdmin.from("plaid_syncs").insert({
            user_id: plaidItem.user_id,
            plaid_item_id: plaidItem.id,
            transactions_count: importedExpenses + matchedPayments,
            sync_type: "webhook",
          });

          console.log(`Webhook sync: ${importedExpenses} expenses imported, ${matchedPayments} payments matched for user ${plaidItem.user_id}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

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
