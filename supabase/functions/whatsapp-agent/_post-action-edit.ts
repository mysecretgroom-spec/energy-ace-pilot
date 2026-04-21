// =============================================================
// Post-action edit helper
// Allows the user to modify an action AFTER it has been executed
// by REPLYING (Twilio quoted reply) to the agent's recap message.
// =============================================================
//
// Flow:
// 1. Agent executes the action immediately (no Yes/No prompt).
// 2. Agent sends a recap message and stores its Twilio SID + the
//    affected entity in `whatsapp_conversations.last_executed_action`.
// 3. If the user replies to that exact message (Twilio passes
//    `OriginalRepliedMessageSid`), we route the message through
//    `handlePostActionEdit` which uses an LLM to compute a patch and
//    apply it to the existing entity.
//
// Destructive intents (delete_*, cancel_*) keep the classic
// confirmation flow; they are not handled here.

// deno-lint-ignore-file no-explicit-any

export interface LastExecutedAction {
  intent: string;
  entityType: "rdv" | "client" | "vente" | "facture" | "etude" | "multi_rdv";
  entityId: string | null;
  /** Snapshot of the data we wrote (for context only) */
  snapshot: Record<string, any>;
  /** Display label for the recap (e.g. "RDV de Dupont mardi 14h") */
  label: string;
  createdAt: string;
}

/** Tables editable through post-action edits, keyed by entityType. */
const TABLE_BY_ENTITY: Record<LastExecutedAction["entityType"], string | null> = {
  rdv: "rdv",
  client: "clients",
  vente: "ventes",
  facture: "factures",
  etude: "etudes",
  multi_rdv: null, // handled separately
};

const DESTRUCTIVE_INTENTS = new Set([
  "delete_rdv",
  "delete_client",
  "delete_vente",
  "delete_facture",
  "delete_etude",
  "cancel_rdv",
  "cancel_vente",
]);

export function isDestructiveIntent(intent: string): boolean {
  return DESTRUCTIVE_INTENTS.has(intent);
}

/** Append a short edit hint to a recap message. */
export function appendEditHint(message: string): string {
  // Avoid double hints
  if (message.includes("réponds à ce message")) return message;
  return `${message}\n\n💡 _Pour modifier, réponds à ce message._`;
}

/**
 * Persist the last-executed-action snapshot on the conversation row.
 * Called after we send the recap message and capture its Twilio SID.
 */
export async function rememberLastAction(
  supabase: any,
  userId: string,
  phoneNumber: string,
  action: LastExecutedAction,
  twilioSid: string | null,
): Promise<void> {
  await supabase.from("whatsapp_conversations").upsert(
    {
      user_id: userId,
      phone_number: phoneNumber,
      last_executed_action: action,
      last_action_message_sid: twilioSid,
      last_message_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
}

/**
 * Look up a remembered action by replying-to message SID.
 * Returns null when the user is not actually replying to a recap we sent.
 */
export async function findEditTarget(
  supabase: any,
  userId: string,
  repliedSid: string | null,
): Promise<LastExecutedAction | null> {
  if (!repliedSid) return null;

  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("last_executed_action, last_action_message_sid")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.last_executed_action) return null;
  if (data.last_action_message_sid !== repliedSid) return null;

  // Hard expiration: 1 hour
  const action = data.last_executed_action as LastExecutedAction;
  const ageMs = Date.now() - new Date(action.createdAt).getTime();
  if (ageMs > 60 * 60 * 1000) return null;

  return action;
}

/**
 * Ask the LLM what fields to patch on the existing entity, given the
 * user's free-text reply. Returns a JSON patch object suitable for an
 * UPDATE statement.
 */
async function computePatch(
  apiKey: string,
  action: LastExecutedAction,
  userMessage: string,
): Promise<{ patch: Record<string, any>; explanation: string } | null> {
  const allowedFields = ALLOWED_FIELDS_BY_ENTITY[action.entityType] || [];
  if (allowedFields.length === 0) return null;

  const systemPrompt = `Tu es un assistant qui calcule un patch JSON pour modifier une entité existante dans la base d'un commercial.

ENTITÉ: ${action.entityType}
ÉTAT ACTUEL: ${JSON.stringify(action.snapshot)}
LABEL: ${action.label}

CHAMPS MODIFIABLES (n'utilise QUE ceux-là dans patch):
${allowedFields.join(", ")}

RÈGLES:
- Réponds UNIQUEMENT avec un JSON: { "patch": { ... }, "explanation": "..." }
- "patch" = uniquement les champs à modifier (n'inclus rien d'autre).
- "explanation" = phrase courte en français pour l'utilisateur (ex: "✅ Heure changée à 14h").
- Pour une date_heure, utilise le format ISO avec offset Paris (ex: "2026-04-21T14:00:00+02:00").
- Pour les dates seules, utilise YYYY-MM-DD.
- Si l'utilisateur veut SUPPRIMER l'entité, mets patch={"_delete": true}.
- Si la demande est ambiguë ou hors périmètre, mets patch={} et explique pourquoi.
- N'INVENTE PAS de valeurs.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 400,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!resp.ok) {
      console.error("computePatch AI error:", resp.status, await resp.text().catch(() => ""));
      return null;
    }
    const json = await resp.json();
    const raw = json?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      patch: (parsed?.patch || {}) as Record<string, any>,
      explanation: String(parsed?.explanation || ""),
    };
  } catch (e) {
    console.error("computePatch exception:", e);
    return null;
  }
}

const ALLOWED_FIELDS_BY_ENTITY: Record<string, string[]> = {
  rdv: ["date_heure", "adresse", "code_postal", "ville", "type_rdv", "type_projet", "status", "regie_id", "notes"],
  client: ["nom", "prenom", "telephone", "email", "adresse", "code_postal", "ville", "notes"],
  vente: ["puissance_kwc", "prix_ttc", "status", "pipeline_status", "date_signature", "notes"],
  facture: ["montant_ttc", "fournisseur", "categorie", "date_facture", "notes"],
  etude: ["notes"],
};

/**
 * Entry point used by index.ts. Returns the final agent response text.
 * On success: applies the patch and returns a confirmation message.
 * On unsupported request: returns null so the caller falls back to the
 * normal pipeline.
 */
export async function handlePostActionEdit(
  supabase: any,
  userId: string,
  apiKey: string,
  action: LastExecutedAction,
  userMessage: string,
): Promise<{
  responseMessage: string;
  intent: string;
  entityType: string;
  entityId: string | null;
  actionTaken: string;
} | null> {
  // multi_rdv edits route through a separate flow (not in this MVP).
  const table = TABLE_BY_ENTITY[action.entityType];
  if (!table || !action.entityId) return null;

  const result = await computePatch(apiKey, action, userMessage);
  if (!result) {
    return {
      responseMessage:
        "🤔 Je n'ai pas compris ta modification. Sois plus précis (ex: \"change l'heure à 14h\").",
      intent: "post_action_edit",
      entityType: action.entityType,
      entityId: action.entityId,
      actionTaken: "edit_unclear",
    };
  }

  const { patch, explanation } = result;

  // Handle delete request through edit flow
  if (patch?._delete === true) {
    const { error: delErr } = await supabase.from(table).delete().eq("id", action.entityId).eq("user_id", userId);
    if (delErr) {
      return {
        responseMessage: `❌ Impossible de supprimer: ${delErr.message}`,
        intent: "post_action_edit",
        entityType: action.entityType,
        entityId: action.entityId,
        actionTaken: "edit_failed",
      };
    }
    return {
      responseMessage: `🗑️ ${action.label} supprimé.`,
      intent: "post_action_edit",
      entityType: action.entityType,
      entityId: action.entityId,
      actionTaken: "edit_deleted",
    };
  }

  if (!patch || Object.keys(patch).length === 0) {
    return {
      responseMessage: explanation || "🤔 Modification non comprise. Dis-moi ce que tu veux changer (ex: \"change l'heure à 14h\").",
      intent: "post_action_edit",
      entityType: action.entityType,
      entityId: action.entityId,
      actionTaken: "edit_noop",
    };
  }

  // Strip any field outside the allowlist (defensive)
  const allowed = ALLOWED_FIELDS_BY_ENTITY[action.entityType] || [];
  const safePatch: Record<string, any> = {};
  for (const k of Object.keys(patch)) {
    if (allowed.includes(k)) safePatch[k] = patch[k];
  }
  if (Object.keys(safePatch).length === 0) {
    return {
      responseMessage: "🤔 Cette modification n'est pas supportée pour cette entité.",
      intent: "post_action_edit",
      entityType: action.entityType,
      entityId: action.entityId,
      actionTaken: "edit_unsupported",
    };
  }

  const { error: updErr } = await supabase
    .from(table)
    .update(safePatch)
    .eq("id", action.entityId)
    .eq("user_id", userId);

  if (updErr) {
    console.error("post-action-edit update error:", updErr);
    return {
      responseMessage: `❌ Modification refusée: ${updErr.message}`,
      intent: "post_action_edit",
      entityType: action.entityType,
      entityId: action.entityId,
      actionTaken: "edit_failed",
    };
  }

  return {
    responseMessage: appendEditHint(explanation || "✅ Modifié."),
    intent: "post_action_edit",
    entityType: action.entityType,
    entityId: action.entityId,
    actionTaken: "edit_applied",
  };
}
