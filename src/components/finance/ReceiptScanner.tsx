import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Camera, Loader2, Check, X, Receipt, Building2, Calendar, Euro, FileText, CarFront } from "lucide-react";
import { toast } from "sonner";
import * as pdfjsLib from "pdfjs-dist";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Helper to upload file to storage
async function uploadReceiptToStorage(
  base64Data: string,
  userId: string,
  isPdf: boolean
): Promise<string> {
  const timestamp = Date.now();
  const extension = isPdf ? "pdf" : "jpg";
  const contentType = isPdf ? "application/pdf" : "image/jpeg";
  const fileName = `frais/${userId}/${timestamp}.${extension}`;

  // Convert base64 to blob
  const base64Response = await fetch(base64Data);
  const blob = await base64Response.blob();

  const { data, error } = await supabase.storage
    .from("receipts")
    .upload(fileName, blob, {
      contentType,
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  // Get signed URL (1 year validity)
  const { data: urlData } = await supabase.storage
    .from("receipts")
    .createSignedUrl(fileName, 60 * 60 * 24 * 365);

  if (!urlData?.signedUrl) {
    throw new Error("Failed to generate receipt URL");
  }

  return urlData.signedUrl;
}

interface OCRResult {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  commercant: string | null;
}

const categories = [
  { value: "carburant", label: "Carburant" },
  { value: "peage", label: "Péage" },
  { value: "repas", label: "Repas" },
  { value: "hotel", label: "Hôtel" },
  { value: "parking", label: "Parking" },
  { value: "train", label: "Trains" },
  { value: "location_vehicule", label: "Location Véhicule" },
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
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  // Form state (editable after OCR)
  const [montantTTC, setMontantTTC] = useState<string>("");
  const [montantHT, setMontantHT] = useState<string>("");
  const [tva, setTva] = useState<string>("");
  const [tauxTva, setTauxTva] = useState<string>("");
  const [dateFrais, setDateFrais] = useState<string>(new Date().toISOString().split("T")[0]);
  const [categorie, setCategorie] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [commercant, setCommercant] = useState<string>("");
  // Rental period fields (for location_vehicule)
  const [dateDebut, setDateDebut] = useState<string>("");
  const [dateFin, setDateFin] = useState<string>("");

  // Convert PDF to image using PDF.js
  const convertPdfToImage = async (pdfDataUrl: string): Promise<string> => {
    const pdfData = atob(pdfDataUrl.split(",")[1]);
    const pdfArray = new Uint8Array(pdfData.length);
    for (let i = 0; i < pdfData.length; i++) {
      pdfArray[i] = pdfData.charCodeAt(i);
    }

    const loadingTask = pdfjsLib.getDocument({ data: pdfArray });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1); // Get first page

    const scale = 2; // Higher scale for better OCR
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    return canvas.toDataURL("image/png");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdfFile = file.type === "application/pdf";

    // Convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      let imageForOcr = base64;

      // If PDF, show PDF preview and convert first page to image for OCR
      if (isPdfFile) {
        setPdfPreview(base64);
        setImagePreview(null);
        setScanning(true);
        try {
          imageForOcr = await convertPdfToImage(base64);
        } catch (err) {
          console.error("PDF conversion error:", err);
          toast.error("Erreur lors de la conversion du PDF");
          setScanning(false);
          return;
        }
      } else {
        setImagePreview(base64);
        setPdfPreview(null);
        setScanning(true);
      }

      // Run OCR
      try {
        const response = await supabase.functions.invoke("ocr-receipt", {
          body: { image_base64: imageForOcr },
        });

        if (response.error) {
          toast.error("Erreur lors de l'analyse de l'image");
          console.error("OCR error:", response.error);
          return;
        }

        const result = response.data as OCRResult;
        setOcrResult(result);

        // Pre-fill form with OCR results
        if (result.montant_ttc) setMontantTTC(result.montant_ttc.toString());
        if (result.montant_ht) setMontantHT(result.montant_ht.toString());
        if (result.tva) setTva(result.tva.toString());
        if (result.taux_tva) setTauxTva(result.taux_tva.toString());
        if (result.date) setDateFrais(result.date);
        if (result.categorie) setCategorie(result.categorie);
        if (result.description) setDescription(result.description);
        if (result.commercant) setCommercant(result.commercant);

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
    if (!montantTTC || !categorie) {
      toast.error("Montant TTC et catégorie sont obligatoires");
      return;
    }

    // Must have either image or PDF
    if (!imagePreview && !pdfPreview) {
      toast.error("Aucun justificatif à enregistrer");
      return;
    }

    setSaving(true);
    try {
      // Upload receipt to storage (not base64 in DB)
      const fileToUpload = pdfPreview || imagePreview!;
      const isPdf = !!pdfPreview;
      const receiptUrl = await uploadReceiptToStorage(fileToUpload, user.id, isPdf);

      const insertData: any = {
        user_id: user.id,
        montant: parseFloat(montantTTC),
        date_frais: dateFrais,
        categorie: categorie as "carburant" | "peage" | "repas" | "hotel" | "parking" | "train" | "location_vehicule" | "autre",
        description: commercant ? `${commercant} - ${description}` : description || null,
        ocr_data: {
          ...ocrResult,
          montant_ttc: parseFloat(montantTTC) || null,
          montant_ht: montantHT ? parseFloat(montantHT) : null,
          tva: tva ? parseFloat(tva) : null,
          taux_tva: tauxTva ? parseFloat(tauxTva) : null,
        },
        justificatif_url: receiptUrl,
      };
      
      // Add rental period for location_vehicule
      if (categorie === "location_vehicule") {
        if (dateDebut) insertData.date_debut = dateDebut;
        if (dateFin) insertData.date_fin = dateFin;
      }
      
      const { error } = await supabase.from("frais").insert(insertData);

      if (error) throw error;

      toast.success("Frais enregistré avec justificatif");
      onSuccess?.();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // Calculate TVA from TTC if rate is known
  const calculateFromTTC = (ttcValue: string, rate: string) => {
    const ttc = parseFloat(ttcValue);
    const tauxDecimal = parseFloat(rate) / 100;
    if (!isNaN(ttc) && !isNaN(tauxDecimal) && tauxDecimal > 0) {
      const ht = ttc / (1 + tauxDecimal);
      const tvaCalc = ttc - ht;
      setMontantHT(ht.toFixed(2));
      setTva(tvaCalc.toFixed(2));
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
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
              id="receipt-input"
            />
            <label
              htmlFor="receipt-input"
              className="flex flex-col items-center gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Camera className="h-10 w-10 text-muted-foreground" />
                <FileText className="h-10 w-10 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">
                Photo, image ou PDF
              </span>
              <span className="text-xs text-muted-foreground/70">
                Formats acceptés : JPG, PNG, PDF
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
                <span className="ml-2">Analyse IA en cours...</span>
              </div>
            )}
          </div>
        )}

        {/* PDF preview */}
        {pdfPreview && (
          <div className="relative">
            <iframe
              src={pdfPreview}
              title="Facture PDF"
              className="w-full h-48 rounded-lg border"
            />
            {scanning && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Analyse IA en cours...</span>
              </div>
            )}
          </div>
        )}

        {/* OCR Results Summary */}
        {ocrResult && !scanning && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Receipt className="h-4 w-4 text-primary" />
              Informations détectées par l'IA
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {ocrResult.commercant && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  {ocrResult.commercant}
                </div>
              )}
              {ocrResult.date && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {new Date(ocrResult.date).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form (shown after OCR or if user wants to fill manually) */}
        {(ocrResult || imagePreview || pdfPreview) && !scanning && (
          <div className="space-y-4">
            {/* Commercant */}
            <div className="space-y-2">
              <Label htmlFor="commercant" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                Commerçant / Enseigne
              </Label>
              <Input
                id="commercant"
                value={commercant}
                onChange={(e) => setCommercant(e.target.value)}
                placeholder="Ex: Total, Sodexo, Ibis..."
              />
            </div>

            {/* Montants TTC / HT / TVA */}
            <div className="bg-muted/30 rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Euro className="h-4 w-4 text-primary" />
                Montants
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="montantTTC" className="text-xs">
                    Montant TTC *
                  </Label>
                  <Input
                    id="montantTTC"
                    type="number"
                    step="0.01"
                    value={montantTTC}
                    onChange={(e) => {
                      setMontantTTC(e.target.value);
                      if (tauxTva) calculateFromTTC(e.target.value, tauxTva);
                    }}
                    placeholder="0.00"
                    className="font-semibold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tauxTva" className="text-xs">
                    Taux TVA (%)
                  </Label>
                  <Input
                    id="tauxTva"
                    type="number"
                    step="0.1"
                    value={tauxTva}
                    onChange={(e) => {
                      setTauxTva(e.target.value);
                      if (montantTTC) calculateFromTTC(montantTTC, e.target.value);
                    }}
                    placeholder="20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="montantHT" className="text-xs text-muted-foreground">
                    Montant HT
                  </Label>
                  <Input
                    id="montantHT"
                    type="number"
                    step="0.01"
                    value={montantHT}
                    onChange={(e) => setMontantHT(e.target.value)}
                    placeholder="0.00"
                    className="text-muted-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tva" className="text-xs text-muted-foreground">
                    TVA (€)
                  </Label>
                  <Input
                    id="tva"
                    type="number"
                    step="0.01"
                    value={tva}
                    onChange={(e) => setTva(e.target.value)}
                    placeholder="0.00"
                    className="text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Date et Catégorie */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateFrais}
                  onChange={(e) => setDateFrais(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categorie">Catégorie *</Label>
                <Select value={categorie} onValueChange={setCategorie}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner" />
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
            </div>

            {/* Rental period for location_vehicule */}
            {categorie === "location_vehicule" && (
              <div className="bg-primary/5 rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CarFront className="h-4 w-4 text-primary" />
                  Période de location
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="dateDebut" className="text-xs">Début</Label>
                    <Input
                      id="dateDebut"
                      type="date"
                      value={dateDebut}
                      onChange={(e) => setDateDebut(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateFin" className="text-xs">Fin</Label>
                    <Input
                      id="dateFin"
                      type="date"
                      value={dateFin}
                      onChange={(e) => setDateFin(e.target.value)}
                    />
                  </div>
                </div>
                {dateDebut && dateFin && (
                  <div className="text-xs text-muted-foreground text-center">
                    Durée : {Math.ceil((new Date(dateFin).getTime() - new Date(dateDebut).getTime()) / (1000 * 60 * 60 * 24)) + 1} jours
                  </div>
                )}
              </div>
            )}

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
