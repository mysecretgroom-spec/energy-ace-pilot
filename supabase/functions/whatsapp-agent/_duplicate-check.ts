// =============================================================
// Duplicate / conflict detection for incoming RDV batches
// - Same client active RDV (excludes annule/reporte/r2/r2_prestudy)
// - Time slot conflict (±30 min) with any other RDV
// =============================================================

// deno-lint-ignore-file no-explicit-any

import type { ExtractedRdv } from "./_multi-rdv.ts";

export interface RdvWarning {
  /** Letter index inside the batch (A,B,C…) */
  letter: string;
  /** "duplicate" = same client already has an active RDV; "conflict" = slot ±30min overlap */
  kind: "duplicate" | "conflict";
  /** Short human-readable message (one line) */
  message: string;
}

/** Normalize a French phone number to last 9 digits (drops country / formatting). */
function last9(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/** Statuses that should NOT block a new RDV for the same client. */
const NON_BLOCKING_STATUSES = new Set(["annule", "reporte", "r2", "r2_prestudy"]);

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

function fmtFrenchDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}`;
}

function fmtFrenchTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * Analyze a batch of extracted RDVs and return warnings (duplicates + conflicts).
 * - Duplicate: client already has an active RDV (any future or past — we focus on "still open")
 * - Conflict: another RDV exists within ±30 min of the proposed datetime
 */
export async function analyzeBatchWarnings(
  supabase: any,
  userId: string,
  rdvs: ExtractedRdv[],
): Promise<RdvWarning[]> {
  if (!rdvs.length) return [];

  const warnings: RdvWarning[] = [];

  // ---- Pre-load all user clients with phone (for fuzzy phone match) ----
  const { data: allClients } = await supabase
    .from("clients")
    .select("id, nom, prenom, telephone")
    .eq("user_id", userId);

  const clientByPhone = new Map<string, { id: string; nom: string; prenom: string | null }>();
  if (Array.isArray(allClients)) {
    for (const c of allClients) {
      const tail = last9(c.telephone);
      if (tail) clientByPhone.set(tail, { id: c.id, nom: c.nom, prenom: c.prenom });
    }
  }

  // Build a quick name index too (lowercase "prenom nom" / "nom")
  const clientByName = new Map<string, { id: string; nom: string; prenom: string | null }>();
  if (Array.isArray(allClients)) {
    for (const c of allClients) {
      const full = [c.prenom, c.nom].filter(Boolean).join(" ").trim().toLowerCase();
      if (full) clientByName.set(full, { id: c.id, nom: c.nom, prenom: c.prenom });
      const last = String(c.nom || "").trim().toLowerCase();
      if (last && !clientByName.has(last)) clientByName.set(last, { id: c.id, nom: c.nom, prenom: c.prenom });
    }
  }

  // Collect ISO datetimes for slot conflict check (only those with date+heure)
  const proposedSlots: Array<{ idx: number; isoUtc: number }> = [];

  for (let i = 0; i < rdvs.length; i++) {
    const r = rdvs[i];
    const letter = ALPHA[i] ?? `#${i + 1}`;

    // --- 1. Same-client duplicate ---
    let matchedClient: { id: string; nom: string; prenom: string | null } | null = null;
    const tail = last9(r.telephone);
    if (tail && clientByPhone.has(tail)) matchedClient = clientByPhone.get(tail)!;
    if (!matchedClient) {
      const full = [r.prenom, r.nom].filter(Boolean).join(" ").trim().toLowerCase();
      if (full && clientByName.has(full)) matchedClient = clientByName.get(full)!;
      else {
        const last = String(r.nom || "").trim().toLowerCase();
        if (last && clientByName.has(last)) matchedClient = clientByName.get(last)!;
      }
    }

    if (matchedClient) {
      // Look for any active RDV on this client
      const { data: existingRdvs } = await supabase
        .from("rdv")
        .select("id, date_heure, status")
        .eq("user_id", userId)
        .eq("client_id", matchedClient.id)
        .order("date_heure", { ascending: false })
        .limit(20);

      const blocking = (existingRdvs || []).filter(
        (x: any) => !NON_BLOCKING_STATUSES.has(String(x.status)),
      );

      if (blocking.length > 0) {
        const last = blocking[0];
        const dateLabel = last.date_heure ? fmtFrenchDate(last.date_heure) : "?";
        const timeLabel = last.date_heure ? fmtFrenchTime(last.date_heure) : "";
        const fullName = [matchedClient.prenom, matchedClient.nom].filter(Boolean).join(" ").trim();
        warnings.push({
          letter,
          kind: "duplicate",
          message: `⚠️ *${letter}* ${fullName} a déjà un RDV actif (${dateLabel} ${timeLabel}, _${last.status}_).`,
        });
      }
    }

    // --- 2. Slot conflict (±30 min) ---
    if (r.date && r.heure) {
      try {
        const iso = buildParisDateHeure(r.date, r.heure);
        const t = new Date(iso).getTime();
        if (!isNaN(t)) proposedSlots.push({ idx: i, isoUtc: t });
      } catch {
        // skip
      }
    }
  }

  // Bulk fetch existing RDVs in the date window for slot conflicts
  if (proposedSlots.length > 0) {
    const minT = Math.min(...proposedSlots.map((s) => s.isoUtc)) - 31 * 60 * 1000;
    const maxT = Math.max(...proposedSlots.map((s) => s.isoUtc)) + 31 * 60 * 1000;
    const fromIso = new Date(minT).toISOString();
    const toIso = new Date(maxT).toISOString();

    const { data: nearbyRdvs } = await supabase
      .from("rdv")
      .select("id, date_heure, status, client_id, clients(nom, prenom)")
      .eq("user_id", userId)
      .gte("date_heure", fromIso)
      .lte("date_heure", toIso)
      .not("status", "in", "(annule,reporte)");

    const nearbyTimes: Array<{ t: number; label: string }> = [];
    if (Array.isArray(nearbyRdvs)) {
      for (const n of nearbyRdvs) {
        const t = new Date(n.date_heure).getTime();
        if (isNaN(t)) continue;
        const fullName = [n.clients?.prenom, n.clients?.nom].filter(Boolean).join(" ").trim() || "RDV";
        nearbyTimes.push({ t, label: `${fullName} à ${fmtFrenchTime(n.date_heure)}` });
      }
    }

    for (const slot of proposedSlots) {
      const conflicts = nearbyTimes.filter(
        (n) => Math.abs(n.t - slot.isoUtc) <= 30 * 60 * 1000,
      );
      if (conflicts.length > 0) {
        const letter = ALPHA[slot.idx] ?? `#${slot.idx + 1}`;
        const r = rdvs[slot.idx];
        warnings.push({
          letter,
          kind: "conflict",
          message: `⏰ *${letter}* créneau ${r.heure} trop proche de: ${conflicts.map((c) => c.label).join(", ")}.`,
        });
      }
    }
  }

  return warnings;
}

/** Format warnings as a compact section to inject into the menu. Empty string if none. */
export function formatWarningsBlock(warnings: RdvWarning[]): string {
  if (!warnings.length) return "";
  const lines = warnings.map((w) => `• ${w.message}`);
  return `\n\n⚠️ *Vérifications:*\n${lines.join("\n")}`;
}
