// =============================================================
// Image routing helpers for WhatsApp agent.
//
// Centralises the "classify first, then switch by intent" workflow
// so index.ts stays readable. These helpers do the side-effect-free
// parts: classification call, active client resolution, and uploading
// to the right bucket. Higher-level orchestration (RDV menu, finance
// extraction, response building) stays in index.ts because it depends
// on many local helpers there.
// =============================================================

// deno-lint-ignore-file no-explicit-any

export type ImageIntent = "rdv" | "finance" | "photo_etude" | "doc_client" | "autre";

export interface ClassificationResult {
  intent: ImageIntent;
  confidence: number;
  reason: string | null;
}

export interface MediaForClassify {
  base64: string;
  contentType: string;
}

/**
 * Call the `classify-image-intent` edge function and return a normalised
 * result. On any failure we degrade to `{ intent: "autre", confidence: 0 }`
 * so the caller can fall back to "ask the user".
 */
export async function classifyImage(
  media: MediaForClassify,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<ClassificationResult> {
  try {
    const dataUrl = `data:${media.contentType};base64,${media.base64}`;
    const resp = await fetch(`${supabaseUrl}/functions/v1/classify-image-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ image_base64: dataUrl }),
    });
    if (!resp.ok) {
      console.warn(`[classify] HTTP ${resp.status} → defaulting to autre`);
      return { intent: "autre", confidence: 0, reason: null };
    }
    const json = await resp.json();
    if (!json?.success) {
      return { intent: "autre", confidence: 0, reason: null };
    }
    const allowed: ImageIntent[] = ["rdv", "finance", "photo_etude", "doc_client", "autre"];
    return {
      intent: allowed.includes(json.intent) ? json.intent : "autre",
      confidence: typeof json.confidence === "number" ? json.confidence : 0,
      reason: json.reason ?? null,
    };
  } catch (e) {
    console.error("[classify] error:", e);
    return { intent: "autre", confidence: 0, reason: null };
  }
}

/**
 * Resolve the "active client" the commercial is currently working on, used
 * to attach photo_etude / doc_client uploads to the right dossier.
 *
 * Resolution order:
 *  1. Last RDV / client / vente / facture / etude touched (whatsapp_conversations.last_executed_action)
 *  2. null if nothing recent (caller will ask "Pour quel client ?")
 */
export async function resolveActiveClientId(
  supabase: any,
  userId: string,
): Promise<{ clientId: string | null; clientName: string | null }> {
  try {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("last_executed_action")
      .eq("user_id", userId)
      .maybeSingle();

    const action = data?.last_executed_action as
      | { entityType?: string; entityId?: string | null; createdAt?: string }
      | null;

    if (!action?.entityId) return { clientId: null, clientName: null };

    // Hard expiration: 6 hours (the commercial may finish a study and move on)
    const ageMs = Date.now() - new Date(action.createdAt || 0).getTime();
    if (Number.isFinite(ageMs) && ageMs > 6 * 60 * 60 * 1000) {
      return { clientId: null, clientName: null };
    }

    let clientId: string | null = null;
    switch (action.entityType) {
      case "client":
        clientId = action.entityId;
        break;
      case "rdv": {
        const { data: rdv } = await supabase
          .from("rdv")
          .select("client_id")
          .eq("id", action.entityId)
          .eq("user_id", userId)
          .maybeSingle();
        clientId = rdv?.client_id ?? null;
        break;
      }
      case "vente": {
        const { data: v } = await supabase
          .from("ventes")
          .select("client_id")
          .eq("id", action.entityId)
          .eq("user_id", userId)
          .maybeSingle();
        clientId = v?.client_id ?? null;
        break;
      }
      case "etude": {
        const { data: e } = await supabase
          .from("etudes")
          .select("client_id")
          .eq("id", action.entityId)
          .eq("user_id", userId)
          .maybeSingle();
        clientId = e?.client_id ?? null;
        break;
      }
      default:
        clientId = null;
    }

    if (!clientId) return { clientId: null, clientName: null };

    const { data: client } = await supabase
      .from("clients")
      .select("nom, prenom")
      .eq("id", clientId)
      .eq("user_id", userId)
      .maybeSingle();

    const clientName = client
      ? [client.prenom, client.nom].filter(Boolean).join(" ").trim() || null
      : null;
    return { clientId, clientName };
  } catch (e) {
    console.error("[resolveActiveClientId] error:", e);
    return { clientId: null, clientName: null };
  }
}

/**
 * Upload a photo_etude image to the `documents` bucket and create the
 * matching `documents` row (type `photo_chantier`) linked to the active client.
 */
export async function uploadPhotoEtude(
  supabase: any,
  userId: string,
  clientId: string,
  imageBase64: string,
  contentType: string,
): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  try {
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const filename = `whatsapp_${Date.now()}.${ext}`;
    const storagePath = `${userId}/${clientId}/${filename}`;

    // Decode base64 → Uint8Array
    const binary = atob(imageBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const { error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, bytes, { contentType, upsert: false });
    if (uploadErr) return { ok: false, error: uploadErr.message };

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);

    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        client_id: clientId,
        user_id: userId,
        nom: filename,
        type_document: "photo_chantier",
        url: urlData.publicUrl,
        mime_type: contentType,
        taille_bytes: bytes.byteLength,
        context_source: "whatsapp",
        metadata: { source: "whatsapp_photo_etude" },
      })
      .select("id")
      .single();
    if (insertErr) return { ok: false, error: insertErr.message };

    return { ok: true, documentId: doc.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Upload a doc_client image to the `pending-documents` bucket and create a
 * `pending_documents` row for admin review (no auto-assign, manual triage).
 */
export async function uploadDocClient(
  supabase: any,
  userId: string,
  imageBase64: string,
  contentType: string,
  hintedClientId: string | null,
  hintedClientName: string | null,
): Promise<{ ok: boolean; pendingId?: string; error?: string }> {
  try {
    const ext = contentType.split("/")[1]?.split(";")[0] || "jpg";
    const filename = `whatsapp_doc_${Date.now()}.${ext}`;
    const storagePath = `${userId}/${filename}`;

    const binary = atob(imageBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const { error: uploadErr } = await supabase.storage
      .from("pending-documents")
      .upload(storagePath, bytes, { contentType, upsert: false });
    if (uploadErr) return { ok: false, error: uploadErr.message };

    const { data: pending, error: insertErr } = await supabase
      .from("pending_documents")
      .insert({
        user_id: userId,
        original_filename: filename,
        storage_path: storagePath,
        mime_type: contentType,
        file_size_bytes: bytes.byteLength,
        source: "whatsapp",
        ai_detected_client_id: hintedClientId,
        ai_detected_client_name: hintedClientName,
        ai_confidence: hintedClientId ? 60 : 0, // below 80 → never auto-assign
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr) return { ok: false, error: insertErr.message };

    return { ok: true, pendingId: pending.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Build the user-facing reply when the classifier is uncertain or the image
 * is "autre" — gives the commercial 4 options to clarify.
 */
export function buildClarificationMessage(ocrText: string | null): string {
  const head = ocrText && ocrText.trim().length > 0
    ? `🤔 Je ne suis pas sûr de ce que tu m'as envoyé. Voici ce que j'ai pu lire :\n\n_${ocrText.trim().slice(0, 280)}${ocrText.length > 280 ? "…" : ""}_\n\n`
    : "🤔 Je ne suis pas sûr de ce que tu m'as envoyé.\n\n";
  return (
    head +
    "👉 Réponds par :\n" +
    "• *rdv* — c'est un rendez-vous à créer\n" +
    "• *frais* — c'est une note de frais\n" +
    "• *photo* — photo terrain (compteur, toiture, tableau)\n" +
    "• *document* — document client (CNI, RIB, justificatif)"
  );
}

/**
 * Build the soft-confirmation hint to append when classifier confidence
 * is moderate (0.4 ≤ c < 0.7) and we still went ahead with the action.
 */
export function buildSoftConfirmHint(intent: ImageIntent): string {
  const label = intent === "rdv"
    ? "rdv"
    : intent === "finance"
      ? "frais"
      : intent === "photo_etude"
        ? "photo"
        : "document";
  return `\n\n_Si je me suis trompé : réponds *${label === "rdv" ? "frais" : "rdv"}* / *photo* / *document* pour rectifier._`;
}
