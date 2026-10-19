import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { renderRoofMapImage } from "@/lib/roofMapImage";
import type { RoofMapViewport } from "@/lib/roofMapViewport";
import { DEFAULT_ROOF_MAP_ZOOM } from "@/lib/roofMapViewport";
import { fetchLatestAiVisuals, panelPixelSize, type AiVisuals } from "@/lib/roofAiVisuals";
import { PV_INSTALLATIONS, pvPlacementPayload, type PvInstallationType } from "@/lib/pvInstallation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cropRoofAiTarget, isRoofAiTargetVisible, roofAiTarget } from "@/lib/roofAiTarget";
import { renderSatellitePanels } from "@/lib/satellitePanelOverlay";

interface Props {
  clientId?: string | null;
  etudeId?: string | null;
  lat: number | null;
  lng: number | null;
  viewport?: RoofMapViewport;
  puissanceKwc: number | string;
}

const b64ToBlob = (b64: string) => {
  const bin = atob(b64.replace(/^data:[^,]+,/, ""));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: "image/png" });
};

const imgWidth = (src: string) =>
  new Promise<number>((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res(0); i.src = src; });

/** Visualisation IA (vue satellite + photo d'étude), jointe à l'annexe carte du PDF. */
export function RoofAiVisualization({ clientId, etudeId, lat, lng, viewport, puissanceKwc }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [visuals, setVisuals] = useState<AiVisuals | null>(null);
  const [installationType, setInstallationType] = useState<PvInstallationType>("toiture");
  const [surfaceConstraint, setSurfaceConstraint] = useState("");
  const nbPanneaux = Math.ceil((Number(puissanceKwc) || 0) / 0.5);

  useEffect(() => {
    if (etudeId) fetchLatestAiVisuals(etudeId).then(setVisuals).catch(() => undefined);
  }, [etudeId]);

  const save = async (b64: string, source: string, label: string) => {
    if (!user || !clientId || !etudeId) return;
    const blob = b64ToBlob(b64);
    const path = `${user.id}/${clientId}/${source}_${Date.now()}.png`;
    const { error } = await supabase.storage.from("documents").upload(path, blob, { contentType: "image/png" });
    if (error) throw error;
    const { data: u } = supabase.storage.from("documents").getPublicUrl(path);
    const { error: e2 } = await supabase.from("documents").insert({
      user_id: user.id, client_id: clientId, etude_id: etudeId,
      nom: `Visualisation IA ${label} - ${new Date().toLocaleDateString("fr-FR")}.png`,
      type_document: "photo_toiture", context_source: source, url: u.publicUrl,
      taille_bytes: blob.size, mime_type: "image/png",
      metadata: { nb_panneaux: nbPanneaux, panel_mm: "1130x2095", installation_type: installationType, surface_constraint: surfaceConstraint.trim(), target_latitude: lat, target_longitude: lng },
    });
    if (e2) throw e2;
  };

  const run = async () => {
    if (!user || !clientId || !etudeId || lat == null || lng == null) return;
    setLoading(true);
    const errors: string[] = [];
    try {
      // 1. Vue satellite (même cadrage que la carte)
      const targetPoint = roofAiTarget(lat, lng, viewport);
      if (!isRoofAiTargetVisible(targetPoint)) throw new Error("Le point rouge est hors de la carte. Recentrez la toiture sélectionnée avant de générer.");
      const sat = await renderRoofMapImage(lat, lng, { viewport });
      if (!sat) throw new Error("Carte de la zone désignée indisponible.");
      const targetRoofBase64 = await cropRoofAiTarget(sat, targetPoint);
      const placement = { ...pvPlacementPayload(installationType, surfaceConstraint, sat), targetPoint, targetRoofBase64 };
      if (sat) {
        // Placement exact (pan désigné + nombre de panneaux) : dessin calculé, pas d'IA générative.
        const w = await imgWidth(sat);
        const zoom = viewport?.zoom ?? DEFAULT_ROOF_MAP_ZOOM;
        const px = panelPixelSize(viewport?.centerLatitude ?? lat, zoom, viewport?.width ?? 360, w || 360);
        try {
          const drawn = await renderSatellitePanels(sat, targetPoint, px, nbPanneaux);
          await save(drawn, "simulation_ia_satellite", "satellite");
        } catch { errors.push("vue satellite"); }
      }
      // 2. Photo d'étude (dernière photo toiture réelle)
      const { data: photos } = await supabase
        .from("documents").select("url, context_source")
        .eq("client_id", clientId).eq("etude_id", etudeId).eq("type_document", "photo_toiture")
        .order("created_at", { ascending: false }).limit(20);
      const src = photos?.find((p) => !p.context_source || p.context_source === "photo_toiture");
      if (src?.url) {
        const { data, error } = await supabase.functions.invoke("simulate-pv-roof", {
          body: { ...placement, imageUrl: src.url, nbPanneaux, view: "photo" },
        });
        if (error || !data?.image) errors.push("photo d'étude");
        else await save(data.image, "simulation_ia_photo", "photo");
      } else errors.push("photo d'étude (aucune photo toiture)");
      setVisuals(await fetchLatestAiVisuals(etudeId));
      toast(errors.length
        ? { variant: "destructive", title: "Visualisation partielle", description: `Non générée : ${errors.join(", ")}.` }
        : { title: "Visualisation IA prête", description: `${nbPanneaux} panneaux — jointe à l'annexe du PDF.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Visualisation impossible", description: e instanceof Error ? e.message : "Réessayez." });
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || !etudeId || !clientId || lat == null || lng == null || nbPanneaux < 1;

  return (
    <div className="space-y-2">
      <Select value={installationType} onValueChange={(value) => { const type = PV_INSTALLATIONS.find((item) => item.value === value); if (type) setInstallationType(type.value); }} disabled={loading}>
        <SelectTrigger aria-label="Type de pose sur la zone repérée"><SelectValue /></SelectTrigger>
        <SelectContent>{PV_INSTALLATIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
      <Textarea aria-label="Zone photographiée correspondant au repère" placeholder="Zone photographiée : ex. toit du garage, terrasse pour pergola…" maxLength={1500} value={surfaceConstraint} onChange={(event) => setSurfaceConstraint(event.target.value)} disabled={loading} className="min-h-[60px] text-sm" />
      <Button type="button" variant="outline" size="sm" onClick={run} disabled={disabled} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Génération en cours…" : `Visualisation IA (${nbPanneaux || 0} panneaux)`}
      </Button>
      {(visuals?.satellite || visuals?.photo) && (
        <div className="grid grid-cols-2 gap-2">
          {[{ u: visuals.satellite, l: "Satellite" }, { u: visuals.photo, l: "Photo étude" }].map((v) => (
            <div key={v.l} className="space-y-1">
              {v.u ? (
                <div className="relative">
                  <img src={v.u} alt={`Visualisation IA ${v.l}`} className="w-full rounded-md border border-border object-cover aspect-video" />
                  <span aria-label="Visuel généré par IA" className="absolute right-1.5 top-1.5 rounded bg-foreground/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-background">IA</span>
                </div>
              )
                : <div className="aspect-video rounded-md border border-dashed border-border" />}
              <p className="text-[10px] text-muted-foreground">{v.l} — généré par IA</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
