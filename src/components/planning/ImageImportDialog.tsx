import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Camera, Loader2, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MediaPreview } from "@/components/documents/MediaPreview";

export interface ExtractedRdvData {
  nom: string | null;
  prenom: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  date: string | null;
  heure: string | null;
  type_projet: string | null;
  notes: string | null;
  confidence: number;
  regie_id: string;
}

interface ImageImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (data: ExtractedRdvData) => void;
  defaultRegieId?: string;
}

interface RegieOption {
  id: string;
  nom: string;
  couleur: string | null;
}

// Compress image client-side: max 1200px, JPEG quality 0.7
async function compressImage(file: File): Promise<string> {
  const MAX_DIM = 1200;
  const QUALITY = 0.7;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const r = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        canvas.width = 0;
        canvas.height = 0;
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("File read failed"));
    reader.readAsDataURL(file);
  });
}

export function ImageImportDialog({
  open,
  onOpenChange,
  onExtracted,
  defaultRegieId,
}: ImageImportDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [regies, setRegies] = useState<RegieOption[]>([]);
  const [selectedRegieId, setSelectedRegieId] = useState<string>(defaultRegieId || "");
  const [previews, setPreviews] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from("regies")
      .select("id, nom, couleur")
      .eq("user_id", user.id)
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => {
        if (data) setRegies(data);
        if (data && data.length === 1 && !selectedRegieId) {
          setSelectedRegieId(data[0].id);
        }
      });
  }, [open, user]);

  useEffect(() => {
    if (!open) {
      setPreviews([]);
      setAnalyzing(false);
    }
  }, [open]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, 5);
    try {
      const compressed = await Promise.all(arr.map(compressImage));
      setPreviews(compressed);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors du chargement de l'image");
    }
  };

  const removePreview = (idx: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAnalyze = async () => {
    if (!selectedRegieId) {
      toast.error("Sélectionnez une régie");
      return;
    }
    if (previews.length === 0) {
      toast.error("Ajoutez au moins une image");
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-rdv-from-image", {
        body: {
          images: previews.map((p) => ({ data: p })),
        },
      });

      if (error) {
        const ctx = (error as { context?: { status?: number } }).context;
        if (ctx?.status === 429) {
          toast.error("Trop de requêtes IA. Réessayez dans un instant.");
        } else if (ctx?.status === 402) {
          toast.error("Crédits IA épuisés. Rechargez votre espace de travail.");
        } else {
          toast.error("Erreur lors de l'analyse");
        }
        return;
      }

      if (!data?.success || !data?.data) {
        toast.error(data?.message || "Aucune information extraite");
        return;
      }

      // New API returns { rdvs: [...], confidence, rdv }
      // Backward-compat: also accept the old single-object shape
      const rdvs = Array.isArray(data.data.rdvs) ? data.data.rdvs : null;
      const extracted = rdvs && rdvs.length > 0 ? rdvs[0] : data.data.rdv || data.data;

      if (!extracted || (typeof extracted === "object" && !extracted.nom && !extracted.date)) {
        toast.error("Aucun rendez-vous identifié dans l'image");
        return;
      }

      if (rdvs && rdvs.length > 1) {
        toast.info(`${rdvs.length} RDV détectés — le premier est pré-rempli (les autres seront ignorés ici).`);
      } else if ((extracted.confidence ?? 0) < 0.4) {
        toast.warning("Extraction peu fiable, vérifiez les champs");
      } else {
        toast.success("Informations extraites ✨");
      }

      onExtracted({ ...extracted, regie_id: selectedRegieId });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de l'analyse");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Importer un RDV depuis une image
          </DialogTitle>
          <DialogDescription>
            Capture d'écran d'un CRM, email, SMS… L'IA extrait les infos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Régie */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Régie <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedRegieId} onValueChange={setSelectedRegieId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une régie" />
              </SelectTrigger>
              <SelectContent>
                {regies.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: r.couleur || "#888" }}
                      />
                      {r.nom}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {regies.length === 0 && (
              <p className="text-xs text-destructive">Aucune régie configurée</p>
            )}
          </div>

          {/* Upload */}
          <div className="space-y-2">
            <Label>Images ({previews.length}/5)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={analyzing}
            >
              <Upload className="h-4 w-4 mr-2" />
              {previews.length === 0 ? "Choisir / Prendre une photo" : "Remplacer"}
            </Button>

            {previews.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                    <Button variant="ghost" className="p-0 w-full h-full" aria-label={`Aperçu de la photo ${idx + 1}`} onClick={() => setPreviewIndex(idx)}><img src={src} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" /></Button>
                    <button
                      type="button"
                      onClick={() => removePreview(idx)}
                      className={cn(
                        "absolute top-1 right-1 bg-background/80 backdrop-blur",
                        "rounded-full p-1 hover:bg-background transition"
                      )}
                      disabled={analyzing}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={analyzing}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || previews.length === 0 || !selectedRegieId}
              className="flex-1"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extraire
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
      <MediaPreview isOpen={previewIndex !== null} onClose={() => setPreviewIndex(null)} initialIndex={previewIndex ?? 0} items={previews.map((url, i) => ({ id: `photo-${i}`, nom: `Photo ${i + 1}`, url, mime_type: "image/jpeg" }))} />
    </Dialog>
  );
}
