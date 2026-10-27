import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { getAuthUser } from "../_shared/authUser.ts";
import { adminClient } from "../_shared/appUserConnections.ts";
import { encryptConnectionKey, decryptConnectionKey } from "../_shared/connectionKeyCrypto.ts";
import { getUnifiedGoogleConnection, getUnifiedGoogleToken } from "../_shared/googleUnified.ts";
import { UNIFIED_GOOGLE_SCOPES, googleServices, googleReturnUri, validGoogleState } from "../_shared/googleOAuthPolicy.ts";
import { VISITOR_USER_ID } from "../_shared/visitorGuard.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), origin: z.string().url() }),
  z.object({ action: z.literal("complete"), code: z.string().min(1).max(4000), state: z.string().min(32).max(200) }),
  z.object({ action: z.literal("status") }), z.object({ action: z.literal("disconnect") }),
]);
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const hash = async (text: string) => base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: "Connexion requise" }, 401);
    if (user.id === VISITOR_USER_ID) return json({ error: "Indisponible en mode visiteur" }, 403);
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Demande Google invalide" }, 400);
    const body = parsed.data;
    const db = adminClient();
    if (body.action === "status") {
      const row = await getUnifiedGoogleConnection(user.id);
      const services = googleServices(row?.scopes ?? []);
      const token = row ? await getUnifiedGoogleToken(user.id) : null;
      return json({ connected: !!token && Object.values(services).every(Boolean), services, email: row?.email, reconnectRequired: !!row && !token, configured: !!Deno.env.get("GOOGLE_CLIENT_ID") && !!Deno.env.get("GOOGLE_CLIENT_SECRET") });
    }
    if (body.action === "disconnect") {
      const row = await getUnifiedGoogleConnection(user.id);
      if (row) {
        const res = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: await decryptConnectionKey(row.refresh_token_ciphertext) }) });
        if (!res.ok && res.status !== 400) return json({ error: "Google n'a pas confirmé la déconnexion" }, 502);
      }
      const { error } = await db.from("google_oauth_connections").delete().eq("user_id", user.id);
      if (error) throw error;
      const { error: legacyError } = await db.from("google_tokens").delete().eq("user_id", user.id);
      if (legacyError) throw legacyError;
      return json({ connected: false });
    }
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID"), clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "La connexion Google doit être configurée" }, 503);
    if (body.action === "start") {
      let redirectUri: string;
      try { redirectUri = googleReturnUri(body.origin); } catch { return json({ error: "Adresse de retour non autorisée" }, 400); }
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const { error } = await db.from("google_oauth_states").insert({ state_hash: await hash(state), user_id: user.id, verifier_ciphertext: await encryptConnectionKey(verifier), redirect_uri: redirectUri, expires_at: new Date(Date.now() + 600_000).toISOString() });
      if (error) throw error;
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: UNIFIED_GOOGLE_SCOPES.join(" "), state, access_type: "offline", prompt: "consent", code_challenge: await hash(verifier), code_challenge_method: "S256" }).toString();
      return json({ authorizationUrl: url.toString(), redirectUri });
    }
    // Atomic consume scoped to the authenticated caller; another user cannot consume this state.
    const { data: states, error: stateError } = await db.from("google_oauth_states").delete().eq("state_hash", await hash(body.state)).eq("user_id", user.id).select("*");
    if (stateError) throw stateError;
    const state = states?.[0] ?? null;
    if (!validGoogleState(state, user.id, Date.now())) return json({ error: "Autorisation expirée ou déjà utilisée. Recommence la connexion Google." }, 400);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: body.code, client_id: clientId, client_secret: clientSecret, redirect_uri: state.redirect_uri, grant_type: "authorization_code", code_verifier: await decryptConnectionKey(state.verifier_ciphertext) }),
    });
    if (!response.ok) return json({ error: "Google n'a pas validé l'autorisation. Vérifie l'adresse de retour du client Google puis reconnecte-toi.", status: response.status }, 400);
    const token = await response.json();
    const scopes = typeof token.scope === "string" ? token.scope.split(/\s+/) : [];
    const services = googleServices(scopes);
    if (!Object.values(services).every(Boolean)) return json({ error: "Gmail, Drive et Agenda doivent tous être autorisés. Reconnecte Google en acceptant les trois services." }, 400);
    if (typeof token.refresh_token !== "string" || typeof token.access_token !== "string" || !Number.isFinite(token.expires_in)) return json({ error: "Google n'a pas fourni une autorisation durable. Recommence la connexion." }, 400);
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) return json({ error: "Impossible de vérifier le compte Google" }, 502);
    const profile = await profileResponse.json();
    const existing = await getUnifiedGoogleConnection(user.id);
    const { error } = await db.from("google_oauth_connections").upsert({
      user_id: user.id, access_token_ciphertext: await encryptConnectionKey(token.access_token), refresh_token_ciphertext: await encryptConnectionKey(token.refresh_token),
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(), scopes, email: profile.email ?? null,
      root_folder_id: existing?.email === profile.email ? existing?.root_folder_id : null,
      reconnect_required: false, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return json({ ok: true, services, email: profile.email ?? null });
  } catch {
    return json({ error: "Connexion Google momentanément indisponible. Réessaie." }, 500);
  }
});