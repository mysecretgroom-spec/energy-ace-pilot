/**
 * Mapping centralisé des styles selon le `type_rdv`.
 * Évite la duplication entre DayRdvCard, DraggableRdvCard et autres
 * composants qui affichent un RDV.
 */

export type RdvTypeKey = "standard" | "external_installation" | "installation";

export interface RdvTypeStyle {
  /** Classe(s) Tailwind appliquée(s) à la Card racine */
  cardClass: string;
  /** Couleur de l'icône d'horloge / accent principal */
  clockIconClass: string;
  /** Couleur du texte de l'horloge */
  clockTextClass: string;
  /** Container de l'horloge (fond + texte) */
  clockContainerClass: string;
}

const STYLES: Record<RdvTypeKey, RdvTypeStyle> = {
  installation: {
    cardClass: "halo-multicolor",
    clockIconClass: "text-indigo-500",
    clockTextClass: "text-indigo-600 dark:text-indigo-400",
    clockContainerClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  external_installation: {
    cardClass: "halo-multicolor",
    clockIconClass: "text-amber-500",
    clockTextClass: "text-amber-600 dark:text-amber-400",
    clockContainerClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  standard: {
    cardClass: "",
    clockIconClass: "text-primary",
    clockTextClass: "text-primary",
    clockContainerClass: "bg-primary/10 text-primary",
  },
};

export function getRdvTypeStyle(typeRdv: RdvTypeKey | string | null | undefined): RdvTypeStyle {
  if (typeRdv && typeRdv in STYLES) return STYLES[typeRdv as RdvTypeKey];
  return STYLES.standard;
}

export function isInstallationType(typeRdv: string | null | undefined): boolean {
  return typeRdv === "installation" || typeRdv === "external_installation";
}
