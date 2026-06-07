// =============================================================
// Twilio webhook signature verification (X-Twilio-Signature).
//
// Scheme: signature = base64( HMAC-SHA1( authToken, fullUrl + sorted(k+v) ) )
// Docs: https://www.twilio.com/docs/usage/webhooks/webhooks-security
//
// This module is intentionally self-contained — no external deps —
// so it can be imported by any edge function receiving Twilio webhooks.
// =============================================================

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

async function hmacSha1Base64(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  // base64 of the raw bytes
  let bin = "";
  const bytes = new Uint8Array(sig);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Verify a Twilio webhook signature.
 * @param authToken Twilio account auth token (server-side secret).
 * @param url Full request URL exactly as Twilio called it (incl. query string).
 * @param params Parsed application/x-www-form-urlencoded fields.
 * @param signatureHeader Value of the `X-Twilio-Signature` request header.
 */
export async function verifyTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
  signatureHeader: string | null,
): Promise<boolean> {
  if (!signatureHeader || !authToken) return false;
  const keys = Object.keys(params).sort();
  let data = url;
  for (const k of keys) data += k + (params[k] ?? "");
  const expected = await hmacSha1Base64(authToken, data);
  return timingSafeEqual(expected, signatureHeader);
}

/**
 * Reconstruct the public webhook URL Twilio would have used.
 * Prefer X-Forwarded-* headers when behind a proxy (Supabase edge runtime).
 */
export function reconstructPublicUrl(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}${u.pathname}${u.search}`;
}
