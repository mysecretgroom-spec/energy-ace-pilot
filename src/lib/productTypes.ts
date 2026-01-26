/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPES DE PRODUITS - PV / PAC / ITE
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Type de produit principal */
export type ProductType = "PV" | "PAC" | "ITE";

/** Sous-type PAC */
export type PacSubtype = "air_air" | "air_eau";

/** Labels pour affichage */
export const PRODUCT_LABELS: Record<ProductType, string> = {
  PV: "Panneaux Photovoltaïques",
  PAC: "Pompe à Chaleur",
  ITE: "Isolation Thermique Extérieure",
};

export const PRODUCT_SHORT_LABELS: Record<ProductType, string> = {
  PV: "PV",
  PAC: "PAC",
  ITE: "ITE",
};

export const PRODUCT_ICONS: Record<ProductType, string> = {
  PV: "Sun",
  PAC: "Thermometer",
  ITE: "Home",
};

export const PRODUCT_COLORS: Record<ProductType, string> = {
  PV: "text-yellow-600",
  PAC: "text-blue-600", 
  ITE: "text-orange-600",
};

export const PAC_SUBTYPE_LABELS: Record<PacSubtype, string> = {
  air_air: "Air/Air (Climatisation réversible)",
  air_eau: "Air/Eau (Chauffage central)",
};

/**
 * Champs communs à toutes les études
 */
export interface BaseEtudeFields {
  id?: string;
  productType: ProductType;
  clientId: string;
  rdvId?: string;
  userId: string;
  potentielFaisabilite: string;
  notes: string;
  prixInstallation: number;
  prixTotal: number;
  financementId: string;
  dureeMois: number;
  mensualite: number;
  classification: string;
  classificationComment: string;
  r2DateHeure?: Date;
}

/**
 * Champs spécifiques PV
 */
export interface PVEtudeFields {
  ombreToiture: string;
  surfaceToiture: string;
  typeToiture: string;
  etatToiture: string;
  typeCompteurElectrique: string;
  numeroPdl: string;
  typeRaccordement: string;
  amperageDisjoncteur: number;
  emplacementBoitier: string;
  puissanceKwc: number;
  typeRevente: string;
  supportInstallation: string;
  orientation: string;
  inclinaison: number;
  consoAnnuelle: number;
  factureMensuelle: number;
  productionAnnuelle: number;
  autoconsoPct: number;
  surplusProduction: number;
  surcoutSupport: number;
  surcoutCompteur: number;
  autreSurcout: number;
  primeAutoconsommation: number;
  ecoTva: number;
  totalAides: number;
}

/**
 * Champs spécifiques PAC
 */
export interface PACEtudeFields {
  pacSubtype: PacSubtype;
  pacSurfaceChauffee: number;
  pacTypeEmetteurs: string;
  pacNombreUnitesInt: number;
  pacPuissanceCalorifique: number;
  pacCop: number;
  pacEcsIntegre: boolean;
  pacVolumeBallon: number;
  pacEnergieActuelle: string;
  pacConsoChaufffageKwh: number;
  pacEconomieEstimee: number;
}

/**
 * Champs spécifiques ITE
 */
export interface ITEEtudeFields {
  iteSurfaceIsoler: number;
  iteTypeFacade: string;
  iteEpaisseurIsolant: number;
  iteTypeIsolant: string;
  iteRActuel: number;
  iteRCible: number;
  iteNombreFacades: number;
  iteSurfaceOuvertures: number;
  iteFinition: string;
  iteEconomieChauffagePct: number;
}

/**
 * Étude complète avec tous les champs possibles
 */
export interface EtudeComplete extends BaseEtudeFields, Partial<PVEtudeFields>, Partial<PACEtudeFields>, Partial<ITEEtudeFields> {}

/**
 * Configuration des champs obligatoires par type de produit
 */
export const REQUIRED_FIELDS: Record<ProductType, string[]> = {
  PV: [
    "puissanceKwc",
    "consoAnnuelle",
    "orientation",
    "inclinaison",
    "typeRevente",
  ],
  PAC: [
    "pacSubtype",
    "pacSurfaceChauffee",
    "pacPuissanceCalorifique",
    "pacEnergieActuelle",
  ],
  ITE: [
    "iteSurfaceIsoler",
    "iteTypeFacade",
    "iteTypeIsolant",
    "iteEpaisseurIsolant",
  ],
};

/**
 * Options pour les sélecteurs PAC
 */
export const PAC_OPTIONS = {
  emetteurs: [
    { value: "radiateurs", label: "Radiateurs" },
    { value: "plancher_chauffant", label: "Plancher chauffant" },
    { value: "ventilo_convecteurs", label: "Ventilo-convecteurs" },
    { value: "splits", label: "Splits muraux" },
    { value: "gainable", label: "Gainable" },
  ],
  energieActuelle: [
    { value: "fioul", label: "Fioul" },
    { value: "gaz", label: "Gaz naturel" },
    { value: "propane", label: "Propane/GPL" },
    { value: "electrique", label: "Électrique" },
    { value: "bois", label: "Bois/Granulés" },
  ],
  volumeBallon: [
    { value: 0, label: "Pas d'ECS" },
    { value: 100, label: "100L" },
    { value: 150, label: "150L" },
    { value: 200, label: "200L" },
    { value: 250, label: "250L" },
    { value: 300, label: "300L" },
  ],
};

/**
 * Options pour les sélecteurs ITE
 */
export const ITE_OPTIONS = {
  typeFacade: [
    { value: "brique", label: "Brique" },
    { value: "parpaing", label: "Parpaing" },
    { value: "beton", label: "Béton" },
    { value: "pierre", label: "Pierre" },
    { value: "ossature_bois", label: "Ossature bois" },
  ],
  typeIsolant: [
    { value: "pse", label: "Polystyrène expansé (PSE)" },
    { value: "xps", label: "Polystyrène extrudé (XPS)" },
    { value: "laine_roche", label: "Laine de roche" },
    { value: "fibre_bois", label: "Fibre de bois" },
  ],
  finition: [
    { value: "enduit_mineral", label: "Enduit minéral" },
    { value: "enduit_siloxane", label: "Enduit siloxane" },
    { value: "bardage_bois", label: "Bardage bois" },
    { value: "bardage_composite", label: "Bardage composite" },
  ],
  epaisseurIsolant: [
    { value: 80, label: "80 mm (R ≈ 2.1)" },
    { value: 100, label: "100 mm (R ≈ 2.6)" },
    { value: 120, label: "120 mm (R ≈ 3.2)" },
    { value: 140, label: "140 mm (R ≈ 3.7)" },
    { value: 160, label: "160 mm (R ≈ 4.2)" },
    { value: 180, label: "180 mm (R ≈ 4.7)" },
    { value: 200, label: "200 mm (R ≈ 5.3)" },
  ],
};

/**
 * Calcule le coefficient R en fonction du lambda et de l'épaisseur
 */
export function calculateR(lambda: number, epaisseurMm: number): number {
  return epaisseurMm / 1000 / lambda;
}

/**
 * Vérifie si tous les champs obligatoires sont remplis
 */
export function validateRequiredFields(
  productType: ProductType,
  data: Partial<EtudeComplete>
): { valid: boolean; missingFields: string[] } {
  const required = REQUIRED_FIELDS[productType];
  const missingFields = required.filter(field => {
    const value = (data as Record<string, unknown>)[field];
    return value === undefined || value === null || value === "" || value === 0;
  });
  
  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
