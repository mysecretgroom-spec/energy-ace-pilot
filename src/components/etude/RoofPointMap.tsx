import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Trash2, PencilRuler, Plus, Move, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addRoofPanel, panelCorners, type RoofPanelLayout } from "@/lib/roofPanelLayout";
import { SATELLITE_TILE_URL } from "@/lib/roofMapImage";
import { DEFAULT_ROOF_MAP_ZOOM, type RoofMapViewport } from "@/lib/roofMapViewport";

interface RoofPointMapProps {
  address: string;
  lat: number | null;
  lng: number | null;
  onChange: (lat: number | null, lng: number | null) => void;
  viewport?: RoofMapViewport;
  onViewportChange?: (viewport: RoofMapViewport) => void;
  targetPanelCount?: number;
}

const markerIcon = L.divIcon({
  className: "",
  html: `<div style="width:26px;height:26px;border-radius:50%;background:rgba(220,38,38,.45);border:3px solid #fff;box-shadow:0 0 0 2px #dc2626"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

/** Carte satellite cliquable : un toucher place le repère sur la toiture du projet. */
export function RoofPointMap({ address, lat, lng, onChange, viewport, onViewportChange, targetPanelCount = 0 }: RoofPointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const viewportChangeRef = useRef(onViewportChange);
  viewportChangeRef.current = onViewportChange;
  const restoredViewportRef = useRef(false);
  const [geoError, setGeoError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"add" | "move">("add");
  const [zoneId, setZoneId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const layout = viewport?.panelLayout ?? { zones: [], panels: [] };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const interactionRef = useRef({ editing, mode, zoneId, selectedId, rotation, targetPanelCount });
  interactionRef.current = { editing, mode, zoneId, selectedId, rotation, targetPanelCount };
  const publishLayout = (next: RoofPanelLayout) => {
    const map = mapRef.current;
    if (!map) return;
    layoutRef.current = next;
    const center = map.getCenter(), size = map.getSize();
    viewportChangeRef.current?.({ centerLatitude: center.lat, centerLongitude: center.lng, zoom: map.getZoom(), width: size.x, height: size.y, panelLayout: next });
  };
  const publishLayoutRef = useRef(publishLayout);
  publishLayoutRef.current = publishLayout;

  // Init unique
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false, maxZoom: 20 })
      .setView([lat ?? 46.6, lng ?? 1.89], lat != null ? DEFAULT_ROOF_MAP_ZOOM : 6);
    L.tileLayer(SATELLITE_TILE_URL, { maxZoom: 20, maxNativeZoom: 19 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      const state = interactionRef.current;
      if (!state.editing) { onChangeRef.current(e.latlng.lat, e.latlng.lng); return; }
      const current = layoutRef.current;
      if (state.mode === "move" && state.selectedId) {
        publishLayoutRef.current({ ...current, panels: current.panels.map(p => p.id === state.selectedId ? { ...p, latitude: e.latlng.lat, longitude: e.latlng.lng } : p) });
        return;
      }
      const activeZone = state.zoneId || current.zones[0]?.id;
      if (!activeZone) return;
      const panel = { id: crypto.randomUUID(), zoneId: activeZone, latitude: e.latlng.lat, longitude: e.latlng.lng, rotation: state.rotation };
      const next = addRoofPanel(current, panel, state.targetPanelCount);
      if (next !== current) { publishLayoutRef.current(next); setSelectedId(panel.id); }
    });
    mapRef.current = map;
    const reportViewport = () => {
      const center = map.getCenter();
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) viewportChangeRef.current?.({
        centerLatitude: center.lat, centerLongitude: center.lng,
        zoom: map.getZoom(), width: size.x, height: size.y,
        panelLayout: layoutRef.current,
      });
    };
    map.on("moveend resize", reportViewport);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !viewport || restoredViewportRef.current) return;
    const center = map.getCenter();
    if (Math.abs(center.lat - viewport.centerLatitude) < 1e-9 &&
        Math.abs(center.lng - viewport.centerLongitude) < 1e-9 && map.getZoom() === viewport.zoom) return;
    restoredViewportRef.current = true;
    map.setView([viewport.centerLatitude, viewport.centerLongitude], viewport.zoom);
  }, [viewport]);

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
        const p = markerRef.current?.getLatLng();
        if (!p) return;
        onChangeRef.current(p.lat, p.lng);
      });
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    if (map.getZoom() === 6 && !restoredViewportRef.current) {
      map.setView([lat, lng], DEFAULT_ROOF_MAP_ZOOM);
    } else {
      map.fire("moveend");
    }
  }, [lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layerRef.current?.remove();
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;
    const theme = getComputedStyle(containerRef.current ?? document.documentElement);
    const fill = `hsl(${theme.getPropertyValue("--foreground").trim()})`;
    const primary = `hsl(${theme.getPropertyValue("--primary").trim()})`;
    layout.zones.forEach((z, i) => {
      L.circleMarker([z.latitude, z.longitude], { radius: 5, color: primary, fillOpacity: 0.5 })
        .bindTooltip(`Zone ${i + 1}`).addTo(group);
    });
    layout.panels.forEach((panel, index) => {
      const polygon = L.polygon(panelCorners(panel), { color: panel.id === selectedId ? primary : fill, weight: panel.id === selectedId ? 3 : 1, fillColor: fill, fillOpacity: 0.75, bubblingMouseEvents: false });
      polygon.bindTooltip(`Panneau ${index + 1} · 1130 × 2095 mm`);
      polygon.on("click", () => { setSelectedId(panel.id); setZoneId(panel.zoneId); setRotation(panel.rotation); });
      polygon.addTo(group);
    });
    return () => { group.remove(); };
  }, [viewport?.panelLayout, selectedId]);

  const startDrawing = () => {
    setEditing(v => !v);
    if (layout.zones.length || lat == null || lng == null) return;
    const zone = { id: crypto.randomUUID(), latitude: lat, longitude: lng };
    publishLayout({ ...layout, zones: [zone] });
    setZoneId(zone.id);
  };
  const addZone = () => {
    const center = mapRef.current?.getCenter();
    if (!center) return;
    const zone = { id: crypto.randomUUID(), latitude: center.lat, longitude: center.lng };
    publishLayout({ ...layout, zones: [...layout.zones, zone] });
    setZoneId(zone.id); setSelectedId(null); setMode("add");
  };

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
        if ((lat == null || lng == null) && !restoredViewportRef.current) mapRef.current?.setView([coords[1], coords[0]], DEFAULT_ROOF_MAP_ZOOM);
      } catch { /* ignore */ }
    }, 600);
    return () => { clearTimeout(t); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const recenter = () => {
    if (lat != null && lng != null) mapRef.current?.panTo([lat, lng]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs sm:text-xs font-semibold text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {lat != null ? "Toiture repérée" : "Touchez la toiture concernée"}
        </span>
        {lat != null && (
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={recenter} aria-label="Recentrer">
              <Crosshair className="h-3 w-3" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null, null)} className="text-destructive" aria-label="Retirer le repère">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      <Button type="button" variant={editing ? "default" : "outline"} size="sm" onClick={startDrawing} disabled={lat == null || lng == null} className="w-full whitespace-normal h-auto min-h-9">
        <PencilRuler className="h-4 w-4 shrink-0" /> Dessiner les panneaux moi-même
      </Button>
      {editing && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={zoneId || layout.zones[0]?.id || ""} onValueChange={(id) => { setZoneId(id); setSelectedId(null); }}>
            <SelectTrigger aria-label="Zone de panneaux" className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{layout.zones.map((z, i) => <SelectItem key={z.id} value={z.id}>Zone {i + 1}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="button" variant="outline" size="icon" title="Nouvelle zone au centre de la carte" aria-label="Nouvelle zone" onClick={addZone}><MapPin className="h-4 w-4" /></Button>
          <Button type="button" variant={mode === "add" ? "default" : "outline"} size="icon" title="Ajouter un panneau" aria-label="Ajouter un panneau" onClick={() => { setMode("add"); setSelectedId(null); }}><Plus className="h-4 w-4" /></Button>
          <Button type="button" variant={mode === "move" ? "default" : "outline"} size="icon" title="Déplacer le panneau sélectionné" aria-label="Déplacer le panneau" disabled={!selectedId} onClick={() => setMode("move")}><Move className="h-4 w-4" /></Button>
          <Input type="number" min="0" max="359" step="1" aria-label="Rotation des panneaux en degrés" value={rotation} className="w-20 h-9" onChange={e => {
            const angle = ((Number(e.target.value) % 360) + 360) % 360;
            setRotation(angle);
            if (selectedId) publishLayout({ ...layout, panels: layout.panels.map(p => p.id === selectedId ? { ...p, rotation: angle } : p) });
          }} />
          <span className="text-xs text-muted-foreground">°</span>
          <Button type="button" variant="outline" size="icon" aria-label="Supprimer le panneau" title="Supprimer le panneau sélectionné" disabled={!selectedId} onClick={() => { publishLayout({ ...layout, panels: layout.panels.filter(p => p.id !== selectedId) }); setSelectedId(null); }}><Trash2 className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Retirer le dernier panneau" title="Retirer le dernier panneau" disabled={!layout.panels.length} onClick={() => { publishLayout({ ...layout, panels: layout.panels.slice(0, -1) }); setSelectedId(null); }}><Undo2 className="h-4 w-4" /></Button>
        </div>
      )}
      {(editing || layout.panels.length > 0) && <p className="text-xs font-semibold text-primary">{layout.panels.length} / {targetPanelCount} panneaux · 1,130 × 2,095 m</p>}
      <div className="rounded-sm border border-border overflow-hidden bg-muted">
        <div ref={containerRef} className="w-full h-56 sm:h-64" style={{ zIndex: 0 }} />
      </div>
      <p className="text-xs text-muted-foreground truncate">
        {geoError ? "Adresse introuvable — déplacez la carte manuellement" : address}
      </p>
    </div>
  );
}
