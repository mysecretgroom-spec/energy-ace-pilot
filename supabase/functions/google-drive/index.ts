// Google Drive de chaque utilisateur : connexion, statut, déconnexion et envoi des fichiers.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import {
  authorizeAppUserOAuth, callAsAppUser, appUserReconnectRequired, disconnectAppUser, exchangeAppUserOAuthCode,
} from "../_shared/appUserConnector.ts";
import {
  adminClient, deleteConnectionForUser, getConnectionForUser, saveConnectionKeyForUser, updateConnection,
} from "../_shared/appUserConnections.ts";
import { DRIVE_CONNECTOR, GATEWAY_BASE_URL, GOOGLE_DRIVE_SCOPES } from "../_shared/appUserScopes.ts";
import { getAuthUser } from "../_shared/authUser.ts";
import { getUnifiedGoogleConnection, getUnifiedGoogleToken } from "../_shared/googleUnified.ts";
import { VISITOR_USER_ID } from "../_shared/visitorGuard.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), origin: z.string().url() }),
  z.object({ action: z.literal("complete"), code: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("status") }),
  z.object({ action: z.literal("disconnect") }),
  z.object({ action: z.literal("sync") }),
]);

const FOLDER = "application/vnd.google-apps.folder";
const BATCH_DOCS = 15;
const BATCH_ETUDES = 5;

class ReconnectError extends Error {}
type DriveCredential = { kind: "connector" | "direct"; value: string };

function driveCall(key: DriveCredential, path: string, init?: RequestInit) {
  if (key.kind === "direct") {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${key.value}`);
    return fetch(`https://www.googleapis.com${path}`, { ...init, headers });
  }
  return callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: key.value, connectorId: DRIVE_CONNECTOR,
    path, init, requiredScopes: GOOGLE_DRIVE_SCOPES,
  });
}

async function driveJson<T>(key: DriveCredential, path: string, init?: RequestInit): Promise<T> {
  const res = await driveCall(key, path, init);
  if ((key.kind === "direct" && res.status === 401) || await appUserReconnectRequired(res)) throw new ReconnectError("reconnect");
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive [${res.status}]: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function ensureFolder(key: DriveCredential, name: string, parent?: string): Promise<string> {
  const q = `name='${esc(name)}' and mimeType='${FOLDER}' and trashed=false` + (parent ? ` and '${parent}' in parents` : "");
  const found = await driveJson<{ files: { id: string }[] }>(key, `/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
  if (found.files?.[0]) return found.files[0].id;
  const created = await driveJson<{ id: string }>(key, "/drive/v3/files?fields=id", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, ...(parent ? { parents: [parent] } : {}) }),
  });
  return created.id;
}

async function uploadFile(key: DriveCredential, parent: string, name: string, blob: Blob) {
  const boundary = `dbp${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name, parents: [parent] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || "application/octet-stream"}\r\n\r\n`,
    blob,
    `\r\n--${boundary}--`,
  ]);
  return driveJson<{ id: string; webViewLink?: string }>(key, "/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", {
    method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
}

function storageLocation(url: string, fallbackBucket: string) {
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
  if (/^https?:/.test(url)) return null;
  return { bucket: fallbackBucket, path: url };
}

async function download(url: string, bucket: string): Promise<Blob> {
  const loc = storageLocation(url, bucket);
  if (!loc) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Fichier introuvable (${r.status})`);
    return await r.blob();
  }
  const { data, error } = await adminClient().storage.from(loc.bucket).download(loc.path);
  if (error || !data) throw new Error(`Fichier introuvable : ${error?.message ?? "vide"}`);
  return data;
}

const clientLabel = (c: { nom?: string | null; prenom?: string | null } | null) =>
  (c ? [c.nom, c.prenom].filter(Boolean).join(" ") : "") || "Sans client";

async function sync(userId: string, key: DriveCredential, rootFolderId: string | null) {
  const db = adminClient();
  const root = rootFolderId ?? await ensureFolder(key, "DébalePro");
  if (!rootFolderId) {
    if (key.kind === "direct") {
      const { error } = await db.from("google_oauth_connections").update({ root_folder_id: root }).eq("user_id", userId);
      if (error) throw error;
    } else await updateConnection(userId, DRIVE_CONNECTOR, { root_folder_id: root });
  }
  const folders = new Map<string, string>();
  const folderFor = async (clientId: string | null, label: string) => {
    const k = clientId ?? "none";
    if (!folders.has(k)) folders.set(k, await ensureFolder(key, label, root));
    const folder = folders.get(k);
    if (!folder) throw new Error("Dossier Drive introuvable");
    return folder;
  };

  const { data: sent } = await db.from("drive_uploads").select("document_id, etude_id").eq("user_id", userId).eq("status", "sent");
  const sentDocs = new Set((sent ?? []).map((s) => s.document_id).filter(Boolean));
  const sentEtudes = new Set((sent ?? []).filter((s) => !s.document_id).map((s) => s.etude_id).filter(Boolean));

  const { data: docs } = await db.from("documents")
    .select("id, nom, url, mime_type, client_id, etude_id, context_source, clients(nom, prenom)")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(1000);
  const todoDocs = (docs ?? []).filter((d) => !sentDocs.has(d.id)).slice(0, BATCH_DOCS);

  const { data: etudes } = await db.from("etudes")
    .select("id, pdf_url, client_id, product_type, clients(nom, prenom)")
    .eq("user_id", userId).not("pdf_url", "is", null).order("updated_at", { ascending: false }).limit(500);
  const todoEtudes = (etudes ?? []).filter((e) => !sentEtudes.has(e.id)).slice(0, BATCH_ETUDES);

  let ok = 0, failed = 0;
  const log = (row: Record<string, unknown>) => db.from("drive_uploads").insert({ user_id: userId, ...row });

  for (const d of todoDocs) {
    const source = (d.context_source ?? "").toLowerCase().includes("whatsapp") ? "whatsapp"
      : (d.context_source ?? "").toLowerCase().includes("scan") ? "scan" : d.etude_id ? "etude" : "document";
    try {
      const blob = await download(d.url, "documents");
      const parent = await folderFor(d.client_id, clientLabel(d.clients as never));
      const f = await uploadFile(key, parent, d.nom, d.mime_type ? new Blob([blob], { type: d.mime_type }) : blob);
      await log({ client_id: d.client_id, document_id: d.id, etude_id: d.etude_id, source, file_name: d.nom, drive_file_id: f.id, drive_link: f.webViewLink, status: "sent" });
      ok++;
    } catch (e) {
      if (e instanceof ReconnectError) throw e;
      await log({ client_id: d.client_id, document_id: d.id, etude_id: d.etude_id, source, file_name: d.nom, status: "failed", error: String((e as Error).message).slice(0, 300) });
      failed++;
    }
  }
  for (const e of todoEtudes) {
    const name = `Étude ${e.product_type ?? ""} - ${clientLabel(e.clients as never)}.pdf`.replace(/\s+/g, " ");
    try {
      if (!e.pdf_url) throw new Error("PDF indisponible");
      const blob = await download(e.pdf_url, "etudes-pdf");
      const parent = await folderFor(e.client_id, clientLabel(e.clients as never));
      const f = await uploadFile(key, parent, name, new Blob([blob], { type: "application/pdf" }));
      await log({ client_id: e.client_id, etude_id: e.id, source: "etude", file_name: name, drive_file_id: f.id, drive_link: f.webViewLink, status: "sent" });
      ok++;
    } catch (err) {
      if (err instanceof ReconnectError) throw err;
      await log({ client_id: e.client_id, etude_id: e.id, source: "etude", file_name: name, status: "failed", error: String((err as Error).message).slice(0, 300) });
      failed++;
    }
  }
  const remaining = (docs ?? []).filter((d) => !sentDocs.has(d.id)).length - todoDocs.length
    + (etudes ?? []).filter((x) => !sentEtudes.has(x.id)).length - todoEtudes.length;
  return { sent: ok, failed, remaining: Math.max(0, remaining) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const user = await getAuthUser(req);
    if (!user) return json({ error: "Connexion requise" }, 401);
    if (user.id === VISITOR_USER_ID) return json({ error: "Indisponible en mode visiteur" }, 403);

    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const body = parsed.data;

    if (body.action === "start") {
      const clientAPIKey = Deno.env.get("GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY");
      if (!clientAPIKey) return json({ error: "Google Drive n'est pas configuré" }, 500);
      const existing = await getConnectionForUser(user.id, DRIVE_CONNECTOR);
      const { authorizationUrl } = await authorizeAppUserOAuth({
        gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: DRIVE_CONNECTOR, appUserId: user.id, clientAPIKey,
        returnUrl: new URL("/oauth/google-drive/return", body.origin).toString(),
        connectionAPIKey: existing?.key,
        credentialsConfiguration: { scopes: GOOGLE_DRIVE_SCOPES },
      });
      return json({ authorizationUrl });
    }

    if (body.action === "complete") {
      const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, body.code);
      if (connectorId !== DRIVE_CONNECTOR) return json({ error: "Mauvais service" }, 400);
      await saveConnectionKeyForUser(user.id, connectorId, connectionAPIKey);
      return json({ ok: true });
    }

    const unified = await getUnifiedGoogleConnection(user.id);
    if (unified && (body.action === "status" || body.action === "sync")) {
      const token = await getUnifiedGoogleToken(user.id);
      if (!token) return json({ connected: false, reconnectRequired: true });
      if (body.action === "status") return json({ connected: true, email: unified.email });
      try {
        return json({ connected: true, ...await sync(user.id, { kind: "direct", value: token }, unified.root_folder_id) });
      } catch (e) {
        if (e instanceof ReconnectError) {
          await adminClient().from("google_oauth_connections").update({ reconnect_required: true }).eq("user_id", user.id);
          return json({ connected: false, reconnectRequired: true });
        }
        throw e;
      }
    }
    const conn = await getConnectionForUser(user.id, DRIVE_CONNECTOR);
    if (!conn) return json({ connected: false });

    if (body.action === "disconnect") {
      await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: conn.key, connectorId: DRIVE_CONNECTOR });
      await deleteConnectionForUser(user.id, DRIVE_CONNECTOR);
      return json({ connected: false });
    }

    if (conn.reconnectRequired) return json({ connected: false, reconnectRequired: true });

    try {
      if (body.action === "status") {
        const about = await driveJson<{ user?: { emailAddress?: string } }>({ kind: "connector", value: conn.key }, "/drive/v3/about?fields=user(emailAddress)");
        return json({ connected: true, email: about.user?.emailAddress ?? null });
      }
      const result = await sync(user.id, { kind: "connector", value: conn.key }, conn.rootFolderId);
      return json({ connected: true, ...result });
    } catch (e) {
      if (e instanceof ReconnectError) {
        await updateConnection(user.id, DRIVE_CONNECTOR, { reconnect_required: true });
        return json({ connected: false, reconnectRequired: true });
      }
      throw e;
    }
  } catch (e) {
    console.error("[google-drive]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
