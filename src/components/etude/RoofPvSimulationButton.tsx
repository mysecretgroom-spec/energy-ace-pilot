import { useState } from "react";
import { MediaPreview } from "@/components/documents/MediaPreview";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { renderRoofMapImage } from "@/lib/roofMapImage";
import { cropRoofAiTarget, isRoofAiTargetVisible, roofAiTarget } from "@/lib/roofAiTarget";
import { pvPlacementPayload } from "@/lib/pvInstallation";
import type { RoofMapViewport } from "@/lib/roofMapViewport";

interface RoofPvSimulationButtonProps {
  clientId: string;
  etudeId?: string | null;
  /** Puissance de l'étude en kWc : sert à déduire le nombre de panneaux (500 Wc / panneau) */
  puissanceKwc?: number | string | null;
  onSimulationSaved?: () => void;
  lat?: number | null;
  lng?: number | null;
  viewport?: RoofMapViewport;
}

function base64ToBlob(b64: string, mime = "image/png"): Blob {
  const byteChars = atob(b64);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < byteChars.length; i += 8192) {
    const slice = byteChars.slice(i, i + 8192);
    const bytes = new Uint8Array(slice.length);
    for (let j = 0; j < slice.length; j++) bytes[j] = slice.charCodeAt(j);
    chunks.push(bytes);
  }
  return new Blob(chunks as unknown as BlobPart[], { type: mime });
}

const BASE_MANDATORY_CONSTRAINT =
  "Respecter strictement les rives et les bordures du toit : les panneaux ne doivent NI dépasser NI recouvrir les gouttières, lucarnes, cheminées ou tout autre élément de rive. Cette consigne est obligatoire et constante.";

const PRESET_CONSTRAINTS = [
  { label: "Tuiles uniquement", value: "Poser les panneaux UNIQUEMENT sur le pan de toiture en tuiles désigné par le centre du point rouge, même si c’est une annexe ou un garage." },
];

type InstallationType = "toiture" | "carport_bois" | "carport_alu" | "bac_leste";

const INSTALLATION_TYPES: { value: InstallationType; label: string }[] = [
  { value: "toiture", label: "Toiture" },
  { value: "carport_bois", label: "Carport bois" },
  { value: "carport_alu", label: "Carport alu" },
  { value: "bac_leste", label: "Bac lesté (GSE)" },
];

const INSTALLATION_LABELS: Record<InstallationType, string> = {
  toiture: "Toiture",
  carport_bois: "Carport bois",
  carport_alu: "Carport aluminium",
  bac_leste: "Bacs lestés (GSE)",
};

/**
 * Génère, à partir de la dernière photo de toiture, un photomontage IA
 * avec le nombre de panneaux calculé dans l'étude.
 * La photo d'origine est conservée : le rendu est ajouté comme photo supplémentaire
 * et se retrouve donc automatiquement dans le PDF du rapport.
 */
export function RoofPvSimulationButton({
  clientId,
  etudeId,
  puissanceKwc,
  onSimulationSaved,
  lat,
  lng,
  viewport,
}: RoofPvSimulationButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [constraintOpen, setConstraintOpen] = useState(false);
  const [surfaceConstraint, setSurfaceConstraint] = useState("");
  const [installationType, setInstallationType] = useState<InstallationType>("toiture");
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const nbPanneaux = Math.ceil((Number(puissanceKwc) || 0) / 0.5);

  const loadSourcePhoto = async () => {
    const { data: photos, error } = await supabase
      .from("documents")
      .select("id, url, nom, context_source")
      .eq("client_id", clientId)
      .eq("etude_id", etudeId ?? "")
      .eq("type_document", "photo_toiture")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;
    const source = (photos || []).find(
      (p) => !p.context_source || p.context_source === "photo_toiture"
    );

    if (!source?.url) {
      toast({
        variant: "destructive",
        title: "Aucune photo de toiture",
        description: "Prenez d'abord une photo du toit.",
      });
      return null;
    }
    return source.url;
  };

  const startSimulationFlow = async () => {
    if (!user) return;
    if (!etudeId || lat == null || lng == null) {
      toast({ variant: "destructive", title: "Toiture à repérer", description: "Enregistrez l’étude et placez le point rouge sur la toiture concernée." });
      return;
    }
    const url = await loadSourcePhoto();
    if (!url) return;
    setSourceUrl(url);
    setSurfaceConstraint("");
    setInstallationType("toiture");
    setConstraintOpen(true);
  };

  const buildConstraint = () =>
    [installationType === "toiture" ? BASE_MANDATORY_CONSTRAINT : "", surfaceConstraint.trim()]
      .filter(Boolean)
      .join(" ");

  const runGeneration = async () => {
    if (!user || !sourceUrl || lat == null || lng == null) return;
    setConstraintOpen(false);
    setLoading(true);
    try {
      const combinedConstraint = buildConstraint();
      const targetPoint = roofAiTarget(lat, lng, viewport);
      if (!isRoofAiTargetVisible(targetPoint)) throw new Error("Recentrez la carte sur le point rouge avant de générer.");
      const satellite = await renderRoofMapImage(lat, lng, { viewport });
      if (!satellite) throw new Error("Carte de la toiture indisponible.");
      const targetRoofBase64 = await cropRoofAiTarget(satellite, targetPoint);
      const { data, error: fnError } = await supabase.functions.invoke("simulate-pv-roof", {
        body: { ...pvPlacementPayload(installationType, combinedConstraint, satellite), imageUrl: sourceUrl, nbPanneaux, targetPoint, targetRoofBase64, view: "photo" },
      });

      if (fnError || !data?.image) {
        throw new Error(data?.error || fnError?.message || "Génération impossible");
      }

      const blob = base64ToBlob(data.image);
      const objectUrl = URL.createObjectURL(blob);
      setPreview(objectUrl);

      // Enregistrement comme photo supplémentaire (l'originale est conservée)
      const path = `${user.id}/${clientId}/simulation_pv_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, blob, { contentType: "image/png", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: user.id,
        client_id: clientId,
        etude_id: etudeId || null,
        nom: `Simulation ${INSTALLATION_LABELS[installationType]} (IA) - ${new Date().toLocaleDateString("fr-FR")}.png`,
        type_document: "photo_toiture",
        context_source: "simulation_pv",
        url: urlData.publicUrl,
        taille_bytes: blob.size,
        mime_type: "image/png",
        metadata: {
          surface_constraint: buildConstraint(),
          nb_panneaux: nbPanneaux,
          installation_type: installationType,
        },
      });
      if (insertError) throw insertError;

      toast({
        title: "Simulation générée",
        description: `${nbPanneaux || "Plusieurs"} panneaux — ${INSTALLATION_LABELS[installationType]}. Le rendu sera joint au rapport.`,
      });
      onSimulationSaved?.();
    } catch (err) {
      console.error("[RoofPvSimulationButton]", err);
      toast({
        variant: "destructive",
        title: "Simulation impossible",
        description: err instanceof Error ? err.message : "Réessayez dans un instant.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={startSimulationFlow}
        disabled={loading}
        aria-label="Simuler les panneaux"
        title="Simuler les panneaux"
        className="h-8 w-8"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      </Button>

      <Dialog open={constraintOpen} onOpenChange={setConstraintOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Type de pose et zone autorisée
            </DialogTitle>
            <DialogDescription className="text-xs">
              {installationType === "toiture"
                ? "La consigne « sans dépasser les rives » est appliquée automatiquement. Précisez une zone de pose supplémentaire si besoin."
                : "Le support sera généré dans la photo. Précisez son emplacement si besoin."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type d'installation</Label>
              <div className="grid grid-cols-2 gap-2">
                {INSTALLATION_TYPES.map((t) => (
                  <Button
                    key={t.value}
                    type="button"
                    variant={installationType === t.value ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setInstallationType(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
            {installationType === "toiture" && (
              <div className="flex flex-wrap gap-2">
                {PRESET_CONSTRAINTS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setSurfaceConstraint(preset.value)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="surface-constraint" className="text-xs">
                Consigne (facultative)
              </Label>
              <Textarea
                id="surface-constraint"
                value={surfaceConstraint}
                onChange={(e) => setSurfaceConstraint(e.target.value)}
                placeholder="Ex. : poser les panneaux uniquement sur le pan de tuiles visible à gauche, pas sur l’extension plate."
                className="min-h-[80px] text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConstraintOpen(false)}>
                Annuler
              </Button>
              <Button type="button" size="sm" onClick={runGeneration} disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Générer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaPreview isOpen={!!preview} onClose={() => setPreview(null)}
        items={preview ? [{ id: "simulation", nom: `Simulation IA — ${nbPanneaux} panneaux — non contractuelle`, url: preview, mime_type: "image/png" }, ...(sourceUrl ? [{ id: "source", nom: "Photo d’origine", url: sourceUrl, mime_type: "image/jpeg" }] : [])] : []} />
    </>
  );
}
