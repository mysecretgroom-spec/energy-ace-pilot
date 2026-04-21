import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileImage,
  FileText,
  Loader2,
  Sparkles,
  Check,
  X,
  Euro,
  AlertCircle,
} from "lucide-react";

type ProductType = "PV" | "PAC" | "ITE";

interface ExtractedSurcout {
  categorie: string;
  code: string;
  nom: string;
  prix: number;
  type_calcul: "fixe" | "par_panneau" | "par_m2" | "par_ml";
  selected?: boolean;
}

interface SurcoutsExtractorProps {
  regieId: string;
  userId: string;
  productType: ProductType;
  onSurcoutsCreated: () => void;
}

const categoriesByProduct: Record<ProductType, { value: string; label: string }[]> = {
  PV: [
    { value: "support", label: "Support d'installation" },
    { value: "emplacement_boitier", label: "Emplacement boîtier" },
    { value: "compteur", label: "Type de compteur" },
  ],
  PAC: [
    { value: "type_pac", label: "Type de PAC" },
    { value: "installation", label: "Installation" },
    { value: "accessoires", label: "Accessoires" },
  ],
  ITE: [
    { value: "finition", label: "Type de finition" },
    { value: "complexite", label: "Complexité chantier" },
    { value: "accessoires_ite", label: "Accessoires" },
  ],
};

const typeCalcLabels: Record<string, string> = {
  fixe: "Forfait fixe",
  par_panneau: "Par panneau",
  par_m2: "Par m²",
  par_ml: "Par ml",
};

export function SurcoutsExtractor({
  regieId,
  userId,
  productType,
  onSurcoutsCreated,
}: SurcoutsExtractorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedSurcout[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG, WEBP ou PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    setIsUploading(true);
    setExtracted([]);

    try {
      const base64 = await fileToBase64(file);
      setIsUploading(false);
      setIsExtracting(true);

      const { data, error } = await supabase.functions.invoke("extract-surcouts", {
        body: { imageBase64: base64, mimeType: file.type, productType },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const surcouts = (data.surcouts || []).map((s: ExtractedSurcout) => ({
        ...s,
        selected: true,
      }));

      if (surcouts.length === 0) {
        toast.warning("Aucun surcoût détecté");
      } else {
        setExtracted(surcouts);
        toast.success(`${surcouts.length} surcoût(s) détecté(s)`);
      }
    } catch (err) {
      console.error("Erreur extraction surcouts:", err);
      toast.error("Erreur lors de l'extraction");
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleSel = (i: number) =>
    setExtracted((prev) => prev.map((s, idx) => (idx === i ? { ...s, selected: !s.selected } : s)));

  const update = (i: number, field: keyof ExtractedSurcout, value: any) =>
    setExtracted((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));

  const handleSave = async () => {
    const selected = extracted.filter((s) => s.selected);
    if (selected.length === 0) {
      toast.error("Sélectionnez au moins un surcoût");
      return;
    }

    setIsSaving(true);
    try {
      const inserts = selected.map((s) => ({
        user_id: userId,
        regie_id: regieId,
        categorie: s.categorie,
        code: s.code.toLowerCase().replace(/\s+/g, "_"),
        nom: s.nom,
        prix: s.prix,
        type_calcul: s.type_calcul,
        actif: true,
      }));

      const { error } = await supabase.from("regies_surcouts").insert(inserts);
      if (error) throw error;

      toast.success(`${selected.length} surcoût(s) créé(s)`);
      setExtracted([]);
      onSurcoutsCreated();
    } catch (err) {
      console.error("Erreur sauvegarde surcouts:", err);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const cats = categoriesByProduct[productType];

  return (
    <div className="space-y-3">
      {extracted.length === 0 && (
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
              <div className="flex flex-col items-center justify-center py-4 gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {isExtracting ? "Analyse IA en cours..." : "Chargement..."}
                </p>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center py-4 gap-2 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="p-2.5 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">Importer une grille de surcoûts par IA</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    PDF ou image — extraction automatique
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileImage className="h-3 w-3" /> Image
                  </Badge>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <FileText className="h-3 w-3" /> PDF
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {extracted.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {extracted.filter((s) => s.selected).length} / {extracted.length} sélectionnés
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExtracted([])}>
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || extracted.filter((s) => s.selected).length === 0}
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

          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Vérifiez catégories et prix avant de créer.
              </p>
            </CardContent>
          </Card>

          {extracted.map((s, index) => (
            <Card
              key={index}
              className={`transition-all ${
                s.selected ? "ring-2 ring-primary/50 bg-primary/5" : "opacity-50"
              }`}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={s.selected}
                    onCheckedChange={() => toggleSel(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <Input
                      value={s.nom}
                      onChange={(e) => update(index, "nom", e.target.value)}
                      className="h-8 font-medium"
                      placeholder="Nom"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground">Catégorie</label>
                        <select
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={s.categorie}
                          onChange={(e) => update(index, "categorie", e.target.value)}
                        >
                          {cats.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Code</label>
                        <Input
                          value={s.code}
                          onChange={(e) => update(index, "code", e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Euro className="h-3 w-3" />
                          Prix
                        </label>
                        <Input
                          type="number"
                          value={s.prix}
                          onChange={(e) => update(index, "prix", parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground">Type calcul</label>
                        <select
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={s.type_calcul}
                          onChange={(e) => update(index, "type_calcul", e.target.value as any)}
                        >
                          {Object.entries(typeCalcLabels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
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
