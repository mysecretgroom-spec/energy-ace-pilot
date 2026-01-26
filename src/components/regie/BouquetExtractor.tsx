import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  Sparkles,
  Check,
  X,
  Euro,
  Zap,
  AlertCircle,
} from "lucide-react";

interface ExtractedBouquet {
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
  prix_hejja: number;
  commission_fixe: number;
  commission_pct: number;
  description: string | null;
  selected?: boolean;
}

interface BouquetExtractorProps {
  regieId: string;
  userId: string;
  onBouquetsCreated: () => void;
}

export function BouquetExtractor({ regieId, userId, onBouquetsCreated }: BouquetExtractorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedBouquets, setExtractedBouquets] = useState<ExtractedBouquet[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG, WEBP ou PDF.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    setIsUploading(true);
    setFileName(file.name);
    setExtractedBouquets([]);

    try {
      // Create preview for images
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      // Convert to base64
      const base64 = await fileToBase64(file);
      
      setIsUploading(false);
      setIsExtracting(true);

      // Call extraction function
      const { data, error } = await supabase.functions.invoke("extract-bouquets", {
        body: {
          imageBase64: base64,
          mimeType: file.type,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      const bouquets = (data.bouquets || []).map((b: ExtractedBouquet) => ({
        ...b,
        selected: true,
      }));

      if (bouquets.length === 0) {
        toast.warning("Aucun bouquet détecté dans ce document");
      } else {
        setExtractedBouquets(bouquets);
        toast.success(`${bouquets.length} bouquet(s) détecté(s)`);
      }
    } catch (error) {
      console.error("Erreur extraction:", error);
      toast.error("Erreur lors de l'extraction");
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const toggleBouquet = (index: number) => {
    setExtractedBouquets((prev) =>
      prev.map((b, i) => (i === index ? { ...b, selected: !b.selected } : b))
    );
  };

  const updateBouquet = (index: number, field: keyof ExtractedBouquet, value: any) => {
    setExtractedBouquets((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  };

  const handleSave = async () => {
    const selectedBouquets = extractedBouquets.filter((b) => b.selected);
    if (selectedBouquets.length === 0) {
      toast.error("Sélectionnez au moins un bouquet");
      return;
    }

    setIsSaving(true);
    try {
      const inserts = selectedBouquets.map((b) => ({
        user_id: userId,
        regie_ids: [regieId], // Use array for the new unified bouquets table
        nom_bouquet: b.nom_bouquet,
        puissance_kwc: b.puissance_kwc,
        prix_recommande: b.prix_recommande,
        prix_max: b.prix_max,
        prix_hejja: b.prix_hejja,
        commission_fixe: b.commission_fixe,
        commission_pct: b.commission_pct,
        description: b.description,
        actif: true,
      }));

      const { error } = await supabase.from("bouquets").insert(inserts);

      if (error) throw error;

      toast.success(`${selectedBouquets.length} bouquet(s) créé(s)`);
      setExtractedBouquets([]);
      setPreviewUrl(null);
      setFileName(null);
      onBouquetsCreated();
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setExtractedBouquets([]);
    setPreviewUrl(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      {extractedBouquets.length === 0 && (
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {isUploading || isExtracting ? (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isExtracting ? "Analyse en cours avec Gemini..." : "Chargement..."}
                </p>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center justify-center py-6 gap-3 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="p-3 rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">Importer une grille tarifaire</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF ou image de la grille de prix et commissions
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileImage className="h-3 w-3" />
                    Image
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileText className="h-3 w-3" />
                    PDF
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview & Results */}
      {extractedBouquets.length > 0 && (
        <div className="space-y-3">
          {/* Header avec actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {extractedBouquets.filter((b) => b.selected).length} / {extractedBouquets.length} sélectionnés
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || extractedBouquets.filter((b) => b.selected).length === 0}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Créer
              </Button>
            </div>
          </div>

          {/* Info */}
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Vérifiez et corrigez les valeurs si nécessaire avant de créer les bouquets.
              </p>
            </CardContent>
          </Card>

          {/* Bouquets list */}
          {extractedBouquets.map((bouquet, index) => (
            <Card
              key={index}
              className={`transition-all ${
                bouquet.selected
                  ? "ring-2 ring-primary/50 bg-primary/5"
                  : "opacity-50"
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={bouquet.selected}
                    onCheckedChange={() => toggleBouquet(index)}
                    className="mt-1"
                  />
                  
                  <div className="flex-1 space-y-2">
                    <Input
                      value={bouquet.nom_bouquet}
                      onChange={(e) => updateBouquet(index, "nom_bouquet", e.target.value)}
                      className="h-8 font-medium"
                      placeholder="Nom du bouquet"
                    />
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          kWc
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={bouquet.puissance_kwc}
                          onChange={(e) =>
                            updateBouquet(index, "puissance_kwc", parseFloat(e.target.value) || 0)
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          Prix reco.
                        </label>
                        <Input
                          type="number"
                          value={bouquet.prix_recommande}
                          onChange={(e) =>
                            updateBouquet(index, "prix_recommande", parseFloat(e.target.value) || 0)
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground text-green-600 flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          Commission
                        </label>
                        <Input
                          type="number"
                          value={bouquet.commission_fixe}
                          onChange={(e) =>
                            updateBouquet(index, "commission_fixe", parseFloat(e.target.value) || 0)
                          }
                          className="h-7 text-xs border-green-500/30 focus:border-green-500"
                        />
                      </div>
                    </div>
                    
                    {bouquet.description && (
                      <p className="text-xs text-muted-foreground">{bouquet.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
