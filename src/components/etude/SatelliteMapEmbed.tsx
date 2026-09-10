import React, { useMemo, useState } from "react";
import { Satellite, ExternalLink, Map as MapIcon } from "lucide-react";

interface SatelliteMapEmbedProps {
  /** Adresse complète : rue, code postal, ville */
  address: string;
  /** Titre affiché au-dessus de la carte */
  label?: string;
}

/**
 * Vue satellite Google Maps intégrée, synchronisée avec l'adresse saisie.
 * Embed sans clé (output=embed) : fonctionne sur tous les domaines.
 * L'iframe est remontée (key) à chaque changement d'adresse ou de vue.
 */
export const SatelliteMapEmbed = React.memo(function SatelliteMapEmbed({
  address,
  label = "Vue satellite (repère toiture / carport)",
}: SatelliteMapEmbedProps) {
  const [satellite, setSatellite] = useState(true);
  // z=20 dépasse souvent la résolution disponible en zone rurale : Google
  // ré-agrandit alors une tuile z=19 et l'image apparaît floue en permanence.
  const [zoom, setZoom] = useState(19);

  const embedUrl = useMemo(
    () =>
      `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&t=${
        satellite ? "k" : "m"
      }&output=embed`,
    [address, satellite, zoom]
  );

  const openUrl = useMemo(
    () =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    [address]
  );

  if (!address.trim()) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground">
          <Satellite className="h-3 w-3" />
          {label}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSatellite((s) => !s)}
            className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-primary hover:underline"
            title={satellite ? "Afficher le plan" : "Afficher le satellite"}
          >
            {satellite ? <MapIcon className="h-3 w-3" /> : <Satellite className="h-3 w-3" />}
            {satellite ? "Plan" : "Satellite"}
          </button>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-primary hover:underline"
          >
            Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <div className="rounded-sm border border-border overflow-hidden bg-muted">
        <iframe
          key={`${address}-${satellite ? "sat" : "map"}`}
          title={`Vue satellite — ${address}`}
          src={embedUrl}
          className="w-full h-56 sm:h-64 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="text-[10px] text-muted-foreground truncate">{address}</p>
    </div>
  );
});
