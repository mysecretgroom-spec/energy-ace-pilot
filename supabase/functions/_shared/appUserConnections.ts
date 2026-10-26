// Server-only storage of each user's encrypted connector key.
import { createClient } from "npm:@supabase/supabase-js@2";
import { encryptConnectionKey, decryptConnectionKey } from "./connectionKeyCrypto.ts";

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

export async function saveConnectionKeyForUser(userId: string, connectorId: string, connectionAPIKey: string) {
  const { error } = await adminClient().from("app_user_connections").upsert({
    user_id: userId,
    connector_id: connectorId,
    connection_key_ciphertext: await encryptConnectionKey(connectionAPIKey),
    reconnect_required: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,connector_id" });
  if (error) throw error;
}

export async function getConnectionForUser(userId: string, connectorId: string) {
  const { data, error } = await adminClient().from("app_user_connections")
    .select("connection_key_ciphertext, reconnect_required, root_folder_id")
    .eq("user_id", userId).eq("connector_id", connectorId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    key: await decryptConnectionKey(data.connection_key_ciphertext),
    reconnectRequired: data.reconnect_required as boolean,
    rootFolderId: data.root_folder_id as string | null,
  };
}

export async function getConnectionKeyForUser(userId: string, connectorId: string) {
  return (await getConnectionForUser(userId, connectorId))?.key ?? null;
}

export async function updateConnection(userId: string, connectorId: string, patch: Record<string, unknown>) {
  await adminClient().from("app_user_connections").update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId).eq("connector_id", connectorId);
}

export async function deleteConnectionForUser(userId: string, connectorId: string) {
  await adminClient().from("app_user_connections").delete().eq("user_id", userId).eq("connector_id", connectorId);
}
