/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DOMAINES DE PARAMÉTRAGE PILOTABLES PAR L'IA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chaque domaine décrit :
 *  - la table concernée,
 *  - la portée (utilisateur seul, ou utilisateur + régie),
 *  - la liste BLANCHE des colonnes que l'IA a le droit de renseigner,
 *  - des règles de validation simples appliquées avant enregistrement.
 *
 * Tout champ absent de la liste blanche est ignoré : l'IA ne peut jamais
 * écrire une colonne technique (id, user_id, created_at...).
 */

export type ConfigFieldType = "text" | "number" | "boolean" | "enum";

export interface ConfigField {
  name: string;
  label: string;
  type: ConfigFieldType;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface ConfigDomain {
  key: string;
  label: string;
  description: string;
  table: string;
  /** true = les lignes sont rattachées à une régie */
  regieScoped: boolean;
  /** true = la table contient aussi des lignes globales (user_id null), non modifiables */
  hasGlobalRows: boolean;
  fields: ConfigField[];
  examples: string[];
}

const PRODUCT_TYPES = ["PV", "PAC", "ITE"];

export const CONFIG_DOMAINS: ConfigDomain[] = [
  {
    key: "regie_bouquets",
    label: "Bouquets / grilles tarifaires",
    description: "Prix recommandés, prix max, prix Hejja et commissions par puissance et par gamme.",
    table: "bouquets",
    regieScoped: true,
    hasGlobalRows: false,
    fields: [
      { name: "nom_bouquet", label: "Nom du bouquet", type: "text", required: true },
      { name: "product_type", label: "Produit", type: "enum", options: PRODUCT_TYPES },
      { name: "gamme", label: "Gamme", type: "text" },
      { name: "puissance_kwc", label: "Puissance (kWc / kW / m²)", type: "number", min: 0, max: 1000, required: true },
      { name: "prix_recommande", label: "Prix recommandé (TTC)", type: "number", min: 0, max: 500000, required: true },
      { name: "prix_max", label: "Prix maximum (TTC)", type: "number", min: 0, max: 500000 },
      { name: "prix_hejja", label: "Prix Hejja", type: "number", min: 0, max: 500000 },
      { name: "commission_fixe", label: "Commission fixe (€)", type: "number", min: 0, max: 100000 },
      { name: "commission_pct", label: "Commission (%)", type: "number", min: 0, max: 100 },
      { name: "description", label: "Description", type: "text" },
      { name: "actif", label: "Actif", type: "boolean" },
    ],
    examples: [
      "ajoute un bouquet Full Black 6 kWc à 26 900 € avec 3 000 € de commission",
      "augmente de 500 € tous les bouquets PV au-dessus de 6 kWc",
    ],
  },
  {
    key: "regie_surcouts",
    label: "Surcoûts techniques",
    description: "Options facturées en plus : pergola, triphasé, sol béton, liaison frigorifique...",
    table: "regies_surcouts",
    regieScoped: true,
    hasGlobalRows: false,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "code", label: "Code technique", type: "text", required: true },
      { name: "categorie", label: "Catégorie", type: "text", required: true },
      { name: "prix", label: "Prix unitaire (€)", type: "number", min: 0, max: 100000, required: true },
      {
        name: "type_calcul",
        label: "Type de calcul",
        type: "enum",
        options: ["fixe", "par_panneau", "par_m2", "par_ml"],
      },
      { name: "actif", label: "Actif", type: "boolean" },
    ],
    examples: [
      "le triphasé passe à 1 500 €",
      "ajoute un surcoût pergola à 750 € par panneau",
    ],
  },
  {
    key: "regie_financements",
    label: "Financements",
    description: "Durées, taux et TAEG proposés par la régie.",
    table: "regies_financements",
    regieScoped: true,
    hasGlobalRows: false,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "duree_mois", label: "Durée (mois)", type: "number", min: 1, max: 360, required: true },
      { name: "taux_effectif", label: "Taux effectif (%)", type: "number", min: 0, max: 30 },
      { name: "taeg", label: "TAEG (%)", type: "number", min: 0, max: 30 },
      { name: "actif", label: "Actif", type: "boolean" },
    ],
    examples: [
      "ajoute un financement 180 mois à 5,9 % de TAEG",
      "désactive les financements à moins de 60 mois",
    ],
  },
  {
    key: "regie_gammes",
    label: "Gammes de produits",
    description: "Gammes rattachées à une régie (Full Black, Standard, Premium...).",
    table: "regies_gammes",
    regieScoped: true,
    hasGlobalRows: false,
    fields: [
      { name: "nom", label: "Nom de la gamme", type: "text", required: true },
      { name: "product_type", label: "Produit", type: "enum", options: PRODUCT_TYPES },
      { name: "actif", label: "Active", type: "boolean" },
    ],
    examples: ["crée les gammes Full Black et Standard pour le PV"],
  },
  {
    key: "aides_pv",
    label: "Aides & primes photovoltaïque",
    description: "Aides PV : primes par kWc, pourcentages, montants fixes et bornes de puissance.",
    table: "data_aides",
    regieScoped: false,
    hasGlobalRows: true,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "code", label: "Code", type: "text", required: true },
      {
        name: "type_calcul",
        label: "Type de calcul",
        type: "enum",
        options: ["par_kwc", "pourcentage", "fixe"],
      },
      { name: "valeur", label: "Valeur", type: "number", min: -100000, max: 100000, required: true },
      { name: "puissance_min", label: "Puissance min (kWc)", type: "number", min: 0, max: 1000 },
      { name: "puissance_max", label: "Puissance max (kWc)", type: "number", min: 0, max: 1000 },
      { name: "conditions", label: "Conditions", type: "text" },
      { name: "description", label: "Description", type: "text" },
      { name: "actif", label: "Active", type: "boolean" },
    ],
    examples: [
      "la prime coup de pouce passe à 80 € par kWc jusqu'à 9 kWc",
      "désactive l'aide autoconsommation",
    ],
  },
  {
    key: "aides_pac",
    label: "Aides pompe à chaleur",
    description: "Aides PAC par profil de revenus et sous-type d'équipement.",
    table: "data_aides_pac",
    regieScoped: false,
    hasGlobalRows: true,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "code", label: "Code", type: "text", required: true },
      { name: "type_aide", label: "Type d'aide", type: "text", required: true },
      { name: "profil_revenus", label: "Profil de revenus", type: "text" },
      { name: "pac_subtype", label: "Sous-type PAC", type: "text" },
      { name: "montant_fixe", label: "Montant (€)", type: "number", min: 0, max: 100000 },
      { name: "montant_plafond", label: "Plafond (€)", type: "number", min: 0, max: 100000 },
      { name: "conditions", label: "Conditions", type: "text" },
      { name: "actif", label: "Active", type: "boolean" },
    ],
    examples: ["MaPrimeRénov bleu air/eau passe à 5 000 €"],
  },
  {
    key: "aides_ite",
    label: "Aides isolation (ITE)",
    description: "Aides ITE au m², plafonds et surfaces minimales par profil.",
    table: "data_aides_ite",
    regieScoped: false,
    hasGlobalRows: true,
    fields: [
      { name: "nom", label: "Nom", type: "text", required: true },
      { name: "code", label: "Code", type: "text", required: true },
      { name: "type_aide", label: "Type d'aide", type: "text", required: true },
      { name: "profil_revenus", label: "Profil de revenus", type: "text" },
      { name: "montant_m2", label: "Montant au m² (€)", type: "number", min: 0, max: 10000 },
      { name: "montant_plafond", label: "Plafond (€)", type: "number", min: 0, max: 200000 },
      { name: "surface_min", label: "Surface minimale (m²)", type: "number", min: 0, max: 10000 },
      { name: "conditions", label: "Conditions", type: "text" },
      { name: "actif", label: "Active", type: "boolean" },
    ],
    examples: ["l'aide ITE profil jaune passe à 50 € du m² plafonnée à 8 000 €"],
  },
];

export function getConfigDomain(key: string): ConfigDomain | undefined {
  return CONFIG_DOMAINS.find((d) => d.key === key);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * CHANGEMENTS PROPOSÉS PAR L'IA
 * ═══════════════════════════════════════════════════════════════════════════ */

export type ConfigChangeAction = "creer" | "modifier" | "supprimer";

export interface ConfigChange {
  action: ConfigChangeAction;
  /** id de la ligne existante (modifier / supprimer) */
  id?: string | null;
  /** libellé lisible de la ligne concernée */
  cible?: string | null;
  /** valeurs à écrire (creer / modifier) */
  valeurs: Record<string, unknown>;
  /** justification courte */
  motif?: string | null;
}

export interface ConfigProposal {
  resume: string;
  raisonnement: string;
  changements: ConfigChange[];
}

/** Nettoie un changement : liste blanche des champs + bornes de validation */
export function sanitizeChange(
  domain: ConfigDomain,
  change: ConfigChange
): { change: ConfigChange | null; erreur: string | null } {
  const action: ConfigChangeAction = (["creer", "modifier", "supprimer"] as const).includes(
    change.action as ConfigChangeAction
  )
    ? change.action
    : "modifier";

  if (action !== "creer" && !change.id) {
    return { change: null, erreur: "Ligne cible introuvable" };
  }

  const valeurs: Record<string, unknown> = {};
  if (action !== "supprimer") {
    for (const field of domain.fields) {
      if (!(field.name in (change.valeurs || {}))) continue;
      const raw = (change.valeurs as Record<string, unknown>)[field.name];
      if (raw === undefined) continue;

      if (field.type === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) return { change: null, erreur: `${field.label} : valeur invalide` };
        if (field.min != null && n < field.min)
          return { change: null, erreur: `${field.label} : valeur trop basse (${n})` };
        if (field.max != null && n > field.max)
          return { change: null, erreur: `${field.label} : valeur trop élevée (${n})` };
        valeurs[field.name] = n;
      } else if (field.type === "boolean") {
        valeurs[field.name] = Boolean(raw);
      } else if (field.type === "enum") {
        if (raw === null) {
          valeurs[field.name] = null;
        } else if (field.options?.includes(String(raw))) {
          valeurs[field.name] = String(raw);
        } else {
          return { change: null, erreur: `${field.label} : « ${String(raw)} » non autorisé` };
        }
      } else {
        valeurs[field.name] = raw === null ? null : String(raw).slice(0, 500);
      }
    }

    if (action === "creer") {
      for (const field of domain.fields) {
        if (field.required && (valeurs[field.name] === undefined || valeurs[field.name] === null || valeurs[field.name] === "")) {
          return { change: null, erreur: `${field.label} manquant` };
        }
      }
    }

    if (Object.keys(valeurs).length === 0) {
      return { change: null, erreur: "Aucune modification exploitable" };
    }
  }

  return {
    change: {
      action,
      id: change.id ?? null,
      cible: change.cible ? String(change.cible).slice(0, 160) : null,
      motif: change.motif ? String(change.motif).slice(0, 300) : null,
      valeurs,
    },
    erreur: null,
  };
}

export function formatChangeValues(domain: ConfigDomain, valeurs: Record<string, unknown>): string {
  return domain.fields
    .filter((f) => f.name in valeurs)
    .map((f) => {
      const v = valeurs[f.name];
      const shown = typeof v === "boolean" ? (v ? "oui" : "non") : v === null || v === "" ? "—" : String(v);
      return `${f.label} : ${shown}`;
    })
    .join(" · ");
}
