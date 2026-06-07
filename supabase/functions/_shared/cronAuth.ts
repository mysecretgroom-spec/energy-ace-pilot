// =============================================================
// Shared cron/scheduled-function authorization.
//
// Cron-triggered edge functions (weekly-recap, rdv-preparation,
// pipeline-tracker, check-relance-paiement, scheduled-gmail-sync)
// should NOT be reachable anonymously from the public internet —
// otherwise any attacker can:
//   - trigger expensive DB scans + outbound WhatsApp/Twilio fan-out (DoS + $$$)
//   - flood users with duplicate notifications
//
// Gate them behind:
//   1. SUPABASE_SERVICE_ROLE_KEY (used by pg_cron / supabase internal)
//   2. CRON_SECRET (custom shared secret — preferred for external schedulers)
//
// Comparison is timing-safe. Returns a 401 Response when unauthorized.
// =============================================================

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export interface CronAuthOptions {
  /** Allow OPTIONS preflight through without auth. Default true. */
  allowOptions?: boolean;
  /** CORS headers attached to the 401 response. */
  corsHeaders?: Record<string, string>;
}

/**
 * Check that the incoming request carries a valid cron credential.
 * Returns `null` when authorized — otherwise returns a 401 Response
 * the caller should immediately return.
 *
 * Accepted credentials (any one):
 *   - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *   - x-cron-secret: <CRON_SECRET>
 *   - Authorization: Bearer <CRON_SECRET>
 *
 * If neither SUPABASE_SERVICE_ROLE_KEY nor CRON_SECRET are configured
 * server-side, the check fails closed (returns 503).
 */
export function requireCronAuth(req: Request, opts: CronAuthOptions = {}): Response | null {
  const { allowOptions = true, corsHeaders = {} } = opts;
  if (allowOptions && req.method === "OPTIONS") return null;

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

  if (!serviceKey && !cronSecret) {
    return new Response(
      JSON.stringify({ error: "Cron auth not configured" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const xCron = req.headers.get("x-cron-secret") ?? "";

  const candidates = [bearer, xCron].filter((c) => c.length > 0);
  const accepted = [serviceKey, cronSecret].filter((c) => c.length > 0);

  for (const provided of candidates) {
    for (const expected of accepted) {
      if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
        return null;
      }
    }
  }

  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
