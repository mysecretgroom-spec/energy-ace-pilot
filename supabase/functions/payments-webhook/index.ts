import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWebhook, EventName, type PaddleEnv } from '../_shared/paddle.ts';
import { TOPUP_PRICES } from '../_shared/plans.ts';

let _sb: any = null;
const sb = () => (_sb ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!));

async function setAccess(userId: string, access: 'active' | 'paywall') {
  const { error } = await sb().rpc('update_saas_access_state', { p_user_id: userId, p_app_access: access });
  if (error) console.error('access update failed', error);
}

async function upsertSubscription(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn('Skipping subscription: missing importMeta.externalId', item?.price?.id);
    return;
  }
  const row: Record<string, unknown> = {
    paddle_subscription_id: data.id,
    paddle_customer_id: data.customerId,
    product_id: productId,
    price_id: priceId,
    status: data.status,
    current_period_start: data.currentBillingPeriod?.startsAt,
    current_period_end: data.currentBillingPeriod?.endsAt,
    cancel_at_period_end: data.scheduledChange?.action === 'cancel',
    environment: env,
    updated_at: new Date().toISOString(),
  };
  // Clear a pending downgrade once the new price is in effect
  const { data: existing } = await sb().from('subscriptions').select('user_id, scheduled_price_id, premium_until').eq('paddle_subscription_id', data.id).maybeSingle();
  const uid = userId || existing?.user_id;
  if (!uid) { console.error('No userId for subscription', data.id); return; }
  row.user_id = uid;
  if (existing?.scheduled_price_id && existing.scheduled_price_id === priceId &&
      existing.premium_until && new Date(existing.premium_until) <= new Date()) {
    row.scheduled_price_id = null;
  }
  await sb().from('subscriptions').upsert(row, { onConflict: 'paddle_subscription_id' });

  const live = ['active', 'trialing', 'past_due'].includes(data.status);
  await setAccess(uid, live ? 'active' : 'paywall');
}

async function handleCanceled(data: any, env: PaddleEnv) {
  const { data: row } = await sb().from('subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('paddle_subscription_id', data.id).eq('environment', env).select('user_id').maybeSingle();
  if (!row?.user_id) return;
  // Other still-running subscription?
  const { data: other } = await sb().from('subscriptions').select('id')
    .eq('user_id', row.user_id).in('status', ['active', 'trialing', 'past_due']).limit(1);
  if (!other?.length) await setAccess(row.user_id, 'paywall');
}

async function handleTransaction(data: any, env: PaddleEnv) {
  const userId = data.customData?.userId;
  const priceId = data.items?.[0]?.price?.importMeta?.externalId;
  const amount = priceId ? TOPUP_PRICES[priceId] : undefined;
  if (!userId || !amount) return; // not a top-up (subscription renewals handled by subscription events)
  const { error } = await sb().from('ai_credit_topups').insert({
    user_id: userId,
    amount_eur: amount,
    amount_remaining_eur: amount,
    status: 'paid',
    paid_at: new Date().toISOString(),
    paddle_transaction_id: data.id,
    environment: env,
  });
  if (error && !String(error.message).includes('duplicate')) console.error('topup insert failed', error);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const env = (new URL(req.url).searchParams.get('env') || 'sandbox') as PaddleEnv;
  try {
    const event = await verifyWebhook(req, env);
    switch (event.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionUpdated:
        await upsertSubscription(event.data, env); break;
      case EventName.SubscriptionCanceled:
        await handleCanceled(event.data, env); break;
      case EventName.TransactionCompleted:
        await handleTransaction(event.data, env); break;
      default:
        console.log('Unhandled event:', event.eventType);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Webhook error:', e);
    return new Response('Webhook error', { status: 400 });
  }
});
