// =============================================================
// Multi-RDV WhatsApp workflow (extraction batch + menu A/B/C/D…)
// Standalone helper module imported by index.ts
// =============================================================

// deno-lint-ignore-file no-explicit-any

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface ExtractedRdv {
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  date: string | null;
  heure: string | null;
  type_projet: string | null;
  notes: string | null;
  confidence: number;
}

export interface MultiRdvBatchData {
  /** RDV proposed to user, indexed by letter A,B,C... */
  rdvs: ExtractedRdv[];
  /** Letters validated by user (already created) — for tracking */
  validated: string[];
  /** Letters removed by user */
  removed: string[];
  /** Régie selected for the whole batch (when uniform) */
  regieId: string | null;
  /** Régie name (display, when uniform) */
  regieName: string | null;
  /** Per-RDV régie override (letter → regieId). Used when each RDV has its own régie. */
  perRdvRegie?: Record<string, string>;
  /** Per-RDV régie name (letter → regieName) for display */
  perRdvRegieName?: Record<string, string>;
  /** Letter currently waiting for its régie (per-RDV mode) */
  pendingRegieLetter?: string | null;
  /** True when user is editing a specific entry (e.g. "ÉDITER B") */
  editingLetter?: string | null;
  /** Field being edited if editing flow */
  editingField?: string | null;
  /** Pre-computed duplicate / conflict warnings (per letter) */
  warnings?: Array<{ letter: string; kind: "duplicate" | "conflict"; message: string }>;
  /** Optional contextual note added by user (e.g. "client a déménagé") */
  contextNote?: string | null;
  /** Created at ISO */
  createdAt: string;
}

/** Build a data URL from base64 + mime */
function toDataUrl(base64: string, mime: string): string {
  if (base64.startsWith("data:")) return base64;
  return `data:${mime || "image/jpeg"};base64,${base64}`;
}

/** Add an image to the user's pending buffer */
export async function bufferImage(
  supabase: any,
  userId: string,
  phoneNumber: string,
  base64: string,
  mimeType: string,
): Promise<{ ok: boolean; pendingCount: number; error?: string }> {
  // Insert
  const { error } = await supabase.from("whatsapp_pending_images").insert({
    user_id: userId,
    phone_number: phoneNumber,
    image_data: base64,
    mime_type: mimeType || "image/jpeg",
    status: "pending",
  });
  if (error) {
    console.error("bufferImage insert failed:", error);
    return { ok: false, pendingCount: 0, error: error.message };
  }

  const { count } = await supabase
    .from("whatsapp_pending_images")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");

  return { ok: true, pendingCount: count ?? 1 };
}

/** Detect "GO" / "OK" trigger message (case-insensitive, isolated word) */
export function isGoTrigger(message: string): boolean {
  const t = message.trim().toLowerCase().replace(/[!.?]+$/g, "");
  return ["go", "ok", "okay", "valide", "valider", "traite", "traiter", "fini", "c'est bon", "cest bon"].includes(t);
}

/** Detect short ack messages so we don't spam the user */
export function isCancelMultiRdv(message: string): boolean {
  const t = message.trim().toLowerCase();
  return ["non", "annule", "annuler", "stop", "oublie"].includes(t);
}

/** Fetch all pending images for user */
export async function fetchPendingImages(
  supabase: any,
  userId: string,
): Promise<Array<{ id: string; image_data: string; mime_type: string }>> {
  const { data, error } = await supabase
    .from("whatsapp_pending_images")
    .select("id, image_data, mime_type")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("fetchPendingImages error:", error);
    return [];
  }
  return data || [];
}

/** Mark images as processed */
export async function markImagesProcessed(
  supabase: any,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  await supabase
    .from("whatsapp_pending_images")
    .update({ status: "processed", processed_at: new Date().toISOString() })
    .in("id", ids);
}

/** Discard buffered images (cancel) */
export async function discardPendingImages(
  supabase: any,
  userId: string,
): Promise<void> {
  await supabase
    .from("whatsapp_pending_images")
    .update({ status: "discarded", processed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");
}

/** Call extract-rdv-from-image with multiple images */
export async function extractRdvsFromImages(
  images: Array<{ image_data: string; mime_type: string }>,
  supabaseUrl: string,
  serviceRoleKey: string,
): Promise<{ ok: boolean; rdvs: ExtractedRdv[]; error?: string }> {
  try {
    const payload = {
      images: images.map((img) => ({ data: toDataUrl(img.image_data, img.mime_type) })),
    };
    const resp = await fetch(`${supabaseUrl}/functions/v1/extract-rdv-from-image`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      return { ok: false, rdvs: [], error: `extract failed (${resp.status}): ${txt.slice(0, 200)}` };
    }
    const json = await resp.json();
    const arr: ExtractedRdv[] = Array.isArray(json?.data?.rdvs) ? json.data.rdvs : [];
    return { ok: true, rdvs: arr };
  } catch (e) {
    return { ok: false, rdvs: [], error: (e as Error).message };
  }
}

/**
 * Fallback OCR: when no RDV is detected in an image, extract its raw text
 * content (notes, instructions, client info) so the conversational agent
 * can treat it as if the user had typed those notes.
 */
export async function ocrImageToText(
  base64: string,
  mimeType: string,
  apiKey: string,
): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const url = base64.startsWith("data:")
      ? base64
      : `data:${mimeType || "image/jpeg"};base64,${base64}`;

    const body = {
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "Tu es un OCR intelligent. Extrais TOUT le texte lisible de l'image en français, " +
            "en préservant les sauts de ligne et la structure (notes, instructions, infos client, etc.). " +
            "Ne commente pas. Retourne UNIQUEMENT le texte brut. Si l'image ne contient pas de texte, " +
            "retourne une chaîne vide.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extrais tout le texte de cette image." },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return { ok: false, text: "", error: `ocr failed (${resp.status}): ${t.slice(0, 200)}` };
    }
    const json = await resp.json();
    const text: string = json?.choices?.[0]?.message?.content?.trim() || "";
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: "", error: (e as Error).message };
  }
}

/** Format a single RDV summary line for the menu (compact) */
export function formatRdvLine(letter: string, r: ExtractedRdv): string {
  const fullName = [r.prenom, r.nom].filter(Boolean).join(" ").trim() || "Client";
  const dateLabel = r.date ? formatFrenchDate(r.date) : "❓ date";
  const timeLabel = r.heure ? ` ${r.heure}` : "";
  const cityLabel = r.ville ? ` — ${r.ville}` : "";
  return `*${letter}.* ${fullName} — ${dateLabel}${timeLabel}${cityLabel}`;
}

/** Format a detailed RDV block (multi-line) showing all extracted fields */
export function formatRdvDetailed(letter: string | null, r: ExtractedRdv): string {
  const fullName = [r.prenom, r.nom].filter(Boolean).join(" ").trim() || "Client";
  const dateLabel = r.date ? formatFrenchDate(r.date) : "❓ date manquante";
  const timeLabel = r.heure ? ` à ${r.heure}` : "";
  const addressParts = [r.adresse, [r.code_postal, r.ville].filter(Boolean).join(" ")].filter(Boolean);
  const addressLine = addressParts.length ? addressParts.join(", ") : null;

  const lines: string[] = [];
  lines.push(letter ? `*${letter}. ${fullName}*` : `👤 *${fullName}*`);
  lines.push(`📅 ${dateLabel}${timeLabel}`);
  if (addressLine) lines.push(`📍 ${addressLine}`);
  if (r.telephone) lines.push(`📞 ${r.telephone}`);
  if (r.email) lines.push(`✉️ ${r.email}`);
  if (r.type_projet) lines.push(`🏷️ ${r.type_projet}`);
  if (r.notes) {
    const notes = r.notes.length > 200 ? r.notes.slice(0, 200) + "…" : r.notes;
    lines.push(`📝 ${notes}`);
  }
  return lines.join("\n");
}

/** Format YYYY-MM-DD → JJ/MM/AAAA */
function formatFrenchDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Build the validation menu message with full per-RDV details */
export function buildMenuMessage(data: MultiRdvBatchData, intro?: string): string {
  const remaining = data.rdvs
    .map((r, i) => ({ letter: ALPHABET[i], rdv: r, idx: i }))
    .filter((x) => !data.removed.includes(x.letter) && !data.validated.includes(x.letter));

  if (remaining.length === 0) {
    return "✅ Plus aucun RDV à valider.";
  }

  const isSingle = remaining.length === 1;
  const header = intro || (isSingle
    ? `📸 *RDV détecté* (Régie: ${data.regieName || "?"})`
    : `📸 *${remaining.length} RDV détectés* (Régie: ${data.regieName || "?"})`);

  const blocks = remaining.map((x) => formatRdvDetailed(isSingle ? null : x.letter, x.rdv));

  const visibleLetters = new Set(remaining.map((x) => x.letter));
  const visibleWarnings = (data.warnings || []).filter((w) => visibleLetters.has(w.letter));
  const hasWarnings = visibleWarnings.length > 0;

  // Group warnings by kind for a clearer display
  const dupWarnings = visibleWarnings.filter((w) => w.kind === "duplicate");
  const conflictWarnings = visibleWarnings.filter((w) => w.kind === "conflict");

  const warnBlock: string[] = [];
  if (hasWarnings) {
    warnBlock.push("");
    warnBlock.push("━━━━━━━━━━━━━━━━━━━━");
    warnBlock.push(`⚠️ *${visibleWarnings.length} alerte${visibleWarnings.length > 1 ? "s" : ""} détectée${visibleWarnings.length > 1 ? "s" : ""}*`);
    if (dupWarnings.length) {
      warnBlock.push("");
      warnBlock.push(`🔁 *Doublon${dupWarnings.length > 1 ? "s" : ""} client* (${dupWarnings.length})`);
      for (const w of dupWarnings) {
        warnBlock.push(isSingle ? `   ${w.message}` : `   *${w.letter}.* ${w.message}`);
      }
    }
    if (conflictWarnings.length) {
      warnBlock.push("");
      warnBlock.push(`⏰ *Conflit${conflictWarnings.length > 1 ? "s" : ""} de créneau* (${conflictWarnings.length})`);
      for (const w of conflictWarnings) {
        warnBlock.push(isSingle ? `   ${w.message}` : `   *${w.letter}.* ${w.message}`);
      }
    }
    warnBlock.push("━━━━━━━━━━━━━━━━━━━━");
  }

  // Build actions: base + bypass options when warnings exist
  const actions: string[] = [];
  actions.push("*👉 Que veux-tu faire ?*");
  if (isSingle) {
    if (hasWarnings) {
      actions.push("• `OUI` → créer malgré l'alerte");
      actions.push("• `FORCER` → forcer la création (équivalent OUI)");
      actions.push("• `NOTE: ...` → ajouter un contexte avant validation");
      actions.push("   _ex: `NOTE: client a déménagé, nouveau dossier`_");
      actions.push("• `NON` → annuler");
    } else {
      actions.push("• `OUI` → créer ce RDV");
      actions.push("• `NON` → annuler");
    }
  } else {
    const lettersList = remaining.map((x) => x.letter).join(" ");
    if (hasWarnings) {
      actions.push("• `OUI` → tout créer (malgré les alertes)");
      actions.push(`• \`${lettersList}\` → créer seulement certains (lettres séparées par espace)`);
      actions.push("• `SUPPRIMER B` → retirer un RDV de la liste");
      actions.push("• `FORCER` → forcer la création de tous");
      actions.push("• `NOTE: ...` → ajouter un contexte commun");
      actions.push("   _ex: `NOTE: tournée du jour, urgents`_");
      actions.push("• `NON` → tout annuler");
    } else {
      actions.push("• `OUI` → tout créer");
      actions.push(`• \`${lettersList}\` → créer seulement certains (lettres séparées par espace)`);
      actions.push("• `SUPPRIMER B` → retirer un RDV");
      actions.push("• `NON` → tout annuler");
    }
  }

  const noteLine = data.contextNote
    ? ["", `📝 _Note ajoutée: ${data.contextNote}_`]
    : [];

  return [header, "", blocks.join("\n\n"), ...warnBlock, ...noteLine, "", ...actions].join("\n");
}

/** Build a final recap message after RDVs were created */
export function buildCreatedRecap(
  created: Array<{ rdv: ExtractedRdv; isNewClient: boolean }>,
  regieName: string | null,
  failures: Array<{ clientName: string; error: string }> = [],
): string {
  if (created.length === 0) {
    const failLines = failures.map((f) => `❌ ${f.clientName}: ${f.error}`);
    return [`😕 Aucun RDV créé.`, "", ...failLines].join("\n");
  }

  const isSingle = created.length === 1;
  const header = isSingle
    ? `✅ *RDV créé* (Régie: ${regieName || "?"})`
    : `✅ *${created.length} RDV créés* (Régie: ${regieName || "?"})`;

  const blocks = created.map((c) => {
    const detail = formatRdvDetailed(null, c.rdv);
    return c.isNewClient ? `${detail}\n🆕 _Nouveau client_` : detail;
  });

  const failLines = failures.length
    ? ["", "*Échecs:*", ...failures.map((f) => `❌ ${f.clientName}: ${f.error}`)]
    : [];

  return [header, "", blocks.join("\n\n"), ...failLines].join("\n");
}

/** Parse user response in awaiting_multi_rdv_validation state */
export type MultiRdvParseResult =
  | { kind: "create_all"; force?: boolean }
  | { kind: "create_subset"; letters: string[]; force?: boolean }
  | { kind: "remove"; letter: string }
  | { kind: "set_note"; note: string }
  | { kind: "cancel" }
  | { kind: "unknown" };

export function parseValidationResponse(message: string, data: MultiRdvBatchData): MultiRdvParseResult {
  const raw = message.trim();
  const lower = raw.toLowerCase();

  // NOTE: ... → attach a contextual note to the batch (does NOT create yet)
  const noteMatch = raw.match(/^(?:note|contexte|context|info)\s*[:\-]\s*(.+)$/i);
  if (noteMatch) {
    const note = noteMatch[1].trim();
    if (note.length > 0) return { kind: "set_note", note: note.slice(0, 500) };
  }

  // FORCER → bypass warnings and create everything
  if (["forcer", "force", "force-create", "quand meme", "quand même", "malgré", "malgre", "ignore"].includes(lower)) {
    return { kind: "create_all", force: true };
  }

  if (["oui", "ok", "yes", "tout", "tous", "valide", "valider", "go"].includes(lower)) {
    return { kind: "create_all" };
  }
  if (["non", "annule", "annuler", "stop", "cancel"].includes(lower)) {
    return { kind: "cancel" };
  }

  // SUPPRIMER X / RETIRER X / DELETE X
  const removeMatch = raw.match(/^(?:supprim(?:er|e)?|retir(?:er|e)?|enlev(?:er|e)?|delete|del)\s+([A-Za-z])\b/i);
  if (removeMatch) {
    const letter = removeMatch[1].toUpperCase();
    if (isLetterValid(letter, data)) return { kind: "remove", letter };
  }

  // Subset with optional FORCER prefix/suffix
  const forceFlag = /\bforcer?\b/i.test(raw);
  const cleaned = raw.replace(/\bforcer?\b/gi, " ").trim();
  const tokens = cleaned.split(/[\s,+;/]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (tokens.length > 0 && tokens.every((t) => /^[A-Z]$/.test(t))) {
    const valid = tokens.filter((t) => isLetterValid(t, data));
    if (valid.length > 0) {
      return { kind: "create_subset", letters: Array.from(new Set(valid)), force: forceFlag };
    }
  }

  return { kind: "unknown" };
}

function isLetterValid(letter: string, data: MultiRdvBatchData): boolean {
  const idx = ALPHABET.indexOf(letter);
  if (idx < 0 || idx >= data.rdvs.length) return false;
  if (data.removed.includes(letter)) return false;
  if (data.validated.includes(letter)) return false;
  return true;
}

/** Build Paris-tz date heure string (matches main file's helper) */
function buildParisDateHeure(dateStr: string, timeStr: string): string {
  const probe = new Date(`${dateStr}T${timeStr}:00Z`);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "shortOffset",
  });
  const parts = dtf.formatToParts(probe);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const m = tz.match(/GMT([+-]\d+)/);
  const offsetHours = m ? parseInt(m[1], 10) : 1;
  const sign = offsetHours >= 0 ? "+" : "-";
  const abs = Math.abs(offsetHours).toString().padStart(2, "0");
  return `${dateStr}T${timeStr}:00${sign}${abs}:00`;
}

/** Find existing client by phone (normalized French) */
async function findClientByPhone(
  supabase: any,
  userId: string,
  phone: string | null,
): Promise<{ id: string; nom: string; prenom: string | null } | null> {
  if (!phone) return null;
  const normalized = phone.replace(/[^0-9]/g, "");
  if (normalized.length < 9) return null;

  // Try several variants
  const last9 = normalized.slice(-9);
  const candidates = [normalized, `0${last9}`, `+33${last9}`, `33${last9}`];

  const { data } = await supabase
    .from("clients")
    .select("id, nom, prenom, telephone")
    .eq("user_id", userId)
    .not("telephone", "is", null);

  if (!data) return null;
  for (const row of data) {
    const rowNorm = (row.telephone as string).replace(/[^0-9]/g, "");
    if (candidates.some((c) => c === rowNorm) || rowNorm.endsWith(last9)) {
      return { id: row.id, nom: row.nom, prenom: row.prenom };
    }
  }
  return null;
}

/** Get user's available régies */
export async function getUserRegies(
  supabase: any,
  userId: string,
): Promise<Array<{ id: string; nom: string }>> {
  const { data } = await supabase
    .from("regies")
    .select("id, nom")
    .eq("user_id", userId)
    .eq("actif", true)
    .order("nom");
  return (data || []) as Array<{ id: string; nom: string }>;
}

/** Resolve default regie for user (single or main) */
export async function resolveDefaultRegie(
  supabase: any,
  userId: string,
): Promise<{ regieId: string | null; regieName: string | null; needsSelection: boolean; regies: Array<{ id: string; nom: string }> }> {
  const regies = await getUserRegies(supabase, userId);
  if (regies.length === 0) {
    return { regieId: null, regieName: null, needsSelection: false, regies: [] };
  }
  if (regies.length === 1) {
    return { regieId: regies[0].id, regieName: regies[0].nom, needsSelection: false, regies };
  }
  // Try profile.main_regie_id
  const { data: profile } = await supabase
    .from("profiles")
    .select("main_regie_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.main_regie_id) {
    const main = regies.find((r) => r.id === profile.main_regie_id);
    if (main) return { regieId: main.id, regieName: main.nom, needsSelection: false, regies };
  }
  return { regieId: null, regieName: null, needsSelection: true, regies };
}

/** Create one RDV (and client if needed) — returns summary */
export async function createSingleRdvFromExtract(
  supabase: any,
  userId: string,
  rdv: ExtractedRdv,
  regieId: string | null,
  contextNote?: string | null,
): Promise<{ ok: boolean; clientName: string; isNewClient: boolean; rdvId?: string; clientId?: string; error?: string }> {
  const fullName = [rdv.prenom, rdv.nom].filter(Boolean).join(" ").trim();
  if (!rdv.date || (!rdv.nom && !rdv.prenom)) {
    return { ok: false, clientName: fullName || "?", isNewClient: false, error: "Données incomplètes" };
  }

  // Merge any user-provided context note into the RDV / client notes
  const mergedNotes = [rdv.notes, contextNote ? `📝 Note agent: ${contextNote}` : null]
    .filter(Boolean)
    .join("\n") || null;

  // 1) Find or create client
  let clientId: string | null = null;
  let isNewClient = false;
  const existing = await findClientByPhone(supabase, userId, rdv.telephone);
  if (existing) {
    clientId = existing.id;
  } else {
    const { data: newClient, error: clientErr } = await supabase
      .from("clients")
      .insert({
        user_id: userId,
        nom: rdv.nom || "Client",
        prenom: rdv.prenom || null,
        telephone: rdv.telephone || null,
        email: rdv.email || null,
        adresse: rdv.adresse || null,
        code_postal: rdv.code_postal || null,
        ville: rdv.ville || null,
        notes: mergedNotes,
        regie_id: regieId,
        source: "whatsapp_agent_image",
      })
      .select("id")
      .single();
    if (clientErr || !newClient) {
      return { ok: false, clientName: fullName, isNewClient: false, error: clientErr?.message || "Création client échouée" };
    }
    clientId = newClient.id;
    isNewClient = true;
  }

  // 2) Build RDV
  const heure = rdv.heure || "10:00";
  const dateHeure = buildParisDateHeure(rdv.date, heure);
  const adresseFull = [rdv.adresse, rdv.code_postal, rdv.ville].filter(Boolean).join(" ") || null;

  const { data: newRdv, error: rdvErr } = await supabase.from("rdv").insert({
    user_id: userId,
    client_id: clientId,
    date_heure: dateHeure,
    adresse: adresseFull,
    status: "nouveau",
    type_rdv: "standard",
    type_projet: rdv.type_projet || "photovoltaique",
    source: "whatsapp_agent_image",
    regie_id: regieId,
    commentaire: mergedNotes,
  }).select("id").single();

  if (rdvErr) {
    return { ok: false, clientName: fullName, isNewClient, error: rdvErr.message };
  }

  return { ok: true, clientName: fullName, isNewClient, rdvId: newRdv?.id, clientId: clientId || undefined };
}

/** Build régie selection message — includes recap of extracted RDVs + warnings */
export function buildRegieSelectionMessage(
  regies: Array<{ id: string; nom: string }>,
  countOrRdvs: number | ExtractedRdv[],
  warnings?: Array<{ letter: string; kind: "duplicate" | "conflict"; message: string }>,
): string {
  const lines = regies.slice(0, 9).map((r, i) => `${i + 1}️⃣ ${r.nom}`);
  const isArray = Array.isArray(countOrRdvs);
  const count = isArray ? countOrRdvs.length : countOrRdvs;
  const isSingle = count === 1;

  const head = isSingle
    ? `📸 *RDV détecté* dans ta capture`
    : `📸 *${count} RDV détectés* dans tes captures`;

  const recap = isArray
    ? "\n\n" + countOrRdvs.map((r, i) =>
        formatRdvDetailed(isSingle ? null : ALPHABET[i], r),
      ).join("\n\n")
    : "";

  // Group warnings by kind for clarity
  const dupWarnings = (warnings || []).filter((w) => w.kind === "duplicate");
  const conflictWarnings = (warnings || []).filter((w) => w.kind === "conflict");
  const totalWarn = dupWarnings.length + conflictWarnings.length;

  const warnBlock: string[] = [];
  if (totalWarn > 0) {
    warnBlock.push("");
    warnBlock.push("━━━━━━━━━━━━━━━━━━━━");
    warnBlock.push(`⚠️ *${totalWarn} alerte${totalWarn > 1 ? "s" : ""} détectée${totalWarn > 1 ? "s" : ""}*`);
    if (dupWarnings.length) {
      warnBlock.push("");
      warnBlock.push(`🔁 *Doublon${dupWarnings.length > 1 ? "s" : ""} client*`);
      for (const w of dupWarnings) {
        warnBlock.push(isSingle ? `   ${w.message}` : `   *${w.letter}.* ${w.message}`);
      }
    }
    if (conflictWarnings.length) {
      warnBlock.push("");
      warnBlock.push(`⏰ *Conflit${conflictWarnings.length > 1 ? "s" : ""} de créneau*`);
      for (const w of conflictWarnings) {
        warnBlock.push(isSingle ? `   ${w.message}` : `   *${w.letter}.* ${w.message}`);
      }
    }
    warnBlock.push("━━━━━━━━━━━━━━━━━━━━");
    warnBlock.push("_Tu pourras choisir `OUI` / `FORCER` / `NOTE: ...` après avoir indiqué la régie._");
  }

  // Multi-RDV → propose "all same régie" vs "one per RDV"
  if (!isSingle) {
    return [
      head + recap,
      ...warnBlock,
      "",
      "🏢 *Tous ces RDV sont-ils pour la même régie ?*",
      "",
      "• `OUI` → je te demande UNE seule régie pour tous",
      "• `NON` → je te demande la régie pour CHAQUE RDV (A, B, C…)",
      "• `ANNULER` → tout annuler",
    ].join("\n");
  }

  return [
    head + recap,
    ...warnBlock,
    "",
    "Pour quelle *Régie* ?",
    "",
    ...lines,
    "",
    "👆 Réponds avec le *numéro*",
  ].join("\n");
}

/** Build "choose régie for letter X" message (per-RDV mode) */
export function buildRegieSelectionForLetter(
  letter: string,
  rdv: ExtractedRdv,
  regies: Array<{ id: string; nom: string }>,
  alreadyChosen: Record<string, string> = {},
  regieNameById: Record<string, string> = {},
): string {
  const lines = regies.slice(0, 9).map((r, i) => `${i + 1}️⃣ ${r.nom}`);
  const detail = formatRdvDetailed(letter, rdv);
  const progress = Object.keys(alreadyChosen).length;
  const recapPrev = progress > 0
    ? "\n\n_Régies déjà choisies:_\n" +
      Object.entries(alreadyChosen)
        .map(([l, rid]) => `   *${l}.* → ${regieNameById[rid] || rid}`)
        .join("\n")
    : "";
  return [
    `🏢 *Régie pour le RDV ${letter}*`,
    "",
    detail,
    recapPrev,
    "",
    "Choisis la *Régie* :",
    "",
    ...lines,
    "",
    "👆 Réponds avec le *numéro*",
  ].join("\n");
}

/** Build the simple "choose one régie for all" list */
export function buildRegieSelectionUniform(
  regies: Array<{ id: string; nom: string }>,
  count: number,
): string {
  const lines = regies.slice(0, 9).map((r, i) => `${i + 1}️⃣ ${r.nom}`);
  return [
    `🏢 *Une seule régie pour les ${count} RDV*`,
    "",
    "Choisis la *Régie* :",
    "",
    ...lines,
    "",
    "👆 Réponds avec le *numéro*",
  ].join("\n");
}

