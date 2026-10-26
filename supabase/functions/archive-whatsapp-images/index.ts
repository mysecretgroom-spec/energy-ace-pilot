// Archive les images WhatsApp traitées dans un ZIP par utilisateur (stockage privé),
// puis libère la base. Les images restent récupérables via whatsapp_image_archives.
import { createClient } from "npm:@supabase/supabase-js@2";
import { zipSync } from "npm:fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 200;

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",").pop()! : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const ext = (m: string) => (m?.split("/")[1] || "jpg").replace("jpeg", "jpg");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cutoff = new Date(Date.now() - 2 * 86400_000).toISOString();
  const summary: Record<string, number> = {};

  try {
    for (let guard = 0; guard < 50; guard++) {
      // Images non en cours (status != pending) ou abandonnées depuis plus de 2 jours
      const { data: rows, error } = await supabase
        .from("whatsapp_pending_images")
        .select("id, user_id, image_data, mime_type, created_at")
        .lt("created_at", cutoff)
        .order("user_id").order("created_at")
        .limit(BATCH);
      if (error) throw error;
      if (!rows?.length) break;

      const byUser = new Map<string, typeof rows>();
      for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

      for (const [userId, imgs] of byUser) {
        const files: Record<string, Uint8Array> = {};
        imgs.forEach((im, i) => {
          if (!im.image_data) return;
          const stamp = im.created_at.replace(/[:.]/g, "-");
          files[`${stamp}_${i + 1}.${ext(im.mime_type)}`] = b64ToBytes(im.image_data);
        });
        const zip = zipSync(files, { level: 0 }); // images déjà compressées
        const path = `${userId}/whatsapp-${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 6)}.zip`;
        const { error: upErr } = await supabase.storage.from("whatsapp-archives")
          .upload(path, zip, { contentType: "application/zip" });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("whatsapp_image_archives").insert({
          user_id: userId, storage_path: path, image_count: Object.keys(files).length,
          size_bytes: zip.byteLength, period_start: imgs[0].created_at, period_end: imgs[imgs.length - 1].created_at,
        });
        if (insErr) throw insErr;

        // Suppression seulement après archivage confirmé
        const { error: delErr } = await supabase.from("whatsapp_pending_images")
          .delete().in("id", imgs.map((x) => x.id));
        if (delErr) throw delErr;
        summary[userId] = (summary[userId] ?? 0) + imgs.length;
      }
    }
    return new Response(JSON.stringify({ archived: summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("archive-whatsapp-images failed:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
