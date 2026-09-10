export type OcrIssueLevel = "error" | "warning";

export interface OcrIssue {
  field: string;
  level: OcrIssueLevel;
  message: string;
}

/** Libellés lisibles des champs, pour l'affichage des erreurs de lecture. */
export const OCR_FIELD_LABELS: Record<string, string> = {
  montant_ttc: "Montant TTC",
  montant_ht: "Montant HT",
  tva: "TVA",
  taux_tva: "Taux de TVA",
  date: "Date",
  commercant: "Commerçant",
  categorie: "Catégorie",
  description: "Description",
  date_debut: "Début de période",
  date_fin: "Fin de période",
  image: "Photo",
};

export function fieldIssues(issues: OcrIssue[] | undefined, field: string): OcrIssue[] {
  return (issues ?? []).filter((i) => i.field === field);
}

export function hasIssue(issues: OcrIssue[] | undefined, field: string): boolean {
  return fieldIssues(issues, field).length > 0;
}

/** Classes de mise en évidence d'un champ douteux. */
export function issueFieldClass(issues: OcrIssue[] | undefined, field: string): string {
  const list = fieldIssues(issues, field);
  if (list.length === 0) return "";
  const isError = list.some((i) => i.level === "error");
  return isError
    ? "border-destructive focus-visible:ring-destructive"
    : "border-warning focus-visible:ring-warning";
}

export function countIssues(issues: OcrIssue[] | undefined) {
  const list = issues ?? [];
  return {
    errors: list.filter((i) => i.level === "error").length,
    warnings: list.filter((i) => i.level === "warning").length,
    total: list.length,
  };
}

/**
 * Recalcule les incohérences localement après édition manuelle des champs,
 * pour que les alertes disparaissent dès que l'utilisateur corrige.
 */
export function recomputeLocalIssues(values: {
  montantTTC: string;
  montantHT: string;
  tva: string;
  tauxTva: string;
  date: string;
  commercant: string;
  categorie: string;
}): OcrIssue[] {
  const issues: OcrIssue[] = [];
  const n = (v: string) => {
    const p = parseFloat((v || "").replace(",", "."));
    return Number.isFinite(p) ? p : null;
  };
  const ttc = n(values.montantTTC);
  const ht = n(values.montantHT);
  const tva = n(values.tva);
  const taux = n(values.tauxTva);

  if (ttc === null || ttc <= 0) {
    issues.push({ field: "montant_ttc", level: "error", message: "Montant TTC manquant ou invalide." });
  }
  if (ttc !== null && ht !== null && tva !== null && Math.abs(ht + tva - ttc) > Math.max(0.05, ttc * 0.01)) {
    issues.push({ field: "montant_ht", level: "warning", message: "HT + TVA ne correspond pas au TTC." });
  }
  if (taux !== null && ![0, 2.1, 5.5, 10, 20].some((t) => Math.abs(t - taux) < 0.3)) {
    issues.push({ field: "taux_tva", level: "warning", message: `Taux de TVA inhabituel (${taux} %).` });
  }
  if (!values.date) {
    issues.push({ field: "date", level: "error", message: "Date manquante." });
  } else {
    const d = new Date(values.date);
    if (Number.isNaN(d.getTime())) {
      issues.push({ field: "date", level: "error", message: "Date invalide." });
    } else if (d.getTime() > Date.now() + 24 * 3600 * 1000) {
      issues.push({ field: "date", level: "error", message: "Date dans le futur." });
    }
  }
  if (!values.commercant.trim()) {
    issues.push({ field: "commercant", level: "warning", message: "Commerçant non renseigné." });
  }
  if (!values.categorie) {
    issues.push({ field: "categorie", level: "error", message: "Catégorie non renseignée." });
  }
  return issues;
}
