import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface RoofPvSimulationButtonProps {
  clientId: string;
  etudeId?: string | null;
  /** Puissance de l'étude en kWc : sert à déduire le nombre de panneaux (500 Wc / panneau) */
  puissanceKwc?: number | string | null;
  onSimulationSaved?: () => void;
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
}: RoofPvSimulationButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const nbPanneaux = Math.ceil((Number(puissanceKwc) || 0) / 0.5);

  const handleSimulate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Dernière photo de toiture (hors simulations et PDF fusionné)
      const { data: photos, error } = await supabase
        .from("documents")
        .select("id, url, nom, context_source")
        .eq("client_id", clientId)
        .eq("type_document", "photo_toiture")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      const source = (photos || []).find(
        (p) => p.context_source !== "simulation_pv" && p.context_source !== "merged_photos"
      );

      if (!source?.url) {
        toast({
          variant: "destructive",
          title: "Aucune photo de toiture",
          description: "Prenez d'abord une photo du toit.",
        });
        return;
      }

      // 2. Génération IA
      const { data, error: fnError } = await supabase.functions.invoke("simulate-pv-roof", {
        body: { imageUrl: source.url, nbPanneaux },
      });

      if (fnError || !data?.image) {
        throw new Error(data?.error || fnError?.message || "Génération impossible");
      }

      const blob = base64ToBlob(data.image);
      const objectUrl = URL.createObjectURL(blob);
      setPreview(objectUrl);

      // 3. Enregistrement comme photo supplémentaire (l'originale est conservée)
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
        nom: `Simulation panneaux (IA) - ${new Date().toLocaleDateString("fr-FR")}.png`,
        type_document: "photo_toiture",
        context_source: "simulation_pv",
        url: urlData.publicUrl,
        taille_bytes: blob.size,
        mime_type: "image/png",
      });
      if (insertError) throw insertError;

      toast({
        title: "Simulation générée",
        description: `${nbPanneaux || "Plusieurs"} panneaux posés sur le toit. Le rendu sera joint au rapport.`,
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
        size="sm"
        onClick={handleSimulate}
        disabled={loading}
        className="h-8 gap-1.5 text-[11px]"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Simuler les panneaux
      </Button>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Simulation — {nbPanneaux} panneaux
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <img
              src={preview}
              alt={`Simulation de ${nbPanneaux} panneaux solaires sur la toiture`}
              className="w-full rounded-sm border border-border"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
