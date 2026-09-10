// Mémoire court terme inter-sessions : un résumé roulant de ce sur quoi
// l'utilisateur et l'agent travaillent, conservé même si la conversation
// est reprise des heures plus tard.

// deno-lint-ignore no-explicit-any
type Db = any;

export interface SessionMemory {
  resume: string;
  sujets_ouverts: string[];
  derniere_intent: string | null;
  updated_at: string | null;
}

const MAX_RESUME_CHARS = 1200;
const STALE_HOURS = 72;

export async function loadSessionMemory(db: Db, userId: string): Promise<SessionMemory | null> {
  try {
    const { data, error } = await db
      .from("agent_session_memory")
      .select("resume, sujets_ouverts, derniere_intent, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return {
      resume: data.resume || "",
      sujets_ouverts: Array.isArray(data.sujets_ouverts) ? data.sujets_ouverts : [],
      derniere_intent: data.derniere_intent || null,
      updated_at: data.updated_at || null,
    };
  } catch {
    return null;
  }
}

export function formatSessionMemoryForPrompt(mem: SessionMemory | null): string {
  if (!mem || (!mem.resume && !mem.sujets_ouverts.length)) return "";
  const age = mem.updated_at ? (Date.now() - Date.parse(mem.updated_at)) / 3_600_000 : 0;
  if (age > STALE_HOURS) return "";
  const quand = age < 1 ? "il y a moins d'une heure" : age < 24 ? `il y a ${Math.round(age)}h` : "hier ou avant";
  let out = `\n\n🧵 OÙ ON EN ÉTAIT (${quand}):\n${mem.resume}`;
  if (mem.sujets_ouverts.length) {
    out += `\nEn suspens: ${mem.sujets_ouverts.slice(0, 5).join(" · ")}`;
  }
  out += "\nReprends naturellement le fil si le message y fait référence, sans tout re-demander.";
  return out;
}

/** Met à jour le résumé roulant après chaque échange. */
export async function updateSessionMemory(
  db: Db,
  userId: string,
  params: {
    previous: SessionMemory | null;
    userMessage: string;
    agentMessage: string;
    intent: string;
    pendingLabel?: string | null;
  },
): Promise<void> {
  try {
    const line = `• ${new Date().toISOString().slice(0, 16).replace("T", " ")} — ${params.intent}: ${
      (params.userMessage || "").replace(/\s+/g, " ").slice(0, 140)
    } → ${(params.agentMessage || "").replace(/\s+/g, " ").slice(0, 140)}`;

    const previousLines = (params.previous?.resume || "")
      .split("\n")
      .filter((l) => l.trim().startsWith("•"));
    const lines = [...previousLines, line].slice(-6);
    let resume = lines.join("\n");
    if (resume.length > MAX_RESUME_CHARS) resume = resume.slice(-MAX_RESUME_CHARS);

    const sujets = new Set<string>(params.previous?.sujets_ouverts || []);
    if (params.pendingLabel) sujets.add(params.pendingLabel);
    else sujets.clear(); // plus rien en attente → on repart propre

    const { error } = await db.from("agent_session_memory").upsert(
      {
        user_id: userId,
        resume,
        sujets_ouverts: Array.from(sujets).slice(0, 5),
        derniere_intent: params.intent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) console.error("[session-memory] upsert failed:", error.message);
  } catch (err) {
    console.error("[session-memory] update error:", err);
  }
}
