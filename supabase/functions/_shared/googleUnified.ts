// Custom per-user Google OAuth, explicitly selected to authorize three products once.
import { adminClient } from "./appUserConnections.ts";
import { encryptConnectionKey, decryptConnectionKey } from "./connectionKeyCrypto.ts";

export async function getUnifiedGoogleConnection(userId: string) {
  const { data, error } = await adminClient().from("google_oauth_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getUnifiedGoogleToken(userId: string): Promise<string | null> {
  const row = await getUnifiedGoogleConnection(userId);
  if (!row || row.reconnect_required) return null;
  if (Date.parse(row.expires_at) > Date.now() + 300_000) return decryptConnectionKey(row.access_token_ciphertext);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Configuration Google manquante");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: await decryptConnectionKey(row.refresh_token_ciphertext), grant_type: "refresh_token" }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.error === "invalid_grant") {
      const { error } = await adminClient().from("google_oauth_connections").update({ reconnect_required: true }).eq("user_id", userId);
      if (error) throw error;
      return null;
    }
    // Never log Google's token response: successful and failed responses can contain credentials.
    throw new Error(`Renouvellement Google indisponible (${res.status})`);
  }
  const body = await res.json();
  if (typeof body.access_token !== "string" || !Number.isFinite(body.expires_in)) throw new Error("Réponse de renouvellement Google invalide");
  const patch: Record<string, unknown> = {
    access_token_ciphertext: await encryptConnectionKey(body.access_token),
    expires_at: new Date(Date.now() + body.expires_in * 1000).toISOString(), updated_at: new Date().toISOString(),
  };
  if (body.refresh_token) patch.refresh_token_ciphertext = await encryptConnectionKey(body.refresh_token);
  const { error } = await adminClient().from("google_oauth_connections").update(patch).eq("user_id", userId);
  if (error) throw error;
  return body.access_token;
}