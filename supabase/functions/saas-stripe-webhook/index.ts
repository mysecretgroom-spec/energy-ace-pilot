import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cryptoKey = async (secret: string) => {
  const encoder = new TextEncoder();
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
};

const verifyStripeSignature = async (
  payload: string,
  header: string,
  secret: string
): Promise<boolean> => {
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const signature = parts.find((p) => p.startsWith("v1="))?.split("=")[1];

  if (!timestamp || !signature) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await cryptoKey(secret);
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const expectedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const isValid = await verifyStripeSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid Stripe signature");
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(body);
    console.log(`Stripe event: ${event.type}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error("No client_reference_id in checkout session");
          break;
        }

        console.log(`Checkout completed for user ${userId}, customer ${customerId}, subscription ${subscriptionId}`);

        // Upsert subscription
        const { error: subError } = await supabase
          .from("saas_subscriptions_bridge" as any)
          .upsert({} as any); // We use RPC instead

        // Use direct SQL via RPC for saas schema
        await supabase.rpc("upsert_saas_subscription" as any, {
          p_user_id: userId,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscriptionId,
          p_status: "active",
        });

        // Update access state to active
        await supabase.rpc("update_saas_access_state" as any, {
          p_user_id: userId,
          p_app_access: "active",
        });

        console.log(`User ${userId} activated`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const periodEnd = invoice.lines?.data?.[0]?.period?.end;

        if (!subscriptionId) break;

        // Find user by stripe_customer_id
        const { data: sub } = await supabase.rpc("find_user_by_stripe_customer" as any, {
          p_stripe_customer_id: customerId,
        });

        const userId = sub?.[0]?.user_id;
        if (!userId) {
          console.log(`No user found for customer ${customerId}`);
          break;
        }

        // Update subscription period end and status
        await supabase.rpc("upsert_saas_subscription" as any, {
          p_user_id: userId,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscriptionId,
          p_status: "active",
          p_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        });

        // Ensure access is active
        await supabase.rpc("update_saas_access_state" as any, {
          p_user_id: userId,
          p_app_access: "active",
        });

        console.log(`Invoice paid for user ${userId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: sub } = await supabase.rpc("find_user_by_stripe_customer" as any, {
          p_stripe_customer_id: customerId,
        });

        const userId = sub?.[0]?.user_id;
        if (!userId) break;

        await supabase.rpc("upsert_saas_subscription" as any, {
          p_user_id: userId,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: invoice.subscription,
          p_status: "past_due",
        });

        console.log(`Payment failed for user ${userId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: sub } = await supabase.rpc("find_user_by_stripe_customer" as any, {
          p_stripe_customer_id: customerId,
        });

        const userId = sub?.[0]?.user_id;
        if (!userId) break;

        await supabase.rpc("upsert_saas_subscription" as any, {
          p_user_id: userId,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscription.id,
          p_status: "canceled",
        });

        await supabase.rpc("update_saas_access_state" as any, {
          p_user_id: userId,
          p_app_access: "paywall",
        });

        console.log(`Subscription canceled for user ${userId}`);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status; // active, past_due, canceled, etc.

        const { data: sub } = await supabase.rpc("find_user_by_stripe_customer" as any, {
          p_stripe_customer_id: customerId,
        });

        const userId = sub?.[0]?.user_id;
        if (!userId) break;

        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await supabase.rpc("upsert_saas_subscription" as any, {
          p_user_id: userId,
          p_stripe_customer_id: customerId,
          p_stripe_subscription_id: subscription.id,
          p_status: status,
          p_current_period_end: periodEnd,
        });

        // Update access based on subscription status
        if (status === "active") {
          await supabase.rpc("update_saas_access_state" as any, {
            p_user_id: userId,
            p_app_access: "active",
          });
        } else if (status === "canceled" || status === "unpaid") {
          await supabase.rpc("update_saas_access_state" as any, {
            p_user_id: userId,
            p_app_access: "paywall",
          });
        }

        console.log(`Subscription updated for user ${userId}: ${status}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
