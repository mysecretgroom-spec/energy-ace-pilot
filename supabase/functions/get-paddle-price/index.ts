import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resolvePaddlePrice, type PaddleEnv } from '../_shared/paddle.ts';
import { PLAN_PRICES, TOPUP_PRICES } from '../_shared/plans.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  try {
    const { priceId, environment } = await req.json();
    const allowed = [...PLAN_PRICES, ...Object.keys(TOPUP_PRICES)] as string[];
    if (!allowed.includes(priceId) || !['sandbox', 'live'].includes(environment)) return json({ error: 'invalid' }, 400);
    return json({ paddleId: await resolvePaddlePrice(environment as PaddleEnv, priceId) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
