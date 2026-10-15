// Authenticated subscription management: plan change (upgrade/downgrade) and billing portal.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod@3';
import { getPaddleClient, resolvePaddlePrice, type PaddleEnv } from '../_shared/paddle.ts';
import { PLAN_PRICES, tierOf } from '../_shared/plans.ts';

const Body = z.object({
  action: z.enum(['change_plan', 'portal']),
  environment: z.enum(['sandbox', 'live']),
  priceId: z.enum(PLAN_PRICES).optional(),
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: auth } = await sb.auth.getUser(token ?? '');
    if (!auth?.user) return json({ error: 'unauthorized' }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const { action, environment, priceId } = parsed.data;
    const env = environment as PaddleEnv;

    const { data: sub } = await sb.from('subscriptions').select('*')
      .eq('user_id', auth.user.id).eq('environment', env)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!sub) return json({ error: 'no_subscription' }, 404);
    const paddle = getPaddleClient(env);

    if (action === 'portal') {
      const s = await paddle.customerPortalSessions.create(sub.paddle_customer_id, [sub.paddle_subscription_id]);
      return json({ url: s.urls.general.overview });
    }

    if (!priceId || priceId === sub.price_id) return json({ error: 'same_plan' }, 400);
    const newPaddlePrice = await resolvePaddlePrice(env, priceId);
    const isUpgrade = tierOf(priceId) > tierOf(sub.price_id) ||
      (tierOf(priceId) === tierOf(sub.price_id) && priceId.endsWith('yearly'));

    if (isUpgrade) {
      // Immediate, prorated charge
      await paddle.subscriptions.update(sub.paddle_subscription_id, {
        items: [{ priceId: newPaddlePrice, quantity: 1 }],
        prorationBillingMode: 'prorated_immediately',
      });
      await sb.from('subscriptions').update({ scheduled_price_id: null, premium_until: null }).eq('id', sub.id);
      return json({ ok: true, mode: 'immediate' });
    }
    // Downgrade: new price billed from next period; keep Premium access until period end
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: newPaddlePrice, quantity: 1 }],
      prorationBillingMode: 'full_next_billing_period',
    });
    await sb.from('subscriptions').update({
      scheduled_price_id: priceId,
      premium_until: sub.product_id === 'premium_plan' ? sub.current_period_end : sub.premium_until,
    }).eq('id', sub.id);
    return json({ ok: true, mode: 'end_of_period', effective_at: sub.current_period_end });
  } catch (e) {
    console.error('paddle-manage error', e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
