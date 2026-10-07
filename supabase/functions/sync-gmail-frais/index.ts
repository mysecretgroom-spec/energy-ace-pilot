// =============================================================
// Import automatique des reçus / factures reçus par email.
//
// Contrairement à la synchro RDV (filtrée par expéditeur autorisé),
// ce scan filtre les emails par MOTS-CLÉS dans le SUJET ou le CONTENU
// (table public.email_frais_filtres).
//
// Chaque pièce jointe (image ou PDF) est lue par ocr-receipt, stockée
// dans le bucket `receipts` puis enregistrée dans `frais`.
// Les messages déjà traités sont mémorisés dans gmail_frais_imports.
// =============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Bornes de sécurité (coût IA + temps d'exécution)
const MAX_MESSAGES_PER_RUN = 15;
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const DEFAULT_DAYS = 14;

const CATEGORIES = [
  "carburant", "peage", "repas", "hotel", "parking", "train", "location_vehicule", "autre",
];

interface ImportDetail {
  messageId: string;
  subject: string;
  status: "imported" | "skipped" | "error";
  montant?: number | null;
  error?: string;
}

function escapeGmailTerm(term: string): string {
  return term.replace(/["\\]/g, " ").trim();
}

/** Construit la requête Gmail à partir des mots-clés sujet / contenu. */
function buildGmailQuery(
  filtres: Array<{ terme: string; champ: string }>,
  days: number,
): string | null {
  const clauses: string[] = [];
  for (const f of filtres) {
    const term = escapeGmailTerm(f.terme);
    if (!term) continue;
    if (f.champ === "sujet") clauses.push(`subject:"${term}"`);
    else if (f.champ === "contenu") clauses.push(`"${term}"`);
    else clauses.push(`(subject:"${term}" OR "${term}")`);
  }
  if (!clauses.length) return null;
  return `has:attachment newer_than:${days}d (${clauses.join(" OR ")})`;
}

function base64UrlToBase64(data: string): string {
  return data.replace(/-/g, "+").replace(/_/g, "/");
}

interface FoundAttachment {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

function collectAttachments(part: any, acc: FoundAttachment[]) {
  if (!part) return;
  const mime = (part.mimeType || "").toLowerCase();
  const body = part.body || {};
  if (body.attachmentId && (mime.startsWith("image/") || mime === "application/pdf")) {
    acc.push({
      attachmentId: body.attachmentId,
      filename: part.filename || "justificatif",
      mimeType: mime,
      size: body.size || 0,
    });
  }
  for (const child of part.parts || []) collectAttachments(child, acc);
}

function getHeader(payload: any, name: string): string {
  const h = (payload?.headers || []).find(
    (x: any) => (x.name || "").toLowerCase() === name.toLowerCase(),
  );
  return h?.value || "";
}

const MIN_IMAGE_BYTES = 20 * 1024; // en dessous : logos / icônes d'email
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface Reading {
  montant_ttc: number | null;
  commercant?: string | null;
  categorie?: string | null;
  date?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  description?: string | null;
  reference?: string | null;
  annulation?: boolean;
  [k: string]: unknown;
}

function decodePart(data: string): string {
  try {
    const bin = atob(base64UrlToBase64(data));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch { return ""; }
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&euro;/g, "€").replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** Texte lisible de l'email (HTML prioritaire s'il est plus complet). */
function extractEmailText(payload: any): string {
  let plain = "", html = "";
  const walk = (p: any) => {
    if (!p) return;
    const mime = (p.mimeType || "").toLowerCase();
    if (p.body?.data && !p.filename) {
      if (mime === "text/plain") plain += decodePart(p.body.data) + "\n";
      else if (mime === "text/html") html += decodePart(p.body.data) + "\n";
    }
    for (const c of p.parts || []) walk(c);
  };
  walk(payload);
  const htmlText = html ? htmlToText(html) : "";
  const text = htmlText.length > plain.length * 1.2 ? htmlText : plain;
  return text.slice(0, 15000);
}

function buildEmailHtml(subject: string, sender: string, date: Date, text: string): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(subject)}</title></head>` +
    `<body style="font-family:sans-serif;max-width:720px;margin:auto;white-space:pre-wrap">` +
    `<p><b>De :</b> ${esc(sender)}<br><b>Date :</b> ${date.toISOString()}<br><b>Sujet :</b> ${esc(subject)}</p><hr>${esc(text)}</body></html>`;
}

/** Lecture du corps de l'email (confirmation Booking, reçu en ligne…). */
async function readEmailBody(subject: string, sender: string, text: string): Promise<Reading | null> {
  if (!LOVABLE_API_KEY) return null;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-lite",
      messages: [
        {
          role: "system",
          content:
            "Tu lis un email de confirmation, reçu ou facture et tu en extrais la dépense. " +
            "Le montant est le prix TOTAL TTC payé ou à payer (pas un prix par nuit, pas une taxe seule). " +
            "Pour un hôtel (Booking, Hotels.com…) : categorie=hotel, date_debut=arrivée, date_fin=départ, commercant=nom de l'établissement, reference=numéro de réservation. " +
            "Si l'email est une annulation, annulation=true. Si aucune dépense n'est identifiable, montant_ttc=null. Dates au format YYYY-MM-DD.",
        },
        { role: "user", content: `De : ${sender}\nSujet : ${subject}\n\n${text}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "depense",
          parameters: {
            type: "object",
            properties: {
              montant_ttc: { type: ["number", "null"] },
              commercant: { type: ["string", "null"] },
              categorie: { type: "string", enum: CATEGORIES },
              date: { type: ["string", "null"] },
              date_debut: { type: ["string", "null"] },
              date_fin: { type: ["string", "null"] },
              reference: { type: ["string", "null"] },
              description: { type: ["string", "null"] },
              annulation: { type: "boolean" },
            },
            required: ["montant_ttc", "categorie", "annulation"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "depense" } },
    }),
  });
  if (!res.ok) {
    console.error("[frais-sync] lecture email:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  try { return args ? JSON.parse(args) : null; } catch { return null; }
}

/** Frais déjà enregistré correspondant (même séjour ou même dépense). */
async function findExisting(
  supabase: any,
  userId: string,
  p: { categorie: string; dateFrais: string; dateDebut: string | null; montant: number; fournisseur: string },
): Promise<{ id: string; justificatif_url: string | null; ocr_data: any } | null> {
  const lo = Math.round((p.montant - 0.02) * 100) / 100;
  const hi = Math.round((p.montant + 0.02) * 100) / 100;
  const sel = "id, justificatif_url, ocr_data";
  if (p.categorie === "hotel" && p.dateDebut) {
    // Même séjour : même date d'arrivée + même établissement OU même montant
    const { data } = await supabase.from("frais").select(sel + ", fournisseur, montant")
      .eq("user_id", userId).eq("categorie", "hotel").eq("date_debut", p.dateDebut).limit(10);
    const key = p.fournisseur.toLowerCase().slice(0, 12);
    const hit = (data || []).find((r: any) =>
      (Number(r.montant) >= lo && Number(r.montant) <= hi) ||
      (key && (r.fournisseur || "").toLowerCase().includes(key)));
    if (hit) return hit;
  }
  let q = supabase.from("frais").select(sel).eq("user_id", userId)
    .eq("date_frais", p.dateFrais).gte("montant", lo).lte("montant", hi);
  if (p.fournisseur) q = q.ilike("fournisseur", `%${p.fournisseur.slice(0, 60)}%`);
  const { data } = await q.limit(1);
  return data?.[0] || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth : JWT utilisateur (bouton manuel) ou service role + x-user-id (cron)
    const authHeader = req.headers.get("authorization");
    const serviceCall =
      !!authHeader && authHeader.replace("Bearer ", "").trim() === SUPABASE_SERVICE_ROLE_KEY;
    let userId: string | null = null;
    if (serviceCall) {
      userId = req.headers.get("x-user-id");
    } else {
      userId = await getUserIdFromAuth(authHeader);
    }
    if (!userId) return json({ error: "Non autorisé" }, 401);

    let body: any = {};
    try {
      body = await req.json();
    } catch { /* body optionnel */ }
    const days = Math.min(Math.max(Number(body?.days) || DEFAULT_DAYS, 1), 90);

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return json({ error: "Compte Google non connecté", code: "GOOGLE_NOT_CONNECTED" }, 400);
    }

    const { data: filtres } = await supabase
      .from("email_frais_filtres")
      .select("terme, champ")
      .eq("user_id", userId)
      .eq("actif", true);

    const query = buildGmailQuery(filtres || [], days);
    if (!query) {
      return json({ error: "Aucun mot-clé configuré", code: "NO_FILTERS" }, 400);
    }
    console.log(`[frais-sync] user=${userId} query=${query}`);

    const listRes = await fetch(
      `${GMAIL_API_BASE}/users/me/messages?maxResults=${MAX_MESSAGES_PER_RUN}&q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!listRes.ok) {
      const txt = await listRes.text();
      console.error("[frais-sync] Gmail list failed:", listRes.status, txt);
      return json({ error: "Lecture Gmail impossible", details: txt }, listRes.status);
    }
    const listData = await listRes.json();
    const messages: Array<{ id: string }> = listData.messages || [];

    if (!messages.length) {
      return json({ imported: 0, skipped: 0, errors: 0, details: [], message: "Aucun email correspondant" });
    }

    // Messages déjà traités
    const { data: already } = await supabase
      .from("gmail_frais_imports")
      .select("gmail_message_id, attachment_key")
      .eq("user_id", userId)
      .in("gmail_message_id", messages.map((m) => m.id));
    const seen = new Set((already || []).map((r) => `${r.gmail_message_id}|${r.attachment_key}`));

    const details: ImportDetail[] = [];
    let imported = 0, skipped = 0, errors = 0, attached = 0;

    const markMessage = (msgId: string, statut: string, extra: Record<string, unknown>) =>
      supabase.from("gmail_frais_imports").upsert(
        { user_id: userId, gmail_message_id: msgId, attachment_key: "", statut, ...extra },
        { onConflict: "user_id,gmail_message_id,attachment_key", ignoreDuplicates: true },
      );

    for (const msg of messages) {
      if (seen.has(`${msg.id}|`)) { skipped++; continue; }

      let subject = "", sender = "";
      try {
        const msgRes = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!msgRes.ok) throw new Error(`Gmail message ${msgRes.status}`);
        const msgData = await msgRes.json();

        subject = getHeader(msgData.payload, "Subject");
        sender = getHeader(msgData.payload, "From");
        const internalDate = msgData.internalDate
          ? new Date(Number(msgData.internalDate))
          : new Date();
        const emailText = extractEmailText(msgData.payload);

        // 1) Pièces jointes réelles (on ignore logos / icônes)
        const attachments: FoundAttachment[] = [];
        collectAttachments(msgData.payload, attachments);
        const realAttachments = attachments.filter(
          (a) => a.mimeType === "application/pdf" || a.size >= MIN_IMAGE_BYTES,
        );

        let reading: Reading | null = null;
        let fileBytes: Uint8Array | null = null;
        let fileMime = "";
        let fromAttachment = false;

        for (const att of realAttachments) {
          if (att.size > MAX_ATTACHMENT_BYTES) continue;
          const attRes = await fetch(
            `${GMAIL_API_BASE}/users/me/messages/${msg.id}/attachments/${att.attachmentId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!attRes.ok) continue;
          const attData = await attRes.json();
          const b64 = base64UrlToBase64(attData.data || "");
          if (!b64) continue;
          const ocrRes = await fetch(`${SUPABASE_URL}/functions/v1/ocr-receipt`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ image_base64: `data:${att.mimeType};base64,${b64}` }),
          });
          const ocr = await ocrRes.json().catch(() => null);
          if (ocrRes.ok && ocr && typeof ocr.montant_ttc === "number" && ocr.montant_ttc > 0) {
            reading = ocr;
            fileBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
            fileMime = att.mimeType;
            fromAttachment = true;
            break;
          }
        }

        // 2) Sinon : le contenu de l'email fait office de reçu (ex. Booking)
        if (!reading && emailText.length > 40) {
          const r = await readEmailBody(subject, sender, emailText);
          if (r?.annulation) {
            await markMessage(msg.id, "ignore", { sujet: subject, expediteur: sender, erreur: "Annulation" });
            skipped++;
            details.push({ messageId: msg.id, subject, status: "skipped", error: "Annulation" });
            continue;
          }
          if (r && typeof r.montant_ttc === "number" && r.montant_ttc > 0) {
            reading = r;
            fileBytes = new TextEncoder().encode(buildEmailHtml(subject, sender, internalDate, emailText));
            fileMime = "text/html";
          }
        }

        if (!reading || !fileBytes) {
          await markMessage(msg.id, "erreur", {
            sujet: subject, expediteur: sender, erreur: "Aucun montant trouvé",
          });
          errors++;
          details.push({ messageId: msg.id, subject, status: "error", error: "Aucun montant trouvé" });
          continue;
        }

        const categorie = CATEGORIES.includes(reading.categorie || "") ? reading.categorie! : "autre";
        const today = new Date().toISOString().slice(0, 10);
        const validDate = (d?: string | null) =>
          d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(new Date(d).getTime()) ? d : null;
        const dateDebut = validDate(reading.date_debut);
        const dateFin = validDate(reading.date_fin);
        const isStay = categorie === "hotel" || categorie === "location_vehicule";
        let dateFrais = (isStay && dateDebut) || validDate(reading.date) || internalDate.toISOString().slice(0, 10);
        if (dateFrais > today) dateFrais = today;
        const montant = Math.round(reading.montant_ttc! * 100) / 100;
        const fournisseur = (reading.commercant || "").trim();

        // Anti-doublon / rattachement
        const existing = await findExisting(supabase, userId, {
          categorie, dateFrais, dateDebut, montant, fournisseur,
        });

        const upload = async () => {
          const ext = fileMime === "application/pdf" ? "pdf" : fileMime === "text/html" ? "html" : "jpg";
          const path = `${userId}/frais/${Date.now()}-${msg.id.slice(0, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("receipts")
            .upload(path, fileBytes!, { contentType: fileMime, upsert: false });
          if (upErr) throw new Error(`Stockage: ${upErr.message}`);
          return supabase.storage.from("receipts").getPublicUrl(path).data.publicUrl;
        };

        if (existing) {
          // Un vrai justificatif (PDF/photo) remplace le reçu email provisoire
          const existingIsEmail = existing.ocr_data?.source_type === "email_body" || !existing.justificatif_url;
          if (fromAttachment && existingIsEmail) {
            const url = await upload();
            await supabase.from("frais").update({
              justificatif_url: url,
              ocr_data: { ...(existing.ocr_data || {}), ...reading, source: "gmail", source_type: "attachment",
                gmail_message_id: msg.id, email_receipt_url: existing.justificatif_url },
            }).eq("id", existing.id);
            await markMessage(msg.id, "importe", { sujet: subject, expediteur: sender, frais_id: existing.id, erreur: "Justificatif rattaché" });
            attached++;
            details.push({ messageId: msg.id, subject, status: "imported", montant });
          } else {
            await markMessage(msg.id, "ignore", { sujet: subject, expediteur: sender, frais_id: existing.id, erreur: "Doublon détecté" });
            skipped++;
            details.push({ messageId: msg.id, subject, status: "skipped", error: "Doublon" });
          }
          continue;
        }

        const url = await upload();
        const insertData: Record<string, unknown> = {
          user_id: userId,
          montant,
          date_frais: dateFrais,
          categorie,
          description: [fournisseur, reading.description].filter(Boolean).join(" - ") || subject || null,
          fournisseur: fournisseur || null,
          justificatif_url: url,
          ocr_data: {
            ...reading, source: "gmail", source_type: fromAttachment ? "attachment" : "email_body",
            gmail_message_id: msg.id, sujet: subject,
          },
        };
        if (isStay) {
          if (dateDebut) insertData.date_debut = dateDebut;
          if (dateFin) insertData.date_fin = dateFin;
        }

        const { data: fraisRow, error: fraisErr } = await supabase
          .from("frais").insert(insertData).select("id").single();
        if (fraisErr) throw new Error(`Enregistrement: ${fraisErr.message}`);

        await markMessage(msg.id, "importe", { sujet: subject, expediteur: sender, frais_id: fraisRow.id });
        imported++;
        details.push({ messageId: msg.id, subject, status: "imported", montant });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        console.error(`[frais-sync] message ${msg.id}:`, message);
        errors++;
        details.push({ messageId: msg.id, subject, status: "error", error: message });
      }
    }

    console.log(`[frais-sync] user=${userId} imported=${imported} attached=${attached} skipped=${skipped} errors=${errors}`);
    return json({ imported, attached, skipped, errors, details });
  } catch (error) {
    console.error("[frais-sync] fatal:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, 500);
  }
});
