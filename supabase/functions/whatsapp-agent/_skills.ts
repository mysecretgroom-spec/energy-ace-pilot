// Savoir-faire (skills) de l'agent : procédures réutilisables, globales ou propres
// à un utilisateur, injectées dans le prompt quand elles correspondent au message.

// deno-lint-ignore no-explicit-any
type Db = any;

export interface AgentSkill {
  id: string;
  nom: string;
  description: string | null;
  triggers: string[];
  intents: string[];
  procedure: string;
  exemples: unknown;
  priorite: number;
}

const skillCache = new Map<string, { skills: AgentSkill[]; expiresAt: number }>();
const SKILLS_TTL_MS = 5 * 60 * 1000;

export function invalidateSkillsCache(userId: string) {
  skillCache.delete(userId);
}

export async function loadAgentSkills(db: Db, userId: string): Promise<AgentSkill[]> {
  const cached = skillCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.skills;
  try {
    const { data, error } = await db
      .from("agent_skills")
      .select("id, nom, description, triggers, intents, procedure, exemples, priorite")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq("actif", true)
      .order("priorite", { ascending: true })
      .limit(60);
    if (error) {
      console.error("[skills] load failed:", error.message);
      return [];
    }
    const skills = (data || []) as AgentSkill[];
    skillCache.set(userId, { skills, expiresAt: Date.now() + SKILLS_TTL_MS });
    return skills;
  } catch (err) {
    console.error("[skills] load error:", err);
    return [];
  }
}

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Sélectionne les savoir-faire pertinents pour ce message (max 3). */
export function selectSkills(skills: AgentSkill[], message: string, hintIntent?: string): AgentSkill[] {
  if (!skills.length) return [];
  const text = normalize(message);
  const scored = skills.map((s) => {
    let score = 0;
    for (const t of s.triggers || []) {
      if (t && text.includes(normalize(t))) score += 2;
    }
    if (hintIntent && (s.intents || []).includes(hintIntent)) score += 3;
    return { skill: s, score };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.skill.priorite - b.skill.priorite)
    .slice(0, 3)
    .map((x) => x.skill);
}

export function formatSkillsForPrompt(skills: AgentSkill[]): string {
  if (!skills.length) return "";
  const blocks = skills
    .map((s) => `▸ ${s.nom}${s.description ? ` — ${s.description}` : ""}\n${s.procedure}`)
    .join("\n\n");
  return `\n\n🛠️ SAVOIR-FAIRE APPLICABLES (procédures éprouvées, suis-les):\n${blocks}\n`;
}

export async function bumpSkillUsage(db: Db, skillIds: string[]): Promise<void> {
  if (!skillIds.length) return;
  try {
    for (const id of skillIds) {
      const { data } = await db.from("agent_skills").select("usage_count").eq("id", id).maybeSingle();
      await db
        .from("agent_skills")
        .update({ usage_count: (data?.usage_count || 0) + 1 })
        .eq("id", id);
    }
  } catch (err) {
    console.error("[skills] usage bump failed:", err);
  }
}
