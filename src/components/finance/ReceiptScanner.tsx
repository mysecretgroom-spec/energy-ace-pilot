import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Camera, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface OCRResult {
  montant: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
}

const categories = [
  { value: "carburant", label: "Carburant" },
  { value: "peage", label: "Péage" },
  { value: "repas", label: "Repas" },
  { value: "hotel", label: "Hôtel" },
  { value: "parking", label: "Parking" },
  { value: "autre", label: "Autre" },
];

interface ReceiptScannerProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReceiptScanner({ onSuccess, onCancel }: ReceiptScannerProps) {
  const { user } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // Form state (editable after OCR)
  const [montant, setMontant] = useState<string>("");
  const [dateFrais, setDateFrais] = useState<string>(new Date().toISOString().split("T")[0]);
  const [categorie, setCategorie] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setImagePreview(base64);
      
      // Run OCR
      setScanning(true);
      try {
        const response = await supabase.functions.invoke("ocr-receipt", {
          body: { image_base64: base64 },
        });

        if (response.error) {
          toast.error("Erreur lors de l'analyse de l'image");
          console.error("OCR error:", response.error);
          return;
        }

        const result = response.data as OCRResult;
        setOcrResult(result);

        // Pre-fill form with OCR results
        if (result.montant) setMontant(result.montant.toString());
        if (result.date) setDateFrais(result.date);
        if (result.categorie) setCategorie(result.categorie);
        if (result.description) setDescription(result.description);

        toast.success("Facture analysée avec succès");
      } catch (err) {
        console.error("OCR error:", err);
        toast.error("Erreur lors de l'analyse");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!montant || !categorie) {
      toast.error("Montant et catégorie sont obligatoires");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("frais").insert({
        user_id: user.id,
        montant: parseFloat(montant),
        date_frais: dateFrais,
        categorie: categorie as "carburant" | "peage" | "repas" | "hotel" | "parking" | "autre",
        description: description || null,
        ocr_data: ocrResult as any,
        justificatif_url: imagePreview, // In production, upload to storage first
      });

      if (error) throw error;

      toast.success("Frais enregistré");
      onSuccess?.();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Scanner une facture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File input */}
        {!imagePreview && (
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              id="receipt-input"
            />
            <label
              htmlFor="receipt-input"
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <Camera className="h-12 w-12 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Prendre une photo ou sélectionner une image
              </span>
            </label>
          </div>
        )}

        {/* Image preview */}
        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Facture"
              className="w-full max-h-48 object-contain rounded-lg"
            />
            {scanning && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Analyse en cours...</span>
              </div>
            )}
          </div>
        )}

        {/* Form (shown after OCR or if user wants to fill manually) */}
        {(ocrResult || imagePreview) && !scanning && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="montant">Montant (€)</Label>
                <Input
                  id="montant"
                  type="number"
                  step="0.01"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFrais}
                  onChange={(e) => setDateFrais(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categorie">Catégorie</Label>
              <Select value={categorie} onValueChange={setCategorie}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description optionnelle"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-gradient-hero"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Enregistrer
              </Button>
              <Button variant="outline" onClick={onCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
