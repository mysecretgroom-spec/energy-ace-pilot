/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MOTEUR DE RÈGLES DE COMMISSION MODULABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le calcul historique (bouquet / pourcentage / pose externe) reste la BASE.
 * Les règles personnalisées viennent ensuite s'appliquer par-dessus :
 *
 *   commission = base
 *              + Σ (bonus)
 *              - Σ (déductions)
 *   (une règle "remplace_base" écrase la commission de base avant le reste)
 *
 * Chaque règle est définie par :
 *  - une portée   : régie (regie_id) + produit + gamme, ou globale (utilisateur)
 *  - un effet     : deduction | bonus | remplace_base
 *  - une base     : sur quoi porte le calcul (montant HT, prime, surcoûts...)
 *  - une valeur   : fixe (€) ou pourcentage (%) de la base
 *  - une part     : % réellement appliqué (ex. 50 % si partagé avec la régie)
 *  - des bornes   : montant HT min / max d'application
 */

export type RuleEffet = "deduction" | "bonus" | "remplace_base";

export type RuleBase =
  | "fixe"
  | "montant_ht"
  | "montant_ttc"
  | "commission_base"
  | "prime_coup_pouce"
  | "surcouts"
  | "decom"
  | "puissance_kwc";

export type RuleModeValeur = "fixe" | "pourcentage";

/** Grandeur sur laquelle portent condition_min / condition_max */
export type RuleConditionBase = "montant_ht" | "montant_ttc" | "puissance_kwc";

/** Cycle de vie d'une règle : brouillon (non appliquée) → actif → archive */
export type RuleStatut = "brouillon" | "actif" | "archive";

export interface CommissionRule {
  id: string;
  user_id: string;
  regie_id: string | null;
  product_type: string | null;
  gamme: string | null;
  nom: string;
  description: string | null;
  effet: RuleEffet;
  base: RuleBase;
  mode_valeur: RuleModeValeur;
  valeur: number;
  part_appliquee_pct: number;
  condition_base: RuleConditionBase;
  condition_min: number | null;
  condition_max: number | null;
  ordre: number;
  actif: boolean;
  /** brouillon = jamais utilisée dans les calculs ; archive = ancienne version */
  statut?: RuleStatut;
  /** Version du modèle auquel appartient la règle */
  version?: number;
  /** Nom du modèle de commissionnement auquel appartient la règle (null = règle isolée) */
  schema_nom: string | null;
  /** Raisonnement de l'IA ayant conduit à cette règle */
  raisonnement: string | null;
  source: "manuel" | "ia_texte" | "ia_vocal" | "ia_document";
  source_prompt: string | null;
}

/** Contexte de calcul d'une vente donnée */
export interface RuleContext {
  regieId?: string | null;
  productType?: string | null;
  gamme?: string | null;
  montantHT: number;
  montantTTC: number;
  puissanceKwc: number;
  commissionBase: number;
  primeCoupDePouce: number;
  surcouts: number;
  decom: number;
}

export interface AppliedRule {
  id: string;
  nom: string;
  effet: RuleEffet;
  montant: number;
}

export const RULE_BASE_LABELS: Record<RuleBase, string> = {
  fixe: "Montant fixe (€)",
  montant_ht: "Montant HT de la vente",
  montant_ttc: "Montant TTC de la vente",
  commission_base: "Commission de base",
  prime_coup_pouce: "Prime Coup de Pouce",
  surcouts: "Surcoûts techniques",
  decom: "Décom",
  puissance_kwc: "Puissance (kWc)",
};

export const RULE_EFFET_LABELS: Record<RuleEffet, string> = {
  deduction: "Déduction (retirée de la commission)",
  bonus: "Bonus (ajouté à la commission)",
  remplace_base: "Remplace la commission de base",
};

export const RULE_CONDITION_BASE_LABELS: Record<RuleConditionBase, string> = {
  montant_ht: "Montant HT",
  montant_ttc: "Montant TTC",
  puissance_kwc: "Puissance (kWc)",
};

/** Grandeur testée par condition_min / condition_max */
function conditionValue(rule: CommissionRule, ctx: RuleContext): number {
  switch (rule.condition_base) {
    case "montant_ttc":
      return ctx.montantTTC;
    case "puissance_kwc":
      return ctx.puissanceKwc;
    case "montant_ht":
    default:
      return ctx.montantHT;
  }
}

/** Une règle s'applique-t-elle à cette vente ? */
export function ruleMatches(rule: CommissionRule, ctx: RuleContext): boolean {
  if (!rule.actif) return false;
  if (rule.regie_id && rule.regie_id !== ctx.regieId) return false;
  if (rule.product_type && rule.product_type !== ctx.productType) return false;
  if (rule.gamme && (rule.gamme || "").trim() !== (ctx.gamme || "").trim()) return false;
  const cond = conditionValue(rule, ctx);
  if (rule.condition_min != null && cond < rule.condition_min) return false;
  if (rule.condition_max != null && cond > rule.condition_max) return false;
  return true;
}

/** Valeur de la base sur laquelle porte la règle */
function baseValue(rule: CommissionRule, ctx: RuleContext): number {
  switch (rule.base) {
    case "montant_ht":
      return ctx.montantHT;
    case "montant_ttc":
      return ctx.montantTTC;
    case "commission_base":
      return ctx.commissionBase;
    case "prime_coup_pouce":
      return ctx.primeCoupDePouce;
    case "surcouts":
      return ctx.surcouts;
    case "decom":
      return ctx.decom;
    case "puissance_kwc":
      return ctx.puissanceKwc;
    case "fixe":
    default:
      return 1;
  }
}

/** Montant (€) produit par une règle */
export function computeRuleAmount(rule: CommissionRule, ctx: RuleContext): number {
  const base = baseValue(rule, ctx);
  const raw =
    rule.mode_valeur === "pourcentage"
      ? (base * (Number(rule.valeur) || 0)) / 100
      : rule.base === "fixe"
        ? Number(rule.valeur) || 0
        : base * (Number(rule.valeur) || 0);
  const part = (Number(rule.part_appliquee_pct) ?? 100) / 100;
  return raw * part;
}

/**
 * Applique la liste de règles à une commission déjà calculée par le moteur
 * historique. Les règles les plus spécifiques (régie + produit + gamme)
 * passent en dernier (ordre puis spécificité).
 */
export function applyCommissionRules(
  rules: CommissionRule[],
  ctx: RuleContext,
  commissionAvantRegles: number
): { commission: number; applied: AppliedRule[] } {
  const matching = rules
    .filter((r) => ruleMatches(r, ctx))
    .sort((a, b) => {
      if (a.ordre !== b.ordre) return a.ordre - b.ordre;
      const spec = (r: CommissionRule) =>
        (r.regie_id ? 1 : 0) + (r.product_type ? 1 : 0) + (r.gamme ? 1 : 0);
      return spec(a) - spec(b);
    });

  let commission = commissionAvantRegles;
  const applied: AppliedRule[] = [];

  for (const rule of matching) {
    const montant = computeRuleAmount(rule, ctx);
    if (rule.effet === "remplace_base") {
      commission = montant;
    } else if (rule.effet === "bonus") {
      commission += montant;
    } else {
      commission -= montant;
    }
    applied.push({ id: rule.id, nom: rule.nom, effet: rule.effet, montant });
  }

  return { commission, applied };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * GARDE-FOUS : application sécurisée avec repli sur le calcul historique
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface SafeApplyResult {
  commission: number;
  applied: AppliedRule[];
  /** true si les règles ont été ignorées et la commission historique conservée */
  fallback: boolean;
  /** Raison du repli (affichable à l'utilisateur) */
  fallbackRaison: string | null;
}

/** Une règle en brouillon ou archivée n'entre jamais dans un calcul réel */
export function isRuleApplicable(rule: CommissionRule): boolean {
  const statut = rule.statut ?? "actif";
  return rule.actif && statut === "actif";
}

/** Contrôles de plausibilité sur une règle */
export function validateRule(rule: CommissionRule): string | null {
  const v = Number(rule.valeur);
  if (!Number.isFinite(v)) return `« ${rule.nom} » : valeur invalide`;
  if (rule.mode_valeur === "pourcentage" && (v < -100 || v > 100))
    return `« ${rule.nom} » : pourcentage hors bornes (${v}%)`;
  const part = Number(rule.part_appliquee_pct);
  if (!Number.isFinite(part) || part < 0 || part > 100)
    return `« ${rule.nom} » : part appliquée invalide`;
  if (
    rule.condition_min != null &&
    rule.condition_max != null &&
    rule.condition_min > rule.condition_max
  )
    return `« ${rule.nom} » : bornes min/max incohérentes`;
  return null;
}

/**
 * Applique les règles avec garde-fous :
 *  - seules les règles actives (statut « actif ») sont prises en compte,
 *  - toute règle invalide ou tout résultat aberrant déclenche un repli
 *    complet sur la commission historique.
 */
export function applyCommissionRulesSafe(
  rules: CommissionRule[],
  ctx: RuleContext,
  commissionAvantRegles: number
): SafeApplyResult {
  const applicables = rules.filter(isRuleApplicable);
  if (applicables.length === 0) {
    return { commission: commissionAvantRegles, applied: [], fallback: false, fallbackRaison: null };
  }

  for (const rule of applicables) {
    const erreur = validateRule(rule);
    if (erreur) {
      return {
        commission: commissionAvantRegles,
        applied: [],
        fallback: true,
        fallbackRaison: erreur,
      };
    }
  }

  try {
    const { commission, applied } = applyCommissionRules(applicables, ctx, commissionAvantRegles);
    if (!Number.isFinite(commission)) {
      return {
        commission: commissionAvantRegles,
        applied: [],
        fallback: true,
        fallbackRaison: "Résultat non calculable",
      };
    }
    if (commission < 0) {
      return { commission: 0, applied, fallback: false, fallbackRaison: null };
    }
    // Résultat aberrant : plus de 100 % du montant HT de la vente
    if (ctx.montantHT > 0 && commission > ctx.montantHT) {
      return {
        commission: commissionAvantRegles,
        applied: [],
        fallback: true,
        fallbackRaison: "Commission supérieure au montant HT de la vente",
      };
    }
    return { commission, applied, fallback: false, fallbackRaison: null };
  } catch {
    return {
      commission: commissionAvantRegles,
      applied: [],
      fallback: true,
      fallbackRaison: "Erreur lors de l'application des règles",
    };
  }
}
