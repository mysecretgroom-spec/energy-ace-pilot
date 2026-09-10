// Contexte de paramétrage métier de l'utilisateur pour l'agent WhatsApp.
// Objectif : l'agent doit connaître les régies, gammes, bouquets/prix, surcoûts,
// financements, règles de commission personnalisées et aides configurées par
// l'utilisateur — sinon il répond à côté sur tout ce qui touche à l'argent.

// deno-lint-ignore-file no-explicit-any

const CONFIG_CACHE = new Map<string, { value: string; expires: number }>();
const CONFIG_TTL_MS = 5 * 60 * 1000;

function euro(n: unknown): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "-";
  return `${Math.round(v).toLocaleString("fr-FR")}€`;
}

function safe(rows: any): any[] {
  return Array.isArray(rows) ? rows : [];
}

/**
 * Résumé compact (texte) du paramétrage métier de l'utilisateur.
 * Volontairement borné en taille pour ne pas exploser le prompt.
 */
export async function loadUserConfigContext(
  supabase: any,
  userId: string,
): Promise<string> {
  const cached = CONFIG_CACHE.get(userId);
  if (cached && cached.expires > Date.now()) return cached.value;

  try {
    const [regies, gammes, bouquets, surcouts, financements, rules, aidesPv, aidesPac, aidesIte] =
      await Promise.all([
        supabase.from("regies").select("id, nom, mode_calcul_commission, part_survente_pct, is_hejja, products_offered")
          .eq("user_id", userId).eq("actif", true).limit(30),
        supabase.from("regies_gammes").select("regie_id, product_type, nom")
          .eq("user_id", userId).eq("actif", true).limit(60),
        supabase.from("bouquets").select("regie_ids, product_type, gamme, nom_bouquet, puissance_kwc, prix_recommande, prix_max, commission_fixe, commission_pct")
          .eq("user_id", userId).eq("actif", true).order("puissance_kwc", { ascending: true }).limit(80),
        supabase.from("regies_surcouts").select("regie_id, categorie, nom, prix, type_calcul")
          .eq("user_id", userId).eq("actif", true).limit(60),
        supabase.from("regies_financements").select("regie_id, nom, taux_effectif, taeg, duree_mois")
          .eq("user_id", userId).eq("actif", true).limit(40),
        supabase.from("commission_rules").select("regie_id, product_type, gamme, nom, effet, base, mode_valeur, valeur, part_appliquee_pct, condition_min, condition_max, schema_nom")
          .eq("user_id", userId).eq("actif", true).eq("statut", "actif").order("ordre", { ascending: true }).limit(40),
        supabase.from("data_aides").select("code, nom, type_calcul, valeur, puissance_min, puissance_max")
          .eq("actif", true).or(`user_id.eq.${userId},user_id.is.null`).limit(30),
        supabase.from("data_aides_pac").select("code, nom, type_aide, profil_revenus, montant_fixe, montant_plafond")
          .eq("actif", true).or(`user_id.eq.${userId},user_id.is.null`).limit(30),
        supabase.from("data_aides_ite").select("code, nom, type_aide, profil_revenus, montant_m2, montant_plafond")
          .eq("actif", true).or(`user_id.eq.${userId},user_id.is.null`).limit(30),
      ]);

    const regieRows = safe(regies?.data);
    const regieName = (id: string | null) =>
      regieRows.find((r) => r.id === id)?.nom || "toutes régies";

    const parts: string[] = [];

    if (regieRows.length) {
      parts.push(
        "🏢 RÉGIES:\n" +
          regieRows.map((r) =>
            `• ${r.nom}${r.is_hejja ? " (hejja)" : ""} — commission: ${r.mode_calcul_commission || "n/c"}${
              r.part_survente_pct != null ? `, part survente ${r.part_survente_pct}%` : ""
            }`
          ).join("\n"),
      );
    }

    const gammeRows = safe(gammes?.data);
    if (gammeRows.length) {
      parts.push(
        "🎚️ GAMMES:\n" +
          gammeRows.map((g) => `• ${regieName(g.regie_id)} / ${g.product_type}: ${g.nom}`).join("\n"),
      );
    }

    const bouquetRows = safe(bouquets?.data);
    if (bouquetRows.length) {
      parts.push(
        "💰 GRILLES DE PRIX (bouquets):\n" +
          bouquetRows.map((b) =>
            `• ${b.product_type}${b.gamme ? `/${b.gamme}` : ""} ${b.puissance_kwc ?? "?"}kWc — prix conseillé ${euro(b.prix_recommande)}${
              b.prix_max ? `, max ${euro(b.prix_max)}` : ""
            }${b.commission_fixe ? `, com ${euro(b.commission_fixe)}` : ""}${
              b.commission_pct ? `, com ${b.commission_pct}%` : ""
            }`
          ).join("\n"),
      );
    }

    const surcoutRows = safe(surcouts?.data);
    if (surcoutRows.length) {
      parts.push(
        "🧱 SURCOÛTS:\n" +
          surcoutRows.map((s) =>
            `• ${regieName(s.regie_id)} — ${s.nom} (${s.categorie}): ${euro(s.prix)}${
              s.type_calcul && s.type_calcul !== "fixe" ? ` [${s.type_calcul}]` : ""
            }`
          ).join("\n"),
      );
    }

    const finRows = safe(financements?.data);
    if (finRows.length) {
      parts.push(
        "🏦 FINANCEMENTS:\n" +
          finRows.map((f) =>
            `• ${regieName(f.regie_id)} — ${f.nom}: ${f.duree_mois ?? "?"} mois, TAEG ${f.taeg ?? "?"}%`
          ).join("\n"),
      );
    }

    const ruleRows = safe(rules?.data);
    if (ruleRows.length) {
      parts.push(
        "📐 RÈGLES DE COMMISSION PERSONNALISÉES (actives, prioritaires sur le calcul historique):\n" +
          ruleRows.map((r) =>
            `• ${r.nom}${r.schema_nom ? ` [${r.schema_nom}]` : ""} — ${regieName(r.regie_id)}${
              r.product_type ? `/${r.product_type}` : ""
            }${r.gamme ? `/${r.gamme}` : ""}: ${r.effet} ${
              r.mode_valeur === "pourcentage" ? `${r.valeur}% de ${r.base}` : euro(r.valeur)
            }${r.part_appliquee_pct != null && r.part_appliquee_pct !== 100 ? ` (part ${r.part_appliquee_pct}%)` : ""}${
              r.condition_min != null || r.condition_max != null
                ? ` [${r.condition_min ?? "-"} → ${r.condition_max ?? "-"}]`
                : ""
            }`
          ).join("\n"),
      );
    }

    const aidesLines: string[] = [];
    for (const a of safe(aidesPv?.data)) {
      aidesLines.push(
        `• PV ${a.nom} (${a.code}): ${a.type_calcul} ${a.valeur}${
          a.puissance_min != null ? ` de ${a.puissance_min} à ${a.puissance_max ?? "?"}kWc` : ""
        }`,
      );
    }
    for (const a of safe(aidesPac?.data)) {
      aidesLines.push(`• PAC ${a.nom} (${a.code}): ${a.type_aide} ${euro(a.montant_fixe)}${a.profil_revenus ? `, profil ${a.profil_revenus}` : ""}`);
    }
    for (const a of safe(aidesIte?.data)) {
      aidesLines.push(`• ITE ${a.nom} (${a.code}): ${a.type_aide} ${a.montant_m2 ?? "?"}€/m²${a.montant_plafond ? `, plafond ${euro(a.montant_plafond)}` : ""}`);
    }
    if (aidesLines.length) parts.push("🎁 AIDES CONFIGURÉES:\n" + aidesLines.join("\n"));

    if (!parts.length) return "";

    let text = "\n\n⚙️ PARAMÉTRAGE MÉTIER DE L'UTILISATEUR (source de vérité — utilise-le pour répondre sur prix, gammes, aides et commissions):\n" +
      parts.join("\n\n");

    // Borne de sécurité pour le prompt
    if (text.length > 9000) text = text.slice(0, 9000) + "\n…(paramétrage tronqué)";

    CONFIG_CACHE.set(userId, { value: text, expires: Date.now() + CONFIG_TTL_MS });
    return text;
  } catch (e) {
    console.error("[configContext] load failed (non-blocking):", e);
    return "";
  }
}

export function invalidateUserConfigContext(userId: string): void {
  CONFIG_CACHE.delete(userId);
}
