import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, MapPin, Navigation } from "lucide-react";
import { RdvStatus } from "@/components/ui/status-badge";

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface RdvMapData {
  id: string;
  time: string;
  client: string;
  address: string;
  status: RdvStatus;
  latitude?: number;
  longitude?: number;
  isR2?: boolean;
  typeRdv?: string;
}

interface RouteMapProps {
  rdvList: RdvMapData[];
  onClose: () => void;
}

// Custom numbered marker icon
const createNumberedIcon = (number: number, isR2: boolean, isExternal: boolean) => {
  const color = isExternal ? "#f59e0b" : isR2 ? "#8b5cf6" : "#3b82f6";
  
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 14px;
        border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        ${number}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
};

export function RouteMap({ rdvList, onClose }: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Filter RDVs with valid coordinates
  const rdvsWithCoords = useMemo(() => 
    rdvList.filter(rdv => rdv.latitude && rdv.longitude),
    [rdvList]
  );

  // Get positions for polyline
  const positions: [number, number][] = useMemo(() => 
    rdvsWithCoords.map(rdv => [rdv.latitude!, rdv.longitude!]),
    [rdvsWithCoords]
  );

  // Calculate center (average of all points)
  const center: [number, number] = useMemo(() => {
    if (positions.length === 0) return [46.603354, 1.888334]; // France center
    const avgLat = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
    const avgLng = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
    return [avgLat, avgLng];
  }, [positions]);

  // Initialize map imperatively
  useEffect(() => {
    if (!mapContainerRef.current || rdvsWithCoords.length === 0) return;

    // Clean up existing map instance first
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create new map instance
    const map = L.map(mapContainerRef.current).setView(center, 10);
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Add route line
    if (positions.length > 1) {
      L.polyline(positions, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.7,
        dashArray: "10, 10",
      }).addTo(map);
    }

    // Add markers
    rdvsWithCoords.forEach((rdv, index) => {
      const marker = L.marker([rdv.latitude!, rdv.longitude!], {
        icon: createNumberedIcon(
          index + 1,
          rdv.isR2 || false,
          rdv.typeRdv === "external_installation"
        ),
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width: 180px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-weight: bold; color: #3b82f6;">${rdv.time}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #e5e7eb;">${rdv.status}</span>
          </div>
          <p style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${rdv.client}</p>
          <p style="font-size: 12px; color: #6b7280;">${rdv.address}</p>
        </div>
      `);
    });

    // Fit bounds
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [rdvsWithCoords, positions, center]);

  if (rdvsWithCoords.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Carte des trajets
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center py-8">
            Aucun RDV avec coordonnées GPS disponible.
            <br />
            Les adresses doivent être géocodées pour afficher la carte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            Carte des trajets ({rdvsWithCoords.length} RDV)
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div 
          ref={mapContainerRef}
          className="h-[400px] w-full"
          style={{ zIndex: 0 }}
        />

        {/* Legend */}
        <div className="p-3 bg-muted/50 border-t flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>RDV Standard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-status-r2" />
            <span>R2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Installation Externe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 border-t-2 border-dashed border-primary" />
            <span>Trajet</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
