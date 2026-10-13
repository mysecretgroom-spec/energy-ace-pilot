import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Trash2 } from "lucide-react";
import { SATELLITE_TILE_URL } from "@/lib/roofMapImage";

interface RoofPointMapProps {
  address: string;
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
}

const markerIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:50%;background:rgba(220,38,38,.45);border:3px solid #fff;box-shadow:0 0 0 2px #dc2626"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Carte satellite cliquable : un toucher place le repère sur la toiture du projet. */
export function RoofPointMap({ address, lat, lng, onChange }: RoofPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [geoError, setGeoError] = useState(false);

  // Init unique
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false, maxZoom: 20 })
      .setView([lat ?? 46.6, lng ?? 1.89], lat != null ? 19 : 6);
    L.tileLayer(SATELLITE_TILE_URL, { maxZoom: 20, maxNativeZoom: 19 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => onChangeRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repère
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (lat == null || lng == null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
  }, [lat, lng]);

  // Centrage sur l'adresse (sans écraser un repère existant)
  useEffect(() => {
    if (!address.trim()) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`, { signal: ctrl.signal });
        const json = await res.json();
        const coords = json?.features?.[0]?.geometry?.coordinates;
        if (!coords) { setGeoError(true); return; }
        setGeoError(false);
        if (lat == null || lng == null) mapRef.current?.setView([coords[1], coords[0]], 19);
      } catch { /* ignore */ }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const recenter = () => {
    if (lat != null && lng != null) mapRef.current?.setView([lat, lng], 19);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lat != null ? "Toiture repérée" : "Touchez la toiture concernée"}
        </span>
        {lat != null && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={recenter} className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-primary" aria-label="Recentrer">
              <Crosshair className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => onChange(null, null)} className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-destructive" aria-label="Retirer le repère">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <div className="rounded-sm border border-border overflow-hidden bg-muted">
        <div ref={containerRef} className="w-full h-56 sm:h-64" style={{ zIndex: 0 }} />
      </div>
      <p className="text-[10px] text-muted-foreground truncate">
        {geoError ? "Adresse introuvable — déplacez la carte manuellement" : address}
      </p>
    </div>
  );
}
