import React, { useMemo } from "react";
import { MapPin, ExternalLink } from "lucide-react";

interface ClientMapEmbedProps {
  /** Adresse complète : rue, code postal, ville */
  address: string;
}

/**
 * Carte Google Maps intégrée, synchronisée avec l'adresse du client.
 * Utilise l'embed sans clé (output=embed) : fonctionne sur tous les domaines,
 * y compris le domaine personnalisé, sans configuration.
 * L'iframe est remontée (key) à chaque changement d'adresse pour forcer la synchro.
 */
export const ClientMapEmbed = React.memo(function ClientMapEmbed({ address }: ClientMapEmbedProps) {
  const embedUrl = useMemo(
    () => `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`,
    [address]
  );
  const openUrl = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    [address]
  );

  if (!address) return null;

  return (
    <div className="pt-2 border-t space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <MapPin className="h-3 w-3" />
          Localisation
        </span>
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
        >
          Ouvrir dans Maps
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="rounded-sm border border-border overflow-hidden bg-muted">
        <iframe
          key={address}
          title={`Carte — ${address}`}
          src={embedUrl}
          className="w-full h-52 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
});
