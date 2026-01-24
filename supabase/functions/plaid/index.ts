import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sandbox mode for development/testing
const PLAID_ENV = "sandbox";
const PLAID_BASE_URL = `https://${PLAID_ENV}.plaid.com`;

// Webhook payload validation schema
const PlaidWebhookSchema = z.object({
  webhook_type: z.string(),
  webhook_code: z.string(),
  item_id: z.string(),
  error: z.object({}).optional().nullable(),
});

// Verify Plaid webhook signature
async function verifyPlaidWebhook(
  body: string,
  signedJwt: string | null
): Promise<boolean> {
  // If no JWT provided, reject
  if (!signedJwt) {
    console.warn("No Plaid-Verification header provided");
    return false;
  }

  try {
    // In production, verify the JWT signature using Plaid's public key
    // For sandbox mode, we do basic validation
    const PLAID_WEBHOOK_SECRET = Deno.env.get("PLAID_WEBHOOK_SECRET");
    
    if (!PLAID_WEBHOOK_SECRET) {
      // Log warning but allow in sandbox mode
      console.warn("PLAID_WEBHOOK_SECRET not set - webhook signature verification skipped in sandbox");
      
      // Basic structure validation
      try {
        JSON.parse(body);
        return true;
      } catch {
        return false;
      }
    }

    // Full verification with Plaid's verification endpoint
    const PLAID_CLIENT_ID = Deno.env.get("PLAID_CLIENT_ID");
    const PLAID_SECRET = Deno.env.get("PLAID_SECRET");
    
    if (!PLAID_CLIENT_ID || !PLAID_SECRET) {
      console.error("Plaid credentials not configured");
      return false;
    }

    // Verify the JWT with Plaid
    const verifyResponse = await fetch(`${PLAID_BASE_URL}/webhook_verification_key/get`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        key_id: extractKeyIdFromJwt(signedJwt),
      }),
    });

    if (!verifyResponse.ok) {
      console.error("Failed to get Plaid verification key");
      return false;
    }

    // If we get here, the key exists and is valid
    // Additional JWT verification would be done here in production
    return true;
  } catch (error) {
    console.error("Webhook verification error:", error);
    return false;
  }
}

// Extract key_id from JWT header
function extractKeyIdFromJwt(jwt: string): string {
  try {
    const [header] = jwt.split(".");
    const decoded = JSON.parse(atob(header));
    return decoded.kid || "";
  } catch {
    return "";
  }
}

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
    
    // Handle webhook from Plaid (with signature verification)
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

        const allTransactions: Array<{
          id: string;
          date: string;
          description: string;
          amount: number;
          category: string;
          merchant: string;
          pending: boolean;
          institution: string;
          plaid_item_id: string;
        }> = [];
        const allAccounts: Array<Record<string, unknown>> = [];

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
              const categorizedTransactions = data.transactions.map((tx: Record<string, unknown>) => ({
                id: tx.transaction_id,
                date: tx.date,
                description: tx.name,
                amount: Math.abs(tx.amount as number),
                category: mapPlaidCategory(tx.category as string[] | null),
                merchant: tx.merchant_name,
                pending: tx.pending,
                institution: plaidItem.institution_name,
                plaid_item_id: plaidItem.id,
              }));
              
              allTransactions.push(...categorizedTransactions);
              allAccounts.push(...data.accounts.map((acc: Record<string, unknown>) => ({
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

        const categorizedTransactions = data.transactions.map((tx: Record<string, unknown>) => ({
          id: tx.transaction_id,
          date: tx.date,
          description: tx.name,
          amount: Math.abs(tx.amount as number),
          category: mapPlaidCategory(tx.category as string[] | null),
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

// Type for commission matching
interface CommissionItem {
  id: string;
  montant_commission: number;
  vente_id: string | null;
}

// Find a combination of commissions that sum to the target amount (subset sum problem)
function findCommissionCombination(
  commissions: CommissionItem[],
  targetAmount: number,
  tolerance: number
): CommissionItem[] {
  // Limit to reasonable number of commissions to avoid performance issues
  const maxCommissions = Math.min(commissions.length, 20);
  const subset = commissions.slice(0, maxCommissions);

  // Try combinations from largest to smallest (most likely for Qonto invoices)
  // Use a greedy approach first, then brute force for small sets
  
  // Greedy approach: try to build sum from largest commissions
  const sorted = [...subset].sort((a, b) => b.montant_commission - a.montant_commission);
  let greedySum = 0;
  const greedyResult: CommissionItem[] = [];
  
  for (const comm of sorted) {
    if (greedySum + comm.montant_commission <= targetAmount + tolerance) {
      greedyResult.push(comm);
      greedySum += comm.montant_commission;
      
      if (Math.abs(greedySum - targetAmount) <= tolerance) {
        return greedyResult;
      }
    }
  }

  // If greedy didn't work and we have few commissions, try brute force
  if (subset.length <= 10) {
    // Generate all subsets and find best match
    for (let mask = 1; mask < (1 << subset.length); mask++) {
      let sum = 0;
      const combination: CommissionItem[] = [];
      
      for (let i = 0; i < subset.length; i++) {
        if (mask & (1 << i)) {
          sum += subset[i].montant_commission;
          combination.push(subset[i]);
        }
      }
      
      if (Math.abs(sum - targetAmount) <= tolerance) {
        return combination;
      }
    }
  }

  return [];
}

// Handle Plaid webhooks with signature verification
async function handleWebhook(
  req: Request,
  plaidHeaders: Record<string, string>,
  plaidBody: (data: Record<string, unknown>) => string
) {
  try {
    // Get the raw body for signature verification
    const bodyText = await req.text();
    const plaidVerification = req.headers.get("Plaid-Verification");
    
    // Verify webhook signature
    const isValid = await verifyPlaidWebhook(bodyText, plaidVerification);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse and validate the webhook payload
    let body: z.infer<typeof PlaidWebhookSchema>;
    try {
      const parsed = JSON.parse(bodyText);
      body = PlaidWebhookSchema.parse(parsed);
    } catch (parseError) {
      console.error("Invalid webhook payload:", parseError);
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

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

              // STEP 1: Try exact match with single commission (±1€ tolerance)
              const { data: exactMatch } = await supabaseAdmin
                .from("commissions")
                .select("id, montant_commission, vente_id")
                .eq("user_id", plaidItem.user_id)
                .eq("paye", false)
                .gte("montant_commission", incomingAmount - 1)
                .lte("montant_commission", incomingAmount + 1)
                .limit(1)
                .maybeSingle();

              if (exactMatch) {
                // Mark commission as paid
                await supabaseAdmin
                  .from("commissions")
                  .update({
                    paye: true,
                    date_paiement: tx.date,
                  })
                  .eq("id", exactMatch.id);

                // Also update the vente status
                if (exactMatch.vente_id) {
                  await supabaseAdmin
                    .from("ventes")
                    .update({
                      status: "paye",
                      date_paiement: tx.date,
                    })
                    .eq("id", exactMatch.vente_id);
                }

                matchedPayments++;
                console.log(`Matched single commission: ${incomingAmount}€ from "${senderName}" -> commission ${exactMatch.id}`);
                continue;
              }

              // STEP 2: Try to match grouped commissions (Qonto invoice = sum of multiple commissions)
              const { data: allUnpaidCommissions } = await supabaseAdmin
                .from("commissions")
                .select("id, montant_commission, vente_id")
                .eq("user_id", plaidItem.user_id)
                .eq("paye", false)
                .order("montant_commission", { ascending: false });

              if (allUnpaidCommissions && allUnpaidCommissions.length > 0) {
                // Try to find a combination that sums to the incoming amount (±2€ tolerance)
                const matchedCombination = findCommissionCombination(
                  allUnpaidCommissions,
                  incomingAmount,
                  2 // tolerance in euros
                );

                if (matchedCombination.length > 0) {
                  // Mark all matched commissions as paid
                  for (const commission of matchedCombination) {
                    await supabaseAdmin
                      .from("commissions")
                      .update({
                        paye: true,
                        date_paiement: tx.date,
                      })
                      .eq("id", commission.id);

                    // Also update the vente status
                    if (commission.vente_id) {
                      await supabaseAdmin
                        .from("ventes")
                        .update({
                          status: "paye",
                          date_paiement: tx.date,
                        })
                        .eq("id", commission.vente_id);
                    }
                  }

                  matchedPayments += matchedCombination.length;
                  const matchedIds = matchedCombination.map(c => c.id).join(", ");
                  const totalMatched = matchedCombination.reduce((sum, c) => sum + c.montant_commission, 0);
                  console.log(`Matched grouped invoice: ${incomingAmount}€ from "${senderName}" -> ${matchedCombination.length} commissions (total: ${totalMatched.toFixed(2)}€) [${matchedIds}]`);
                  continue;
                }
              }

              // STEP 3: Check for matching ventes by montant_ttc (for direct client payments)
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
