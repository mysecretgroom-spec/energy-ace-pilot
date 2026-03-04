// Document categories for client files
// Aligned with database enum 'document_type'

export type DocumentType =
  // Photos techniques
  | "photo_tableau"
  | "photo_compteur"
  | "photo_toiture"
  | "photo_chantier"
  // Identité
  | "cni_monsieur_recto"
  | "cni_monsieur_verso"
  | "cni_madame_recto"
  | "cni_madame_verso"
  | "cni" // Legacy
  // Justificatifs domicile/propriété
  | "justificatif_domicile"
  | "taxe_fonciere"
  | "acte_notarie"
  // Financiers
  | "rib"
  | "avis_impots"
  | "fiche_paie_monsieur"
  | "fiche_paie_madame"
  | "attestation_retraite"
  | "attestation_invalidite"
  | "bilans"
  // Documents projet
  | "facture_energie"
  | "bon_commande"
  | "devis"
  | "contrat"
  | "plan"
  | "assurance"
  | "facture_frais"
  | "multi_docs"
  | "autre";

export interface DocumentCategory {
  value: DocumentType;
  label: string;
  group?: string;
}

// Grouped categories for client documents
export const CLIENT_DOC_CATEGORIES: DocumentCategory[] = [
  // Photos techniques
  { value: "photo_tableau", label: "Photo tableau électrique", group: "Photos" },
  { value: "photo_compteur", label: "Photo compteur", group: "Photos" },
  { value: "photo_toiture", label: "Photo toiture", group: "Photos" },
  { value: "photo_chantier", label: "Photo chantier", group: "Photos" },
  
  // Identité
  { value: "cni_monsieur_recto", label: "CNI Monsieur (recto)", group: "Identité" },
  { value: "cni_monsieur_verso", label: "CNI Monsieur (verso)", group: "Identité" },
  { value: "cni_madame_recto", label: "CNI Madame (recto)", group: "Identité" },
  { value: "cni_madame_verso", label: "CNI Madame (verso)", group: "Identité" },
  
  // Justificatifs domicile/propriété
  { value: "justificatif_domicile", label: "Justificatif de domicile (-3 mois)", group: "Domicile" },
  { value: "taxe_fonciere", label: "Taxe foncière", group: "Domicile" },
  { value: "acte_notarie", label: "Acte notarié", group: "Domicile" },
  
  // Documents financiers
  { value: "rib", label: "RIB", group: "Financier" },
  { value: "avis_impots", label: "Avis d'impôts", group: "Financier" },
  { value: "fiche_paie_monsieur", label: "Fiche de paie Monsieur", group: "Financier" },
  { value: "fiche_paie_madame", label: "Fiche de paie Madame", group: "Financier" },
  { value: "attestation_retraite", label: "Attestation de retraite (-3 ans)", group: "Financier" },
  { value: "attestation_invalidite", label: "Attestation d'invalidité", group: "Financier" },
  { value: "bilans", label: "Bilans comptables", group: "Financier" },
  
  // Documents projet
  { value: "facture_energie", label: "Facture énergie", group: "Projet" },
  { value: "bon_commande", label: "Bon de commande", group: "Projet" },
  { value: "devis", label: "Devis", group: "Projet" },
  { value: "contrat", label: "Contrat", group: "Projet" },
  { value: "plan", label: "Plan", group: "Projet" },
  { value: "assurance", label: "Assurance", group: "Projet" },
  
  // Multi-documents
  { value: "multi_docs", label: "Multi-documents", group: "Autre" },
  
  // Autre
  { value: "autre", label: "Autre justificatif", group: "Autre" },
];

// Finance expense categories (unchanged)
export const FINANCE_CATEGORIES: DocumentCategory[] = [
  { value: "autre", label: "Carburant" },
  { value: "autre", label: "Péage" },
  { value: "autre", label: "Repas" },
  { value: "autre", label: "Hôtel" },
  { value: "autre", label: "Parking" },
  { value: "autre", label: "Autre" },
];

// Legacy mapping for QuickPhotoButton - uses new document types
export type QuickPhotoCategory = "photo_tableau" | "photo_compteur" | "photo_toiture" | "autre";

// Also export legacy PhotoCategory for backward compatibility
export type PhotoCategory = QuickPhotoCategory;

export const QUICK_PHOTO_LABELS: Record<QuickPhotoCategory, string> = {
  photo_tableau: "Tableau électrique",
  photo_compteur: "Compteur",
  photo_toiture: "Toiture",
  autre: "Photo",
};

// Legacy category labels (for backward compatibility)
export const categoryLabels = QUICK_PHOTO_LABELS;

// Helper to get label from value
export function getDocumentTypeLabel(value: DocumentType): string {
  const category = CLIENT_DOC_CATEGORIES.find((c) => c.value === value);
  return category?.label || value;
}

// Group categories for select display
export function getGroupedCategories(): Map<string, DocumentCategory[]> {
  const groups = new Map<string, DocumentCategory[]>();
  
  for (const cat of CLIENT_DOC_CATEGORIES) {
    const group = cat.group || "Autre";
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group)!.push(cat);
  }
  
  return groups;
}
